import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listPublicPackages, getPublicPackage, getAvailableDepartures, getBookingSchedule,
} from '../src/api/catalog.js';

function transport(response) {
  const calls = [];
  return { calls, async get(path) { calls.push(path); return { data: response }; } };
}

test('catalog requests use public endpoints rather than administrator directories', async () => {
  const list = transport({ success: true, packages: [{ _id: 'tour' }] });
  assert.deepEqual(await listPublicPackages(list), [{ _id: 'tour' }]);
  assert.deepEqual(list.calls, ['/api/packages/search']);
  const detail = transport({ success: true, package: { _id: 'tour', title: 'Tour' } });
  assert.equal((await getPublicPackage('tour', detail)).title, 'Tour');
  assert.deepEqual(detail.calls, ['/api/packages/tour']);
});

test('available departures retain public IDs while exposing the existing UI _id shape', async () => {
  const api = transport({ success: true, departures: [
    { departureId: 'departure', totalSeats: 10, bookedSeats: 3, pricePerPerson: 200 },
  ] });
  const result = await getAvailableDepartures('tour', api);
  assert.equal(result[0]._id, 'departure');
  assert.equal(result[0].departureId, 'departure');
  assert.equal(result[0].pricePerPerson, 200);
  assert.deepEqual(api.calls, ['/api/packages/tour/departures/available']);
});

test('catalog failures and malformed payloads reject rather than invent bookable data', async () => {
  await assert.rejects(listPublicPackages(transport({ success: false, message: 'Rejected' })), /Rejected/);
  await assert.rejects(getPublicPackage('tour', transport({ success: true })), /package/i);
  await assert.rejects(getAvailableDepartures('tour', transport({ success: true })), /departure/i);
  await assert.rejects(getPublicPackage('tour', { async get() { throw new Error('network'); } }), /network/);
});

test('group booking schedule and amount come from the selected departure', () => {
  const result = getBookingSchedule({ type: 'GROUP', basePrice: 100 }, {
    startDate: '2030-01-10T00:00:00Z', endDate: '2030-01-14T00:00:00Z', pricePerPerson: 250,
  }, '', 2);
  assert.equal(result.startDate.toISOString(), '2030-01-10T00:00:00.000Z');
  assert.equal(result.endDate.toISOString(), '2030-01-14T00:00:00.000Z');
  assert.equal(result.totalAmount, 500);
});

test('personal booking schedule uses modeled defaultDays rather than an absent duration field', () => {
  const result = getBookingSchedule({ type: 'PERSONAL', basePrice: 100, defaultDays: 5 }, null,
    '2030-01-10T00:00:00Z', 2);
  assert.equal(result.endDate.toISOString(), '2030-01-15T00:00:00.000Z');
  assert.equal(result.totalAmount, 200);
});

test('invalid booking schedules reject without silently supplying fabricated dates or prices', () => {
  assert.throws(() => getBookingSchedule({ type: 'GROUP', basePrice: 100 }, null, '', 1), /departure/i);
  assert.throws(() => getBookingSchedule({ type: 'PERSONAL', basePrice: 100, defaultDays: 0 }, null,
    '2030-01-10', 1), /duration/i);
  assert.throws(() => getBookingSchedule({ type: 'PERSONAL', basePrice: 100, defaultDays: 5 }, null,
    'not-a-date', 1), /date/i);
});
