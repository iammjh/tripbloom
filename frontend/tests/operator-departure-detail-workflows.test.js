import test from 'node:test';
import assert from 'node:assert/strict';
import { passengerRows, attendanceCounts, isSafetyComplete, incidentTone, SAFETY_ITEMS, EMPTY_SAFETY } from '../src/utils/operatorDeparture.js';

const booking = (overrides = {}) => ({
  _id: 'b1',
  bookingCode: 'RL001',
  status: 'CONFIRMED',
  travelers: [{ fullName: 'Rafi Ahmed', phone: '017000', phoneEmergency: '018000' }],
  reservedSeats: ['3'],
  payments: [{ status: 'SUCCESS' }],
  customerId: { _id: 'c1', phone: '019000' },
  ...overrides
});

test('passenger list leaves out cancelled and pending bookings', () => {
  const rows = passengerRows([
    booking({ _id: 'a', status: 'CONFIRMED' }),
    booking({ _id: 'b', status: 'CANCELLED' }),
    booking({ _id: 'c', status: 'PENDING' }),
    booking({ _id: 'd', status: 'COMPLETED' })
  ]);
  assert.deepEqual(rows.map(row => row.bookingRecordId), ['a', 'd']);
});

test('passenger rows show the stored booking code, not a browser sequence', () => {
  const [row] = passengerRows([booking({ bookingCode: 'RL042' })]);
  assert.equal(row.bookingLabel, 'RL042');
  const [fallback] = passengerRows([booking({ bookingCode: undefined, _id: '65a1b2c3d4e5f6a7b8c9d0e1' })]);
  assert.equal(fallback.bookingLabel, '#C9D0E1');
});

test('seat numbers come only from reservedSeats; an unreserved traveller has no seat', () => {
  const rows = passengerRows([booking({ travelers: [{ fullName: 'A' }, { fullName: 'B' }], reservedSeats: ['7'] })]);
  assert.equal(rows[0].seatNumber, 7);
  assert.equal(rows[1].seatNumber, null);
});

test('payment label and phone fall back in order', () => {
  const [paid] = passengerRows([booking()]);
  assert.equal(paid.paid, true);
  assert.equal(paid.paymentLabel, 'Paid');
  assert.equal(paid.phone, '017000');
  assert.equal(paid.emergencyContact, '018000');

  const [unpaid] = passengerRows([booking({ payments: [], travelers: [{ firstName: 'Lima', lastName: 'Khan' }] })]);
  assert.equal(unpaid.paymentLabel, 'CONFIRMED');
  assert.equal(unpaid.name, 'Lima Khan');
  assert.equal(unpaid.phone, '019000');
});

test('attendance counts check-ins against booked travellers', () => {
  const passengers = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(attendanceCounts(passengers, { a: true, b: false }), { booked: 3, checkedIn: 1, noShow: 2 });
  assert.deepEqual(attendanceCounts([], {}), { booked: 0, checkedIn: 0, noShow: 0 });
});

test('safety checklist is complete only when every item is ticked', () => {
  assert.equal(isSafetyComplete(EMPTY_SAFETY), false);
  const all = Object.fromEntries(SAFETY_ITEMS.map(item => [item.key, true]));
  assert.equal(isSafetyComplete(all), true);
  assert.equal(isSafetyComplete({ ...all, routePlanned: false }), false);
});

test('incident severity maps to a badge tone', () => {
  assert.equal(incidentTone('CRITICAL'), 'danger');
  assert.equal(incidentTone('high'), 'warning');
  assert.equal(incidentTone('LOW'), 'info');
  assert.equal(incidentTone('unknown'), 'neutral');
});
