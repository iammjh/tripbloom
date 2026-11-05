import Booking from '../model/booking.model.js';
import { PaymentReceipt } from '../model/paymentReceipt.model.js';
import { isUserKYCApproved } from './kyc.service.js';
import { bookingTransaction, domainError } from './reservation.service.js';
import { paymentTotals, validMoney, roundMoney } from './paymentAccounting.js';
import { logActivity } from './activityLog.service.js';

const methods = ['BKASH', 'NAGAD', 'ROCKET', 'CARD', 'BANK_TRANSFER', 'CASH'];
const reference = value => typeof value === 'string' ? value.trim().toUpperCase() : '';
async function paymentBooking(booking) {
  await booking.populate('customerId', 'fullName email phone');
  await booking.populate('packageId', 'title destinations type category');
  return booking;
}
export async function submitManualPayment({ bookingId, amount, method, transactionRef }) {
  const normalizedMethod = typeof method === 'string' ? method.toUpperCase() : '';
  const normalizedRef = reference(transactionRef);
  if (!validMoney(amount) || !methods.includes(normalizedMethod) || !normalizedRef || normalizedRef.length > 120) return { error: 'Provide a positive amount (up to two decimals), payment method and receipt/reference (up to 120 characters).' };
  return bookingTransaction(async session => {
    const booking = await Booking.findById(bookingId, null, { session });
    if (!booking) throw domainError('Booking not found.', 404);
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) throw domainError('Cannot submit payment for this booking.');
    const existing = booking.payments.find(p => p.method === normalizedMethod && reference(p.transactionRef) === normalizedRef);
    if (existing) {
      if (existing.amount !== amount) throw domainError('This reference was already submitted with a different amount.', 409);
      return { booking: await paymentBooking(booking), payment: existing, duplicate: true };
    }
    if (amount > paymentTotals(booking).availableToSubmit) throw domainError('Amount exceeds the balance after pending submissions.');
    if (amount >= 50000 && !await isUserKYCApproved(booking.customerId)) throw domainError('Approved KYC is required for payments of BDT 50,000 or more.');
    booking.payments.push({ amount, method: normalizedMethod, transactionRef: normalizedRef, status: 'PENDING', submittedAt: new Date() });
    await booking.save({ session });
    return { booking: await paymentBooking(booking), payment: booking.payments.at(-1) };
  });
}
export async function listPendingPayments() {
  const bookings = await Booking.find({ payments: { $elemMatch: { status: 'PENDING', method: { $ne: 'REFUND' } } } })
    .select('customerId packageId status currency finalAmount payments cancellation')
    .populate('customerId', 'fullName email').populate('packageId', 'title').sort({ createdAt: 1 }).lean();
  return bookings.flatMap(booking => booking.payments.filter(p => p.status === 'PENDING' && p.method !== 'REFUND').map(payment => ({
    ...payment, bookingId: booking._id, bookingStatus: booking.status, customer: booking.customerId, package: booking.packageId,
    currency: booking.currency, remainingAmount: paymentTotals(booking).remaining
  })));
}
async function applyManualPaymentDecision({ bookingId, paymentId, adminId, approved, notes = '' }) {
  if (typeof approved !== 'boolean' || typeof notes !== 'string' || notes.length > 1000) return { error: 'Provide an approval decision and notes of at most 1000 characters.' };
  return bookingTransaction(async session => {
    const booking = await Booking.findById(bookingId, null, { session });
    if (!booking) throw domainError('Booking not found.', 404);
    const payment = booking.payments.id(paymentId);
    if (!payment || payment.method === 'REFUND') throw domainError('Payment submission not found.', 404);
    const target = approved ? 'SUCCESS' : 'FAILED';
    if (payment.status !== 'PENDING') {
      if (payment.status === target && payment.verifiedBy) return { booking: await paymentBooking(booking), payment, duplicate: true };
      throw domainError('This payment has already been decided.', 409);
    }
    if (approved) {
      if (booking.cancellation?.refundProcessed || booking.status === 'REFUNDED') throw domainError('This booking was already refunded, so the claim cannot be approved. Reject it with an explanation instead.', 409);
      if (payment.amount > paymentTotals(booking).remaining) throw domainError('Approval would overpay this booking. Reconcile the submission externally.');
      const escapedRef = reference(payment.transactionRef).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const legacyReceipt = await Booking.exists({ payments: { $elemMatch: { method: payment.method, status: 'SUCCESS', transactionRef: { $regex: '^\\s*' + escapedRef + '\\s*$', $options: 'i' } } } }).session(session);
      if (legacyReceipt) throw domainError('This payment reference has already been recorded as successful.', 409);
      // Unique ledger entry and booking update commit together; competing bookings cannot share a verified receipt.
      await PaymentReceipt.create([{ bookingId, paymentId: payment._id, method: payment.method, transactionRef: reference(payment.transactionRef), amount: payment.amount, verifiedBy: adminId }], { session });
      payment.paidAt = new Date();
    }
    payment.status = target; payment.verifiedAt = new Date(); payment.verifiedBy = adminId; payment.verificationNote = notes.trim();
    if (approved && booking.status === 'CANCELLED') {
      booking.cancellation.refundAmount = roundMoney((booking.cancellation.refundAmount || 0) + payment.amount);
      const pendingRefund = booking.payments.find(p => p.method === 'REFUND' && p.status === 'PENDING');
      if (pendingRefund) pendingRefund.amount = booking.cancellation.refundAmount;
      else booking.payments.push({ amount: booking.cancellation.refundAmount, method: 'REFUND', status: 'PENDING', transactionRef: `REFUND-${booking._id}` });
    } else if (approved && booking.status === 'PENDING' && paymentTotals(booking).remaining === 0) booking.status = 'CONFIRMED';
    await booking.save({ session });
    return { booking: await paymentBooking(booking), payment };
  });
}
async function applyManualRefund({ bookingId, adminId, transactionRef, notes = '' }) {
  const ref = reference(transactionRef);
  if (!ref || ref.length > 120 || typeof notes !== 'string' || notes.length > 1000) return { error: 'A completed refund reference is required (up to 120 characters).' };
  return bookingTransaction(async session => {
    const booking = await Booking.findById(bookingId, null, { session });
    if (!booking) throw domainError('Booking not found.', 404);
    if (booking.cancellation?.refundProcessed) {
      const prior = booking.payments.find(p => p.method === 'REFUND' && p.status === 'SUCCESS' && reference(p.transactionRef) === ref);
      if (!prior) throw domainError('A refund was already recorded with a different reference.', 409);
      return { booking: await paymentBooking(booking), refundAmount: booking.cancellation.refundAmount, duplicate: true };
    }
    if (booking.status !== 'CANCELLED' || !booking.cancellation?.isCancelled) throw domainError('Booking is not cancelled.');
    if (booking.payments.some(p => p.method !== 'REFUND' && p.status === 'PENDING')) throw domainError('Resolve pending payment submissions before recording a refund.');
    const amount = booking.cancellation.refundAmount;
    if (!validMoney(amount) || amount > paymentTotals(booking).net) throw domainError('No valid outstanding refund is due.');
    if (await PaymentReceipt.exists({ method: 'REFUND', transactionRef: ref, bookingId: { $ne: bookingId } }).session(session)) throw domainError('This refund reference was already recorded for another booking.', 409);
    let payment = booking.payments.find(p => p.method === 'REFUND' && p.status === 'PENDING');
    if (!payment) { booking.payments.push({ amount, method: 'REFUND', status: 'PENDING' }); payment = booking.payments.at(-1); }
    Object.assign(payment, { amount, status: 'SUCCESS', transactionRef: ref, paidAt: new Date(), verifiedAt: new Date(), verifiedBy: adminId, verificationNote: notes.trim() });
    await PaymentReceipt.create([{ bookingId, paymentId: payment._id, method: 'REFUND', transactionRef: ref, amount, verifiedBy: adminId }], { session });
    booking.cancellation.refundProcessed = true; booking.cancellation.refundProcessedAt = new Date(); booking.cancellation.refundProcessedBy = adminId; booking.status = 'REFUNDED';
    await booking.save({ session });
    return { booking: await paymentBooking(booking), refundAmount: amount };
  });
}

// Administrator decisions are recorded in the activity log once the transaction has committed.
export async function verifyManualPayment(args) {
  const result = await applyManualPaymentDecision(args);
  if (result?.payment && !result.duplicate && !result.error) {
    const code = result.booking?.bookingCode || String(args.bookingId).slice(-6);
    await logActivity({
      adminId: args.adminId,
      action: args.approved ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
      targetType: 'Booking',
      targetId: args.bookingId,
      description: `${args.approved ? 'Verified' : 'Rejected'} ${result.payment.method} payment of BDT ${result.payment.amount} on booking ${code}`,
      metadata: { paymentId: String(result.payment._id), amount: result.payment.amount, method: result.payment.method },
    });
  }
  return result;
}

export async function recordManualRefund(args) {
  const result = await applyManualRefund(args);
  if (result?.refundAmount !== undefined && !result.duplicate && !result.error) {
    const code = result.booking?.bookingCode || String(args.bookingId).slice(-6);
    await logActivity({
      adminId: args.adminId,
      action: 'REFUND_PROCESSED',
      targetType: 'Booking',
      targetId: args.bookingId,
      description: `Recorded refund of BDT ${result.refundAmount} on booking ${code} (ref ${args.transactionRef})`,
      metadata: { refundAmount: result.refundAmount },
    });
  }
  return result;
}
