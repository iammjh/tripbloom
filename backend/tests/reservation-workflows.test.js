import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { reserveBooking, bookingTransaction, cancellationRefund } from '../service/reservation.service.js';

test('invalid traveler counts, duplicate seats and nonnumeric points reject before writes', async () => {
 const base = { customerId: '64a000000000000000000001', packageId: '64a000000000000000000002', bookingType: 'GROUP', groupDepartureId: '64a000000000000000000003', startDate: new Date(Date.now() + 86400000), endDate: new Date(Date.now() + 3 * 86400000), numTravelers: 1, travelers: [{ fullName: 'Synthetic', age: 20 }] };
 for (const patch of [{ numTravelers: 1.5 }, { travelers: [] }, { reservedSeats: ['1', '1'] }, { pointsToUse: -1 }, { pointsToUse: '10' }, { currency: 'USD' }, { startDate: 'invalid' }]) assert.ok((await reserveBooking({ ...base, ...patch })).error);
});
test('unsupported transaction topology reports a service configuration error', async t => {
 t.mock.method(mongoose.connection, 'transaction', async () => { throw Object.assign(new Error('Transaction numbers are only allowed on a replica set'), { code: 20 }); });
 const result = await bookingTransaction(async () => assert.fail('Unsupported transaction executed'));
 assert.equal(result.status, 503); assert.match(result.error, /replica set/);
});
test('refund policy uses received money and preserves the existing boundary schedule', () => {
 const payment = { amount: 1000, status: 'SUCCESS', method: 'BKASH' };
 for (const [days, expected] of [[31, 1000], [30, 750], [15, 750], [14, 500], [7, 500], [6, 250], [3, 250], [2, 100], [1, 100], [-1, 0]]) {
  const booking = { startDate: new Date(Date.now() + days * 86400000 - 1000), payments: [payment, { amount: 500, status: 'PENDING', method: 'BKASH' }] };
  assert.equal(cancellationRefund(booking), expected, `days=${days}`);
 }
 assert.equal(cancellationRefund({ startDate: new Date(), payments: [payment] }, true), 1000);
});
