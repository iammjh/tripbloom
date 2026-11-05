import { bookingLabel } from './bookingCode.js';

export const SAFETY_ITEMS = [
  { key: 'firstAid', label: 'First-aid box checked' },
  { key: 'vehicleDocs', label: 'Vehicle documents verified' },
  { key: 'foodHygiene', label: 'Food hygiene checked' },
  { key: 'emergencyContacts', label: 'Emergency contacts verified' },
  { key: 'routePlanned', label: 'Route planned and reviewed' }
];

export const EMPTY_SAFETY = Object.fromEntries(SAFETY_ITEMS.map(item => [item.key, false]));

export const INCIDENT_SEVERITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' }
];

export const INCIDENT_TONE = { LOW: 'info', MEDIUM: 'warning', HIGH: 'warning', CRITICAL: 'danger' };

// Bookings that are cancelled or still pending do not travel, so they are left off the passenger list.
const NOT_TRAVELLING = ['CANCELLED', 'PENDING'];

function travelerName(traveler) {
  return traveler.fullName || traveler.name || `${traveler.firstName || ''} ${traveler.lastName || ''}`.trim() || 'Guest';
}

// One row per traveller on the departure's live bookings. Seat numbers come only from reservedSeats:
// a traveller without one is shown as unassigned, so the browser never invents a seat.
export function passengerRows(bookings = []) {
  const rows = [];
  bookings.forEach(booking => {
    const status = String(booking.status || '').toUpperCase();
    if (NOT_TRAVELLING.includes(status)) return;
    const reserved = Array.isArray(booking.reservedSeats) ? booking.reservedSeats : [];
    const paid = Array.isArray(booking.payments) && booking.payments.some(payment => payment.status === 'SUCCESS');
    const label = bookingLabel(booking);
    (booking.travelers || []).forEach((traveler, index) => {
      const seat = reserved[index];
      rows.push({
        id: `${booking._id}-${index}`,
        name: travelerName(traveler),
        bookingLabel: label,
        bookingRecordId: booking._id,
        customerId: booking.customerId?._id || booking.customerId,
        phone: traveler.phone || booking.customerPhone || booking.customerId?.phone || '',
        paid,
        paymentLabel: paid ? 'Paid' : (booking.status || 'Pending'),
        seatNumber: seat ? (Number(seat) || String(seat)) : null,
        emergencyContact: traveler.phoneEmergency || traveler.emergencyContact || ''
      });
    });
  });
  return rows;
}

// Attendance for the stat tiles: a passenger counts as checked in when their seat is marked so.
export function attendanceCounts(passengers = [], checkedIn = {}) {
  const checkedInCount = passengers.filter(passenger => checkedIn[passenger.id]).length;
  return {
    booked: passengers.length,
    checkedIn: checkedInCount,
    noShow: passengers.length - checkedInCount
  };
}

export function isSafetyComplete(checklist = {}) {
  return SAFETY_ITEMS.every(item => Boolean(checklist[item.key]));
}

export function incidentTone(severity) {
  return INCIDENT_TONE[String(severity || '').toUpperCase()] || 'neutral';
}
