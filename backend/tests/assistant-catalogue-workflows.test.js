import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalogueSnapshot, buildCatalogueText } from '../service/assistant.service.js';

const NOW = new Date('2026-11-05T00:00:00.000Z');
const DAY = 86400000;
const pkg = { _id: 'p1', code: 'RL', title: 'Synthetic Group Lake', type: 'GROUP', basePrice: 22000, defaultDays: 3, defaultNights: 2, description: 'x', inclusions: { transport: 'Bus' }, extras: [], destinations: [], isInternational: false, assignedOperators: ['op-secret'], photos: ['p.jpg'], mapLocation: { lat: 1, lng: 2 } };

const departure = (overrides = {}) => ({
  _id: `d-${Math.random()}`, packageId: 'p1', status: 'OPEN',
  startDate: new Date(+NOW + 10 * DAY), endDate: new Date(+NOW + 13 * DAY),
  pricePerPerson: 22000, totalSeats: 10, bookedSeats: 4,
  operators: [{ operatorId: { fullName: 'Synthetic Operator Name' } }], seatMap: [{ seatNumber: '1' }],
  ...overrides,
});

test('full and closed departures are not offered to the assistant', async () => {
  const snapshot = await loadCatalogueSnapshot({
    now: () => NOW,
    loadPackages: async () => [pkg],
    loadDepartures: async () => [departure({ status: 'FULL' }), departure({ status: 'CLOSED' }), departure()],
  });
  assert.equal(snapshot[0].departures.length, 1);
  assert.equal(snapshot[0].departures[0].status, undefined);
});

test('seats left equal totalSeats minus bookedSeats and never go negative', async () => {
  const snapshot = await loadCatalogueSnapshot({
    now: () => NOW,
    loadPackages: async () => [pkg],
    loadDepartures: async () => [departure({ totalSeats: 10, bookedSeats: 4 }), departure({ totalSeats: 5, bookedSeats: 9 })],
  });
  const seats = snapshot[0].departures.map(d => d.seatsLeft).sort((a, b) => a - b);
  assert.deepEqual(seats, [0, 6]);
});

test('departures outside the next 90 days are excluded', async () => {
  const snapshot = await loadCatalogueSnapshot({
    now: () => NOW,
    loadPackages: async () => [pkg],
    loadDepartures: async () => [departure({ startDate: new Date(+NOW - DAY) }), departure({ startDate: new Date(+NOW + 91 * DAY) }), departure({ startDate: new Date(+NOW + 30 * DAY) })],
  });
  assert.equal(snapshot[0].departures.length, 1);
});

test('operator assignments, photos, map data and seat maps never reach the snapshot', async () => {
  const snapshot = await loadCatalogueSnapshot({ now: () => NOW, loadPackages: async () => [pkg], loadDepartures: async () => [departure()] });
  const serialised = JSON.stringify(snapshot);
  for (const forbidden of ['assignedOperators', 'op-secret', 'photos', 'mapLocation', 'Synthetic Operator Name', 'seatMap', 'operators']) {
    assert.ok(!serialised.includes(forbidden), `snapshot must not include ${forbidden}`);
  }
});

test('the catalogue text states the per-person price and each departure with its price and seats left', async () => {
  const snapshot = await loadCatalogueSnapshot({ now: () => NOW, loadPackages: async () => [pkg], loadDepartures: async () => [departure({ totalSeats: 10, bookedSeats: 4 })] });
  const text = buildCatalogueText(snapshot);
  assert.match(text, /Package RL: Synthetic Group Lake/);
  assert.match(text, /BDT 22,000 per person/);
  assert.match(text, /BDT 22,000 per person, 6 seats left/);
  assert.ok(!text.includes('Synthetic Operator Name'));
});

test('a personal tour with no departures says it is booked on request', async () => {
  const personal = { ...pkg, _id: 'p2', type: 'PERSONAL', category: 'GOLD', code: 'PT' };
  const snapshot = await loadCatalogueSnapshot({ now: () => NOW, loadPackages: async () => [personal], loadDepartures: async () => [] });
  assert.match(buildCatalogueText(snapshot), /personal tour booked on request/);
});
