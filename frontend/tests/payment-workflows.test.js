import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentTotals } from '../src/utils/paymentAccounting.js';
test('customer balance distinguishes pending payments and positive refunds', () => {
 assert.deepEqual(paymentTotals({ finalAmount: 800, payments: [{ amount: 300, status: 'SUCCESS', method: 'BKASH' }, { amount: 100, status: 'SUCCESS', method: 'REFUND' }, { amount: 200, status: 'PENDING', method: 'CASH' }] }), { gross: 300, refunded: 100, net: 200, pending: 200, remaining: 500, availableToSubmit: 300 });
});
