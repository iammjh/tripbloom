import { reserveBooking, cancelReservation, bookingTransaction, domainError } from './reservation.service.js';
import { paymentTotals } from './paymentAccounting.js';
export { submitManualPayment as addPayment, recordManualRefund as processRefund } from './manualPayment.service.js';
// booking.service.js
import Booking from '../model/booking.model.js';
import { TourPackage } from '../model/tourPackage.model.js';
import { GroupDeparture } from '../model/groupDeparture.model.js';
import { User } from '../model/user.model.js';
import { isUserKYCApproved, getUserKYCStatus } from './kyc.service.js';
import { sendMessage } from './message.service.js';
import { logActivity } from './activityLog.service.js';

// Check and cancel unpaid bookings that have passed start date
export async function cancelUnpaidExpiredBookings() {
  const bookings = await Booking.find({ startDate: { $lte: new Date() }, status: { $in: ['PENDING', 'CONFIRMED'] } });
  const cancelled = [];
  for (const booking of bookings) {
    const result = await cancelReservation({ bookingId: booking._id, reason: 'Tour started without full payment', fullRefund: true, onlyIfUnpaid: true });
    if (result.error) return result;
    if (!result.skipped) cancelled.push(result.booking);
  }
  return { cancelledCount: cancelled.length, bookings: cancelled };
}

// Create a new booking
export const createBooking = reserveBooking;

// Get booking by ID
export async function getBookingById(bookingId) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('customerId', 'fullName name email phone')
      .populate('packageId') // Populate all package fields
      .populate({ path: 'groupDepartureId', select: 'startDate endDate totalSeats bookedSeats pricePerPerson operators', populate: { path: 'operators.operatorId', select: 'fullName email phone' } })
      .populate('assignedOperator', 'fullName name email phone');

    if (!booking) {
      return { error: 'Booking not found' };
    }

    if (Array.isArray(booking.groupDepartureId?.operators)) booking.assignedOperator = booking.groupDepartureId.operators[0]?.operatorId || null;
    return { booking };
  } catch (err) {
    console.error('Error fetching booking:', err);
    return { error: 'Failed to fetch booking' };
  }
}

// List bookings with filters
export async function listBookings({ 
  customerId, 
  packageId, 
  groupDepartureId, 
  status, 
  bookingType,
  startDate,
  endDate,
  operatorId,
  assignedOperator
}) {
  try {
    const filter = {};

    if (customerId) filter.customerId = customerId;
    if (packageId) filter.packageId = packageId;
    if (groupDepartureId) filter.groupDepartureId = groupDepartureId;
    if (bookingType) filter.bookingType = bookingType;
    if (assignedOperator) filter.assignedOperator = assignedOperator;
    if (operatorId) {
      const departures = await GroupDeparture.find({ 'operators.operatorId': operatorId }).select('_id');
      filter.$or = [
        { assignedOperator: operatorId, groupDepartureId: null },
        { groupDepartureId: { $in: departures.map(departure => departure._id.toString()) } }
      ];
    }

    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        filter.status = { $in: status.split(',').map(s => s.trim().toUpperCase()) };
      } else {
        filter.status = status.toUpperCase();
      }
    }

    // Date range filters
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    const bookings = await Booking.find(filter)
      .populate('customerId', 'fullName name email phone')
      .populate('packageId') // Populate all package fields for customer dashboard
      .populate({ path: 'groupDepartureId', select: 'startDate endDate totalSeats bookedSeats pricePerPerson operators', populate: { path: 'operators.operatorId', select: 'fullName email phone' } })
      .populate('assignedOperator', 'fullName name email phone')
      .sort({ createdAt: -1 });

    for (const booking of bookings) if (Array.isArray(booking.groupDepartureId?.operators)) booking.assignedOperator = booking.groupDepartureId.operators[0]?.operatorId || null;
    return { bookings };
  } catch (err) {
    console.error('Error listing bookings:', err);
    return { error: 'Failed to list bookings' };
  }
}

export async function updateOperatorNotes({ bookingId, operatorNotes }) {
  if (typeof operatorNotes !== 'string' || operatorNotes.length > 5000) {
    return { error: 'Operator notes must be text of at most 5000 characters.' };
  }
  try {
    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { $set: { operatorNotes: operatorNotes.trim() } },
      { new: true, runValidators: true }
    ).select('_id operatorNotes');
    return booking ? { booking } : { error: 'Booking not found' };
  } catch (error) {
    return { error: 'Failed to save operator notes.' };
  }
}

// Update booking (limited fields)
export async function updateBooking({ bookingId, travelers, operatorNotes }) {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return { error: 'Booking not found' };
    }

    // Only allow updates for PENDING bookings
    if (booking.status !== 'PENDING') {
      return { error: 'Only pending bookings can be updated' };
    }

    if (travelers) {
      if (travelers.length !== booking.numTravelers) {
        return { error: 'Number of travelers cannot be changed' };
      }
      booking.travelers = travelers;
    }

    if (operatorNotes !== undefined) {
      booking.operatorNotes = operatorNotes;
    }

    await booking.save();

    await booking.populate('customerId', 'name email phone');
    await booking.populate('packageId', 'title destination type category');
    await booking.populate('assignedOperator', 'fullName name email phone');
    if (booking.groupDepartureId) {
      await booking.populate({ path: 'groupDepartureId', select: 'startDate endDate totalSeats bookedSeats pricePerPerson operators', populate: { path: 'operators.operatorId', select: 'fullName email phone' } });
    }

    return { booking };
  } catch (err) {
    console.error('Error updating booking:', err);
    return { error: 'Failed to update booking' };
  }
}

// Cancel booking
export const cancelBooking = cancelReservation;

// Request date change for a booking
export async function requestDateChange({ bookingId, userId, requestedDate, reason }) {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return { error: 'Booking not found' };
    }

    // Check if already cancelled or refunded
    if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') {
      return { error: 'Cannot request date change for cancelled booking' };
    }

    // Check if booking is completed
    if (booking.status === 'COMPLETED') {
      return { error: 'Cannot request date change for completed booking' };
    }

    // Check if there's already a pending date change request
    if (booking.dateChangeRequest && booking.dateChangeRequest.status === 'PENDING') {
      return { error: 'There is already a pending date change request for this booking' };
    }

    // Validate the requested date
    const newDate = new Date(requestedDate);
    if (isNaN(newDate.getTime())) {
      return { error: 'Invalid date format' };
    }

    if (newDate < new Date()) {
      return { error: 'Requested date cannot be in the past' };
    }

    // Create date change request
    booking.dateChangeRequest = {
      requestedDate: newDate,
      reason,
      requestedBy: userId,
      requestedAt: new Date(),
      status: 'PENDING'
    };

    await booking.save();
    await booking.populate('customerId', 'name email phone');
    await booking.populate('packageId', 'title destination type category');
    await booking.populate('assignedOperator', 'fullName name email phone');

    return { booking, message: 'Date change request submitted successfully' };
  } catch (err) {
    console.error('Error requesting date change:', err);
    return { error: 'Failed to submit date change request' };
  }
}

// Approve date change request (Admin)
async function applyDateChangeApproval({ bookingId, adminId, newStartDate }) {
  const start = new Date(newStartDate);
  if (!Number.isFinite(+start) || start <= new Date()) return { error: 'Choose a valid future date.' };
  return bookingTransaction(async session => {
    const booking = await Booking.findById(bookingId, null, { session });
    if (!booking) throw domainError('Booking not found.', 404);
    if (!['PENDING', 'CONFIRMED'].includes(booking.status) || booking.dateChangeRequest?.status !== 'PENDING') throw domainError('No active pending date change request found.');
    const oldDate = booking.startDate;
    if (booking.bookingType === 'GROUP') {
      const from = new Date(start); from.setUTCHours(0, 0, 0, 0);
      const until = new Date(+from + 86400000);
      const target = await GroupDeparture.findOne({ packageId: booking.packageId, startDate: { $gte: from, $lt: until }, status: 'OPEN' }, null, { session });
      if (!target || String(target._id) === String(booking.groupDepartureId)) throw domainError('Choose a different open departure for this package on the requested date.');
      if (target.pricePerPerson * booking.numTravelers !== booking.totalAmount) throw domainError('The target departure has a different price; arrange a new booking rather than changing this contract.');
      const capacity = target.totalSeats - target.seatMap.filter(s => s.status === 'BLOCKED').length;
      if (target.bookedSeats + booking.numTravelers > capacity) throw domainError('The target departure has insufficient availability.');
      const existing = await Booking.find({ groupDepartureId: target._id, status: { $in: ['PENDING', 'CONFIRMED'] } }, null, { session });
      const taken = new Set(existing.flatMap(b => b.reservedSeats));
      for (const number of booking.reservedSeats) {
        const seat = target.seatMap.find(s => s.seatNumber === number);
        if (taken.has(number) || (target.seatMap.length && (!seat || seat.status !== 'AVAILABLE'))) throw domainError('The selected seats are unavailable on the target departure.');
      }
      const previous = await GroupDeparture.findById(booking.groupDepartureId, null, { session });
      if (!previous) throw domainError('Original departure not found.');
      previous.bookedSeats = Math.max(0, previous.bookedSeats - booking.numTravelers);
      if (previous.status === 'FULL') previous.status = 'OPEN';
      for (const seat of previous.seatMap) if (String(seat.bookingId) === String(booking._id)) { seat.status = 'AVAILABLE'; seat.bookingId = undefined; seat.bookedBy = undefined; seat.checkedIn = false; }
      target.bookedSeats += booking.numTravelers;
      if (target.bookedSeats >= capacity) target.status = 'FULL';
      for (const seat of target.seatMap) if (booking.reservedSeats.includes(seat.seatNumber)) { seat.status = 'BOOKED'; seat.bookingId = booking._id; seat.bookedBy = booking.customerId; seat.checkedIn = false; }
      await previous.save({ session }); await target.save({ session });
      booking.groupDepartureId = target._id; booking.assignedOperator = target.operators[0]?.operatorId || null;
      booking.startDate = target.startDate; booking.endDate = target.endDate;
    } else {
      const pkg = await TourPackage.findById(booking.packageId, null, { session });
      if (!pkg) throw domainError('Package not found.');
      booking.startDate = start; booking.endDate = new Date(start); booking.endDate.setDate(booking.endDate.getDate() + pkg.defaultDays);
    }
    booking.dateChangeRequest.status = 'APPROVED'; booking.dateChangeRequest.reviewedBy = adminId; booking.dateChangeRequest.reviewedAt = new Date();
    booking.dateChangeRequest.reviewNotes = `Date changed from ${oldDate.toISOString()} to ${booking.startDate.toISOString()}`;
    await booking.save({ session });
    return { success: true, booking, message: 'Date change request approved successfully' };
  });
}

// Reject date change request (Admin)
async function applyDateChangeRejection({ bookingId, adminId, reviewNotes }) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('customerId', 'fullName email')
      .populate('packageId', 'title');
    
    if (!booking) {
      return { error: 'Booking not found' };
    }

    if (!booking.dateChangeRequest || booking.dateChangeRequest.status !== 'PENDING') {
      return { error: 'No pending date change request found' };
    }

    // Update date change request status
    booking.dateChangeRequest.status = 'REJECTED';
    booking.dateChangeRequest.reviewedBy = adminId;
    booking.dateChangeRequest.reviewedAt = new Date();
    booking.dateChangeRequest.reviewNotes = reviewNotes || 'Request rejected by admin';

    await booking.save();

    return { 
      success: true, 
      booking,
      message: 'Date change request rejected'
    };
  } catch (err) {
    console.error('Error rejecting date change:', err);
    return { error: 'Failed to reject date change request' };
  }
}

// Get booking statistics for a customer
export async function getCustomerBookingStats(customerId) {
  try {
    const bookings = await Booking.find({ customerId });

    const stats = {
      total: bookings.length,
      pending: bookings.filter(b => b.status === 'PENDING').length,
      confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
      completed: bookings.filter(b => b.status === 'COMPLETED').length,
      cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
      totalSpent: bookings.reduce((sum, b) => sum + paymentTotals(b).net, 0),
      upcomingTrips: bookings.filter(b => 
        (b.status === 'CONFIRMED' || b.status === 'PENDING') && 
        new Date(b.startDate) > new Date()
      ).length
    };

    return { stats };
  } catch (err) {
    console.error('Error fetching customer stats:', err);
    return { error: 'Failed to fetch statistics' };
  }
}

// Mark booking as completed (usually called after end date)
export async function completeBooking(bookingId) {
  return bookingTransaction(async session => {
    const booking = await Booking.findById(bookingId, null, { session });
    if (!booking) throw domainError('Booking not found.', 404);
    if (booking.status === 'COMPLETED') return { booking, message: 'Already completed' };
    if (booking.status !== 'CONFIRMED' || paymentTotals(booking).remaining > 0) throw domainError('Only a fully paid, confirmed booking can be completed.');
    const customer = await User.findById(booking.customerId, null, { session });
    const pkg = await TourPackage.findById(booking.packageId, null, { session });
    if (!customer || !pkg) throw domainError('Booking customer or package is unavailable.');
    const pointsEarned = Booking.calculatePointsForCategory(pkg.category, booking.finalAmount ?? booking.totalAmount);
    booking.status = 'COMPLETED'; booking.pointsEarned = pointsEarned;
    customer.rewardPoints += pointsEarned;
    customer.pointsHistory.push({ amount: pointsEarned, type: 'EARNED', bookingId: booking._id, reason: `Earned from completing ${pkg.category || 'tour'}`, date: new Date() });
    await customer.save({ session });
    await booking.save({ session });
    return { booking, pointsEarned };
  });
}

export async function autoCompletePassedBookings() {
  const candidates = await Booking.find({ endDate: { $lte: new Date() }, status: 'CONFIRMED', 'cancellation.isCancelled': false }).select('_id');
  const completed = [];
  for (const candidate of candidates) {
    const result = await completeBooking(candidate._id);
    if (result.error) return { ...result, completedCount: completed.length, completed };
    completed.push(candidate._id);
  }
  return { completedCount: completed.length, completed };
}

// Mark booking as checked in by customer
export async function checkInBooking(bookingId, userId) {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return { error: 'Booking not found' };

    if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') {
      return { error: 'Cannot check in for cancelled or refunded booking' };
    }

    if (booking.status !== 'CONFIRMED' || paymentTotals(booking).remaining > 0) return { error: 'Only a fully paid, confirmed booking can check in.' };

    // Allow check-in if booking exists and not already checked in
    booking.checkedIn = true;
    booking.checkedInAt = new Date();
    booking.checkedInByUser = userId || null;



    await booking.save();

    await booking.populate('customerId', 'fullName name email phone');
    await booking.populate('packageId', 'title destination');

    return { booking };
  } catch (err) {
    console.error('Error checking in booking:', err);
    return { error: 'Failed to check in booking' };
  }
}

// Process refund for a cancelled booking

// Date change decisions are recorded in the activity log after they are saved.
export async function approveDateChange(args) {
  const result = await applyDateChangeApproval(args);
  if (result?.success) {
    await logActivity({
      adminId: args.adminId,
      action: 'DATE_CHANGE_APPROVED',
      targetType: 'Booking',
      targetId: args.bookingId,
      description: `Approved date change on booking ${result.booking?.bookingCode || String(args.bookingId).slice(-6)}. ${result.booking?.dateChangeRequest?.reviewNotes || ''}`.trim(),
    });
  }
  return result;
}

export async function rejectDateChange(args) {
  const result = await applyDateChangeRejection(args);
  if (result?.success) {
    await logActivity({
      adminId: args.adminId,
      action: 'DATE_CHANGE_REJECTED',
      targetType: 'Booking',
      targetId: args.bookingId,
      description: `Rejected date change on booking ${result.booking?.bookingCode || String(args.bookingId).slice(-6)}`,
      metadata: { reviewNotes: args.reviewNotes || '' },
    });
  }
  return result;
}
