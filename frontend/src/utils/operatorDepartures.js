// Status, warnings, tour type and filters for the operator's departure list.
// Days are compared as local calendar days (YYYY-MM-DD), so the date range does not shift with time zones.

const HOUR_MS = 60 * 60 * 1000;

function localKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// One badge for the departure: label and tone (see ui/Badge).
export function departureStatus(dep, now = new Date()) {
  const start = new Date(dep.startDate);
  const end = new Date(dep.endDate);
  if (dep.status === 'CANCELLED') return { key: 'CANCELLED', label: 'CANCELLED', tone: 'danger' };
  if (start <= now && now <= end) return { key: 'IN_PROGRESS', label: 'IN PROGRESS', tone: 'success' };
  if (end < now) return { key: 'COMPLETED', label: 'COMPLETED', tone: 'neutral' };
  if (dep.bookedSeats >= dep.totalSeats) return { key: 'FULL', label: 'FULL', tone: 'brand' };
  if (dep.status === 'OPEN') return { key: 'SCHEDULED', label: 'SCHEDULED', tone: 'info' };
  return { key: dep.status, label: dep.status, tone: 'neutral' };
}

// Warnings the operator should act on. Labels are shown as they are.
export function departureWarnings(dep, now = new Date()) {
  const warnings = [];
  if (dep.bookedSeats > dep.totalSeats) warnings.push('OVERBOOKED');
  const hoursUntil = (new Date(dep.startDate) - now) / HOUR_MS;
  const hasItinerary = Array.isArray(dep.itinerary) && dep.itinerary.some(day => Array.isArray(day.stops) && day.stops.length > 0);
  if (hoursUntil > 0 && hoursUntil < 24 && !hasItinerary) warnings.push('ITINERARY PENDING');
  if (dep.operators && dep.operators.length > 1) warnings.push('CO-GUIDE');
  return warnings;
}

// "Day Tour" for a single day, otherwise "N-Day Tour".
export function tourType(dep) {
  if (!dep.packageId) return 'Unknown';
  const start = new Date(dep.startDate);
  const end = new Date(dep.endDate);
  const days = Math.ceil((end - start) / (24 * HOUR_MS));
  return days <= 1 ? 'Day Tour' : `${days}-Day Tour`;
}

// Applies the search, status and date-range filters, in that order.
export function filterDepartures(departures, { searchTerm = '', statusFilter = 'ALL', dateRange = {} } = {}, now = new Date()) {
  let list = [...(departures || [])];
  const term = searchTerm.trim().toLowerCase();
  if (term) {
    list = list.filter(dep =>
      (dep.packageId?.title || '').toLowerCase().includes(term) ||
      (dep.packageId?.destination || '').toLowerCase().includes(term));
  }
  if (statusFilter !== 'ALL') {
    list = list.filter(dep => {
      if (statusFilter === 'SCHEDULED') return dep.status === 'OPEN' && new Date(dep.startDate) > now;
      if (statusFilter === 'IN_PROGRESS') return new Date(dep.startDate) <= now && now <= new Date(dep.endDate);
      if (statusFilter === 'COMPLETED') return new Date(dep.endDate) < now;
      return dep.status === statusFilter;
    });
  }
  if (dateRange.start) list = list.filter(dep => localKey(dep.startDate) >= dateRange.start);
  if (dateRange.end) list = list.filter(dep => localKey(dep.endDate) <= dateRange.end);
  return list;
}
