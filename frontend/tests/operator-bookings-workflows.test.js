import test from 'node:test';
import assert from 'node:assert/strict';
import { operatorBookingsFor, filterOperatorBookings } from '../src/utils/operatorBookings.js';

const booking = (over = {}) => ({
  _id: '64b0000000000000000000a1', bookingType: 'GROUP', groupDepartureId: 'dep-1', status: 'CONFIRMED',
  startDate: new Date(2026, 10, 20), numTravelers: 2, customerId: { fullName: 'Synthetic Customer' },
  packageId: { title: 'Synthetic Lake Tour' }, ...over,
});

test('bookings are scoped to the operator\'s departures or to bookings assigned to them', () => {
  const list = [
    booking({ _id: 'a', groupDepartureId: 'dep-1' }),
    booking({ _id: 'b', groupDepartureId: 'dep-9' }),
    booking({ _id: 'c', groupDepartureId: null, bookingType: 'GROUP', assignedOperator: 'op-1' }),
    booking({ _id: 'd', groupDepartureId: null, bookingType: 'PRIVATE', assignedOperator: 'op-2' }),
  ];
  const mine = operatorBookingsFor(list, ['dep-1'], 'op-1');
  assert.deepEqual(mine.map(b => b._id).sort(), ['a', 'c']);
});

test('search matches the customer full name, the package title and the booking id', () => {
  const list = [booking({ _id: 'zz-unique-id' }), booking({ _id: 'b', customerId: { fullName: 'Other Person' }, packageId: { title: 'Sundarbans' } })];
  assert.deepEqual(filterOperatorBookings(list, { searchTerm: 'synthetic customer' }).map(b => b._id), ['zz-unique-id']);
  assert.deepEqual(filterOperatorBookings(list, { searchTerm: 'sundar' }).map(b => b._id), ['b']);
  assert.deepEqual(filterOperatorBookings(list, { searchTerm: 'zz-unique' }).map(b => b._id), ['zz-unique-id']);
});

test('type and status filters keep only matching bookings', () => {
  const list = [booking({ _id: 'g', bookingType: 'GROUP', status: 'CONFIRMED' }), booking({ _id: 'p', bookingType: 'PRIVATE', status: 'PENDING' })];
  assert.deepEqual(filterOperatorBookings(list, { typeFilter: 'PRIVATE' }).map(b => b._id), ['p']);
  assert.deepEqual(filterOperatorBookings(list, { statusFilter: 'CONFIRMED' }).map(b => b._id), ['g']);
});

test('the date range compares local calendar days', () => {
  const list = [booking({ _id: 'in', startDate: new Date(2026, 10, 20, 23, 30) }), booking({ _id: 'out', startDate: new Date(2026, 11, 2) })];
  assert.deepEqual(filterOperatorBookings(list, { dateRange: { start: '2026-11-20', end: '2026-11-21' } }).map(b => b._id), ['in']);
});
