import mongoose from 'mongoose';
import { nextBookingCode, deriveCode } from './bookingCode.service.js';
import Booking from '../model/booking.model.js';
import { TourPackage } from '../model/tourPackage.model.js';
import { GroupDeparture } from '../model/groupDeparture.model.js';
import { User } from '../model/user.model.js';
import { isUserKYCApproved } from './kyc.service.js';
import { paymentTotals, roundMoney } from './paymentAccounting.js';

export function domainError(message, status = 400) { return Object.assign(new Error(message), { status }); }
export async function bookingTransaction(work) {
  try { return await mongoose.connection.transaction(work); }
  catch (error) {
    console.error('Booking transaction failed:', error.name, error.message);
    if (error.code === 20 || /replica set|Transaction numbers/.test(error.message)) {
      return { error: 'This operation requires MongoDB transaction support (a replica set or Atlas).', status: 503 };
    }
    if (['ValidationError', 'CastError'].includes(error.name)) return { error: 'Invalid booking or payment data.', status: 400 };
    if (error.name === 'VersionError') return { error: 'The booking or departure changed. Refresh and retry.', status: 409 };
    if (error.code === 11000) return { error: 'This payment reference has already been verified.', status: 409 };
    return { error: error.status ? error.message : 'Unable to save the operation. Please retry.', status: error.status || 500 };
  }
}
const id = value => String(value?._id || value || '');
export const activeBookingStatuses = ['PENDING', 'CONFIRMED'];

export async function reserveBooking(input) {
  const { customerId, packageId, groupDepartureId, bookingType, numTravelers, travelers,
    reservedSeats = [], pointsToUse = 0, customizations = '', currency = 'BDT' } = input;
  // Validate before opening a transaction or changing inventory/points.
  if (typeof customizations !== 'string' || customizations.length > 4000) return { error: 'Customizations must be text of at most 4000 characters.' };
  if (![customerId, packageId].every(mongoose.isValidObjectId) || !['GROUP', 'PRIVATE', 'CUSTOM'].includes(bookingType)) return { error: 'Valid customer, package and booking type are required.' };
  if (!Number.isInteger(numTravelers) || numTravelers < 1 || !Array.isArray(travelers) || travelers.length !== numTravelers ||
      travelers.some(t => !t || typeof t.fullName !== 'string' || !t.fullName.trim() || !Number.isFinite(t.age) || t.age < 0 || t.age > 130)) return { error: 'Provide valid details for every traveler.' };
  if (!Array.isArray(reservedSeats) || reservedSeats.some(s => typeof s !== 'string' || !s.trim()) || new Set(reservedSeats).size !== reservedSeats.length ||
      (reservedSeats.length && reservedSeats.length !== numTravelers)) return { error: 'Seat selections must be unique and match the number of travelers.' };
  if (!Number.isInteger(pointsToUse) || pointsToUse < 0 || currency !== 'BDT') return { error: 'Invalid points or unsupported currency.' };
  if (bookingType === 'GROUP' && !mongoose.isValidObjectId(groupDepartureId)) return { error: 'Group departure ID is required.' };
  const from = new Date(input.startDate), until = new Date(input.endDate);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(until.getTime()) || from <= new Date() || until <= from) return { error: 'Choose valid future dates with an end after the start.' };

  return bookingTransaction(async session => {
    const tourPackage = await TourPackage.findById(packageId, null, { session });
    if (!tourPackage?.isActive) throw domainError('This tour package is not currently available.');
    if ((bookingType === 'GROUP') !== (tourPackage.type === 'GROUP')) throw domainError('Booking type does not match the package.');
    if (tourPackage.isInternational && !await isUserKYCApproved(customerId)) throw domainError('Approved KYC verification is required for international bookings.');
    const customer = await User.findById(customerId, null, { session });
    if (!customer || customer.isActive === false) throw domainError('Customer not found or inactive.');
    let departure;
    let totalAmount = roundMoney(tourPackage.basePrice * numTravelers);
    let startDate = from, endDate = until;
    if (bookingType === 'GROUP') {
      departure = await GroupDeparture.findById(groupDepartureId, null, { session });
      if (!departure || id(departure.packageId) !== packageId) throw domainError('Departure does not belong to this package.');
      if (departure.status !== 'OPEN' || departure.startDate <= new Date() || departure.bookedSeats + numTravelers > departure.totalSeats - (departure.seatMap || []).filter(s => s.status === 'BLOCKED').length) throw domainError('This departure has insufficient availability.');
      // Every competitor writes this same departure in the transaction. Write conflicts retry with a new snapshot.
      const existing = await Booking.find({ groupDepartureId, status: { $in: activeBookingStatuses } }, null, { session });
      const taken = new Set(existing.flatMap(b => b.reservedSeats || []));
      for (const seat of reservedSeats) {
        const mapped = departure.seatMap?.find(s => s.seatNumber === seat);
        if (taken.has(seat) || (departure.seatMap?.length && (!mapped || mapped.status !== 'AVAILABLE')) ||
            (!departure.seatMap?.length && (!/^\d+$/.test(seat) || Number(seat) < 1 || Number(seat) > departure.totalSeats))) throw domainError(`Seat ${seat} is unavailable.`);
      }
      totalAmount = roundMoney(departure.pricePerPerson * numTravelers);
      startDate = departure.startDate; endDate = departure.endDate;
    } else {
      if (groupDepartureId || reservedSeats.length) throw domainError('Private bookings cannot reserve group departure seats.');
      // Match the established package duration used by the customer booking form.
      const expectedEnd = new Date(from); expectedEnd.setDate(expectedEnd.getDate() + tourPackage.defaultDays);
      endDate = expectedEnd;
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw domainError('The package requires a valid price.');
    const discountAmount = Booking.calculateDiscountFromPoints(pointsToUse, totalAmount);
    const pointsUsed = Math.min(pointsToUse, discountAmount);
    if (pointsUsed > (customer.rewardPoints || 0)) throw domainError('Insufficient reward points.');
    // Booking code: the package code plus the next number for that package, inside this transaction.
    const bookingCode = await nextBookingCode(tourPackage.code || deriveCode(tourPackage.title), session);
    const booking = new Booking({ customerId, packageId, bookingType, groupDepartureId: departure?._id || null,
      startDate, endDate, numTravelers, travelers, totalAmount, currency, pointsUsed, discountAmount,
      bookingCode, finalAmount: roundMoney(totalAmount - discountAmount), reservedSeats, customizations: customizations.trim(),
      assignedOperator: departure?.operators?.[0]?.operatorId || null, status: 'PENDING' });
    await booking.validate();
    if (departure) {
      departure.bookedSeats += numTravelers;
      if (departure.bookedSeats >= departure.totalSeats - (departure.seatMap || []).filter(s => s.status === 'BLOCKED').length) departure.status = 'FULL';
      for (const seat of departure.seatMap || []) if (reservedSeats.includes(seat.seatNumber)) {
        seat.status = 'BOOKED'; seat.bookingId = booking._id; seat.bookedBy = customerId; seat.checkedIn = false;
      }
      await departure.save({ session });
    }
    if (pointsUsed) {
      customer.rewardPoints -= pointsUsed;
      customer.pointsHistory.push({ amount: -pointsUsed, type: 'USED', reason: 'Booking discount', bookingId: booking._id, date: new Date() });
      await customer.save({ session });
    }
    await booking.save({ session });
    await booking.populate('customerId', 'fullName email phone');
    await booking.populate('packageId', 'title destinations type category');
    return { booking };
  });
}

export function cancellationRefund(booking, fullRefund = false) {
  const { gross, refunded } = paymentTotals(booking);
  const days = Math.ceil((new Date(booking.startDate) - new Date()) / 86400000);
  const rate = fullRefund ? 1 : days <= 0 ? 0 : days > 30 ? 1 : days >= 15 ? .75 : days >= 7 ? .5 : days >= 3 ? .25 : .1;
  return Math.max(0, Math.round(gross * rate) - refunded);
}
// Session-aware primitive shared by single booking, expired booking and departure cancellation.
export async function cancelReservationInSession(booking, { userId, reason, fullRefund = false }, session) {
  if (['CANCELLED', 'REFUNDED'].includes(booking.status) || booking.cancellation?.isCancelled) return { booking, refundAmount: booking.cancellation?.refundAmount || 0 };
  if (booking.status === 'COMPLETED') throw domainError('Cannot cancel a completed booking.');
  const refundAmount = cancellationRefund(booking, fullRefund);
  if (booking.groupDepartureId) {
    const departure = await GroupDeparture.findById(booking.groupDepartureId, null, { session });
    if (departure) {
      departure.bookedSeats = Math.max(0, departure.bookedSeats - booking.numTravelers);
      if (departure.status === 'FULL') departure.status = 'OPEN';
      for (const seat of departure.seatMap || []) if (id(seat.bookingId) === id(booking._id)) {
        seat.status = 'AVAILABLE'; seat.bookingId = undefined; seat.bookedBy = undefined; seat.checkedIn = false;
      }
      await departure.save({ session });
    }
  }
  // Pending receipt claims must be resolved explicitly; don't silently discard money possibly transferred externally.
  for (const payment of booking.payments) if (payment.status === 'PENDING' && payment.method !== 'REFUND') payment.verificationNote = 'Booking cancelled; administrator must reconcile this submission.';
  booking.status = 'CANCELLED';
  booking.cancellation = { isCancelled: true, cancelledBy: userId, reason, cancelledAt: new Date(), refundAmount, refundProcessed: false };
  if (refundAmount > 0) booking.payments.push({ amount: refundAmount, method: 'REFUND', status: 'PENDING', transactionRef: `REFUND-${booking._id}` });
  if (booking.pointsUsed > 0) {
    const customer = await User.findById(booking.customerId, null, { session });
    if (customer) {
      customer.rewardPoints += booking.pointsUsed;
      customer.pointsHistory.push({ amount: booking.pointsUsed, type: 'EARNED', reason: 'Cancelled booking points returned', bookingId: booking._id, date: new Date() });
      await customer.save({ session });
    }
  }
  await booking.save({ session });
  return { booking, refundAmount };
}
export async function cancelReservation({ bookingId, userId, reason, fullRefund = false, onlyIfUnpaid = false }) {
  return bookingTransaction(async session => {
    const booking = await Booking.findById(bookingId, null, { session });
    if (!booking) throw domainError('Booking not found.', 404);
    if (onlyIfUnpaid && (new Date(booking.startDate) > new Date() || paymentTotals(booking).remaining === 0)) return { skipped: true };
    return cancelReservationInSession(booking, { userId, reason, fullRefund }, session);
  });
}
export async function cancelDepartureReservations({ departureId, userId }) {
  return bookingTransaction(async session => {
    let departure = await GroupDeparture.findById(departureId, null, { session });
    if (!departure) throw domainError('Departure not found.', 404);
    // Write first to serialize against reservations, then cancel all active bookings in the same transaction.
    departure.status = 'CANCELLED';
    await departure.save({ session });
    const bookings = await Booking.find({ groupDepartureId: departureId, status: { $in: activeBookingStatuses } }, null, { session });
    for (const booking of bookings) await cancelReservationInSession(booking, { userId, reason: 'Group departure cancelled', fullRefund: true }, session);
    departure = await GroupDeparture.findById(departureId, null, { session });
    return { departure };
  });
}
