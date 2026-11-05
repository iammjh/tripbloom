import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../service/assistantLimiter.js';

test('the first 20 requests from one client in a window are allowed', () => {
  let now = 0;
  const limiter = createLimiter({ limit: 20, windowMs: 600000, now: () => now });
  for (let i = 0; i < 20; i++) assert.equal(limiter.consume('203.0.113.7').allowed, true);
});

test('the 21st request in the window is refused with a positive Retry-After', () => {
  let now = 0;
  const limiter = createLimiter({ limit: 20, windowMs: 600000, now: () => now });
  for (let i = 0; i < 20; i++) limiter.consume('203.0.113.7');
  const refused = limiter.consume('203.0.113.7');
  assert.equal(refused.allowed, false);
  assert.ok(refused.retryAfterSeconds > 0 && refused.retryAfterSeconds <= 600);
});

test('another client is not affected by one client reaching the limit', () => {
  let now = 0;
  const limiter = createLimiter({ limit: 2, windowMs: 600000, now: () => now });
  limiter.consume('a'); limiter.consume('a'); assert.equal(limiter.consume('a').allowed, false);
  assert.equal(limiter.consume('b').allowed, true);
});

test('the client is allowed again after the window has passed', () => {
  let now = 0;
  const limiter = createLimiter({ limit: 1, windowMs: 600000, now: () => now });
  assert.equal(limiter.consume('x').allowed, true);
  assert.equal(limiter.consume('x').allowed, false);
  now = 600001;
  assert.equal(limiter.consume('x').allowed, true);
});
