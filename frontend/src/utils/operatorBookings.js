// Scope and filters for the operator's bookings list. Days are compared as local calendar days (YYYY-MM-DD).

function localKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const idOf = value => (value && typeof value === 'object' ? value._id : value);

// Group bookings on the operator's departures, plus bookings assigned directly to the operator.
export function operatorBookingsFor(bookings, departureIds, operatorId) {
  const mine = new Set((departureIds || []).map(String));
  return (bookings || []).filter(booking => {
    const groupId = idOf(booking.groupDepartureId);
    const isGroup = booking.bookingType === 'GROUP' || Boolean(groupId);
    if (!isGroup) return false;
    const onMyDeparture = groupId && mine.has(String(groupId));
    const assignedToMe = idOf(booking.assignedOperator) && String(idOf(booking.assignedOperator)) === String(operatorId);
    return Boolean(onMyDeparture || assignedToMe);
  });
}

// Search (customer name, package title or booking id), then type, status and date range.
export function filterOperatorBookings(bookings, { searchTerm = '', typeFilter = 'ALL', statusFilter = 'ALL', dateRange = {} } = {}) {
  let list = [...(bookings || [])];
  const term = searchTerm.trim().toLowerCase();
  if (term) {
    list = list.filter(booking =>
      String(booking._id || '').toLowerCase().includes(term) ||
      (booking.customerId?.fullName || '').toLowerCase().includes(term) ||
      (booking.packageId?.title || '').toLowerCase().includes(term));
  }
  if (typeFilter !== 'ALL') list = list.filter(booking => booking.bookingType === typeFilter);
  if (statusFilter !== 'ALL') list = list.filter(booking => booking.status === statusFilter);
  if (dateRange.start) list = list.filter(booking => localKey(booking.startDate) >= dateRange.start);
  if (dateRange.end) list = list.filter(booking => localKey(booking.startDate) <= dateRange.end);
  return list;
}

// Returns a new list with the operator notes changed on one booking. Other bookings are returned unchanged.
export function withOperatorNotes(bookings, bookingId, notes) {
  return (bookings || []).map(booking => (String(booking._id) === String(bookingId) ? { ...booking, operatorNotes: notes } : booking));
}
