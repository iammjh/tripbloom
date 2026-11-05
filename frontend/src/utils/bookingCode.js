// The booking code shown wherever a booking appears, e.g. #RL001. The same code is used on the booking, its refund and its date change.
// Bookings made before codes existed show a short form of their id until the backfill has run.
export function bookingLabel(booking) {
  if (booking?.bookingCode) return booking.bookingCode;
  const id = String(booking?._id || booking?.id || '');
  return id ? `#${id.slice(-6).toUpperCase()}` : '#—';
}
