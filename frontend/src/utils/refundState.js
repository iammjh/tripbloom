// Refund rules shared by the notification bell and the refund queue, so both always agree.

// A refund is recorded once the booking is REFUNDED or its cancellation says the refund was processed.
export function isRefundRecorded(booking) {
  return booking.status === 'REFUNDED' || booking.cancellation?.refundProcessed === true;
}

// Money the customer paid that was accepted (refund rows are not payments).
export function paidTotal(booking) {
  return (booking.payments || [])
    .filter(p => p.status === 'SUCCESS' && p.method !== 'REFUND')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
}

// The refund owed for a cancellation. Zero when the cancellation policy gives no refund (for example, a cancellation on or after the start date).
export function refundOwed(booking) {
  return Number(booking.cancellation?.refundAmount || 0);
}

// A refund is pending when the booking is cancelled, the customer paid, a refund is owed, and it has not been recorded yet.
export function isRefundPending(booking) {
  const cancelled = booking.status === 'CANCELLED' || Boolean(booking.cancellation?.isCancelled);
  return cancelled && !isRefundRecorded(booking) && paidTotal(booking) > 0 && refundOwed(booking) > 0;
}

// Status shown in the refund queue: REFUNDED, PENDING_REFUND (money still to send), or NO_REFUND (nothing owed).
export function refundStatusOf(booking) {
  if (isRefundRecorded(booking)) return 'REFUNDED';
  return refundOwed(booking) > 0 ? 'PENDING_REFUND' : 'NO_REFUND';
}
