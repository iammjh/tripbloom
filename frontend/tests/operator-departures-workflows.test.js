import test from 'node:test';
import assert from 'node:assert/strict';
import { departureStatus, departureWarnings, tourType, filterDepartures } from '../src/utils/operatorDepartures.js';

const NOW = new Date(2026, 10, 6, 12, 0);
const day = (y, m, d) => new Date(y, m, d, 9, 0);
const dep = (over = {}) => ({
  _id: 'd', status: 'OPEN', startDate: day(2026, 10, 20), endDate: day(2026, 10, 23),
  bookedSeats: 3, totalSeats: 10, operators: [], packageId: { title: 'Synthetic Lake Tour', destination: 'Rangamati' },
  ...over,
});

test('a cancelled departure is shown as cancelled whatever its dates', () => {
  assert.equal(departureStatus(dep({ status: 'CANCELLED' }), NOW).label, 'CANCELLED');
  assert.equal(departureStatus(dep({ status: 'CANCELLED' }), NOW).tone, 'danger');
});

test('a departure under way is in progress, one that has ended is completed, and an open future one is scheduled', () => {
  assert.equal(departureStatus(dep({ startDate: day(2026, 10, 5), endDate: day(2026, 10, 8) }), NOW).label, 'IN PROGRESS');
  assert.equal(departureStatus(dep({ startDate: day(2026, 9, 1), endDate: day(2026, 9, 4) }), NOW).label, 'COMPLETED');
  assert.equal(departureStatus(dep(), NOW).label, 'SCHEDULED');
});

test('a full future departure is shown as full', () => {
  assert.equal(departureStatus(dep({ bookedSeats: 10, totalSeats: 10 }), NOW).label, 'FULL');
});

test('warnings flag overbooking, a missing itinerary within 24 hours, and several operators', () => {
  const soon = dep({ startDate: new Date(+NOW + 5 * 3600000), endDate: new Date(+NOW + 48 * 3600000) });
  assert.ok(departureWarnings(soon, NOW).includes('ITINERARY PENDING'));
  assert.ok(departureWarnings(dep({ bookedSeats: 11, totalSeats: 10 }), NOW).includes('OVERBOOKED'));
  assert.ok(departureWarnings(dep({ operators: [{ operatorId: 'a' }, { operatorId: 'b' }] }), NOW).includes('CO-GUIDE'));
  assert.deepEqual(departureWarnings(dep(), NOW), []);
});

test('an itinerary with stops removes the itinerary warning', () => {
  const soon = dep({ startDate: new Date(+NOW + 5 * 3600000), endDate: new Date(+NOW + 48 * 3600000), itinerary: [{ stops: [{ name: 'Stop' }] }] });
  assert.ok(!departureWarnings(soon, NOW).includes('ITINERARY PENDING'));
});

test('tour type is a day tour for one day and an n-day tour otherwise', () => {
  assert.equal(tourType(dep({ startDate: day(2026, 10, 20), endDate: day(2026, 10, 20) })), 'Day Tour');
  assert.equal(tourType(dep({ startDate: day(2026, 10, 20), endDate: day(2026, 10, 23) })), '3-Day Tour');
});

test('search matches the package title or destination', () => {
  const list = [dep({ _id: 'a' }), dep({ _id: 'b', packageId: { title: 'Sundarbans', destination: 'Khulna' } })];
  assert.deepEqual(filterDepartures(list, { searchTerm: 'rangamati' }, NOW).map(d => d._id), ['a']);
  assert.deepEqual(filterDepartures(list, { searchTerm: 'sundar' }, NOW).map(d => d._id), ['b']);
});

test('the status filter keeps only matching departures', () => {
  const list = [dep({ _id: 'a' }), dep({ _id: 'c', status: 'CANCELLED' })];
  assert.deepEqual(filterDepartures(list, { statusFilter: 'CANCELLED' }, NOW).map(d => d._id), ['c']);
  assert.deepEqual(filterDepartures(list, { statusFilter: 'SCHEDULED' }, NOW).map(d => d._id), ['a']);
});

test('the date range compares calendar days in the operator\'s local time', () => {
  const list = [dep({ _id: 'in', startDate: new Date(2026, 10, 20, 23, 30), endDate: new Date(2026, 10, 22, 9, 0) }), dep({ _id: 'out', startDate: day(2026, 11, 5), endDate: day(2026, 11, 8) })];
  const result = filterDepartures(list, { dateRange: { start: '2026-11-20', end: '2026-11-22' } }, NOW);
  assert.deepEqual(result.map(d => d._id), ['in']);
});
