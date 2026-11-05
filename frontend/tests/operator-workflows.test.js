import test from 'node:test';
import assert from 'node:assert/strict';
import { toEditorItinerary, toStoredItinerary, buildSeatRows, toSeatPayload } from '../src/operator/departureState.js';

test('itinerary editor roundtrips persisted day/stops without mock replacements', () => {
  const source = [{ day: 2, stops: [{ time: '09:30', name: 'Museum', location: 'City', notes: 'Tickets', status: 'completed' }] }];
  assert.deepEqual(toStoredItinerary(toEditorItinerary(source, '2027-01-01')), source);
  assert.deepEqual(toEditorItinerary([], '2027-01-01'), { days: [] });
});

test('seat roundtrip retains blocked status, check-in and booking ownership metadata', () => {
  const saved = [{ seatNumber: '1', status: 'BOOKED', checkedIn: true, bookedBy: 'customer', bookingId: 'booking' }, { seatNumber: '2', status: 'BLOCKED', checkedIn: false }];
  const rows = buildSeatRows(3, [], saved, 1);
  const payload = toSeatPayload(rows);
  assert.deepEqual(payload[0], saved[0]);
  assert.deepEqual(payload[1], saved[1]);
  assert.equal(payload[2].status, 'AVAILABLE');
});

test('passenger matches retain identifiers without inventing check-in', () => {
  const rows = buildSeatRows(2, [{ id: 'row', seatNumber: 1, name: 'Traveler', customerId: 'customer', bookingRecordId: 'booking' }], [], 1);
  const payload = toSeatPayload(rows);
  assert.equal(payload[0].status, 'BOOKED'); assert.equal(payload[0].checkedIn, false);
  assert.equal(payload[0].bookingId, 'booking'); assert.equal(payload[0].bookedBy, 'customer');
});
