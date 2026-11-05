// Translate the existing itinerary editor and seat presentation to persisted departure fields.
export function toEditorItinerary(stored = [], startDate) {
  return { days: stored.map(day => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + Number(day.day) - 1);
    return { dayNumber: day.day, date, activities: (day.stops || []).map(stop => ({ ...stop })) };
  }) };
}

export function toStoredItinerary(editor) {
  return editor.days.map(day => ({ day: Number(day.dayNumber), stops: day.activities.map(stop => ({
    time: stop.time || '', name: stop.name || '', location: stop.location || '', notes: stop.notes || '', status: stop.status || 'pending'
  })) }));
}

export function buildSeatRows(totalSeats, passengers = [], savedSeats = [], bookedSeats = 0) {
  const saved = new Map(savedSeats.map(seat => [String(seat.seatNumber), seat]));
  const numeric = savedSeats.every(seat => /^\d+$/.test(String(seat.seatNumber)) && Number(seat.seatNumber) <= totalSeats);
  const labels = numeric ? Array.from({ length: totalSeats }, (_, index) => String(index + 1)) : [...saved.keys()];
  for (let number = 1; labels.length < totalSeats; number++) if (!labels.includes(String(number))) labels.push(String(number));
  const seats = labels.map((label, index) => {
    const stored = saved.get(label);
    const passenger = passengers.find(person => String(person.seatNumber) === label);
    const booked = stored ? stored.status === 'BOOKED' : Boolean(passenger) || index < bookedSeats;
    const checkedIn = Boolean(stored?.checkedIn);
    return { number: /^\d+$/.test(label) ? Number(label) : label, seatNumber: label,
      status: stored?.status === 'BLOCKED' ? 'blocked' : booked ? (checkedIn ? 'booked-checked' : 'booked') : 'free',
      checkedIn, passenger, bookedBy: stored?.bookedBy || passenger?.customerId,
      bookingId: stored?.bookingId || passenger?.bookingRecordId };
  });
  return Array.from({ length: Math.ceil(seats.length / 4) }, (_, row) => seats.slice(row * 4, row * 4 + 4));
}

export function toSeatPayload(rows) {
  return rows.flat().filter(Boolean).map(seat => ({
    seatNumber: String(seat.seatNumber ?? seat.number),
    status: seat.status === 'blocked' ? 'BLOCKED' : seat.status === 'free' ? 'AVAILABLE' : 'BOOKED',
    checkedIn: seat.status === 'booked-checked',
    ...(seat.bookedBy ? { bookedBy: seat.bookedBy } : {}),
    ...(seat.bookingId ? { bookingId: seat.bookingId } : {})
  }));
}
