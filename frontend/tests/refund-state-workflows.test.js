import test from 'node:test';
import assert from 'node:assert/strict';
import { isRefundPending, refundStatusOf } from '../src/utils/refundState.js';

const paidCancelled = (refundAmount, refundProcessed = false) => ({
  status: 'CANCELLED',
  cancellation: { isCancelled: true, refundAmount, refundProcessed },
  payments: [{ method: 'BKASH', status: 'SUCCESS', amount: 1000 }],
});

test('a cancellation with money owed is a pending refund until it is recorded', () => {
  assert.equal(refundStatusOf(paidCancelled(1000)), 'PENDING_REFUND');
  assert.equal(isRefundPending(paidCancelled(1000)), true);
});

test('a cancellation with nothing owed is "no refund due" and never pending', () => {
  assert.equal(refundStatusOf(paidCancelled(0)), 'NO_REFUND');
  assert.equal(isRefundPending(paidCancelled(0)), false);
});

test('a recorded refund is refunded and no longer pending', () => {
  const recorded = { ...paidCancelled(1000, true), status: 'REFUNDED' };
  assert.equal(refundStatusOf(recorded), 'REFUNDED');
  assert.equal(isRefundPending(recorded), false);
});

test('an unpaid cancellation has no refund to track', () => {
  const unpaid = { ...paidCancelled(1000), payments: [] };
  assert.equal(isRefundPending(unpaid), false);
});
