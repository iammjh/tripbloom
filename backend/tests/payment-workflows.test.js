import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentTotals } from '../service/paymentAccounting.js';
import Booking from '../model/booking.model.js';

test('pending submissions, failed payments and refunds do not inflate receipts', () => {
 const booking = { finalAmount: 900, payments: [
  { amount: 300, method: 'BKASH', status: 'SUCCESS' },
  { amount: 100, method: 'REFUND', status: 'SUCCESS' },
  { amount: 500, method: 'BANK_TRANSFER', status: 'PENDING' },
  { amount: 700, method: 'CARD', status: 'FAILED' }
 ] };
 assert.deepEqual(paymentTotals(booking), { gross: 300, refunded: 100, net: 200, pending: 500, remaining: 600, availableToSubmit: 100 });
});
test('discounted final amount and legacy successful receipts remain supported', () => {
 const booking = new Booking({ totalAmount: 1000, finalAmount: 800, payments: [{ amount: 800, method: 'BANK_TRANSFER', status: 'SUCCESS' }, { amount: 200, method: 'REFUND', status: 'SUCCESS' }] });
 assert.equal(booking.totalPaid, 800);
 assert.equal(booking.netPaid, 600);
 assert.equal(booking.remainingAmount, 0);
});
test('empty and overpaid bookings have finite nonnegative balances', () => {
 assert.equal(paymentTotals({}).remaining, 0);
 assert.equal(paymentTotals({ finalAmount: 100, payments: [{ amount: 150, method: 'CASH', status: 'SUCCESS' }] }).remaining, 0);
});
