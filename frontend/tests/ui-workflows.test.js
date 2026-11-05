import test from 'node:test';
import assert from 'node:assert/strict';
import { statusTone, statusLabel, toneClasses } from '../src/utils/statusTone.js';
import { addNotification, dismissNotification, shouldAutoDismiss, toneFor, MAX_VISIBLE } from '../src/utils/notifyQueue.js';
import { createConfirmStore, normalizeOptions } from '../src/utils/confirmStore.js';
import { nextFocusIndex, FOCUSABLE_SELECTOR } from '../src/utils/focusTrap.js';
import { userMessage } from '../src/utils/errorMessage.js';

test('status tones are case and separator insensitive across bookings, payments, reviews, roles and KYC', () => {
  assert.equal(statusTone('CONFIRMED'), 'success');
  assert.equal(statusTone('confirmed'), 'success');
  assert.equal(statusTone('PENDING'), 'warning');
  assert.equal(statusTone('cancelled'), 'danger');
  assert.equal(statusTone('CANCELLED'), 'danger');
  assert.equal(statusTone('REFUNDED'), 'info');
  assert.equal(statusTone('tour_operator'), 'info');
  assert.equal(statusTone('Tour Operator'), 'info');
  assert.equal(statusTone('ADMIN'), 'brand');
  assert.equal(statusTone('CUSTOMER'), 'neutral');
  assert.equal(statusTone(undefined), 'neutral');
  assert.equal(statusTone(null), 'neutral');
});

test('status labels read as sentences and unknown values stay readable', () => {
  assert.equal(statusLabel('TOUR_OPERATOR'), 'Tour operator');
  assert.equal(statusLabel('pending'), 'Pending');
  assert.equal(statusLabel(''), 'Unknown');
  assert.equal(statusLabel(undefined), 'Unknown');
});

test('every tone has token-based classes and unknown tones fall back to neutral', () => {
  for (const tone of ['success', 'warning', 'danger', 'info', 'brand', 'neutral']) {
    assert.match(toneClasses(tone), /text-/);
    assert.doesNotMatch(toneClasses(tone), /#[0-9a-f]{3,6}/i);
  }
  assert.equal(toneClasses('unknown'), toneClasses('neutral'));
});

test('notifications keep the newest three and dismiss the oldest auto-dismissing ones first', () => {
  const item = (id, tone = 'success') => ({ id, tone, message: `m${id}` });
  let items = [];
  for (let id = 1; id <= 4; id++) items = addNotification(items, item(id));
  assert.equal(items.length, MAX_VISIBLE);
  assert.deepEqual(items.map(entry => entry.id), [2, 3, 4]);
});

test('an unread error is not pushed out by routine success messages', () => {
  let items = [item(1, 'error')];
  items = addNotification(items, item(2));
  items = addNotification(items, item(3));
  items = addNotification(items, item(4));
  assert.ok(items.some(entry => entry.id === 1), 'error should remain visible');
  assert.equal(items.length, MAX_VISIBLE);
});

test('when every visible notification is an error, the newest still shows', () => {
  let items = [item(1, 'error'), item(2, 'error'), item(3, 'error')];
  items = addNotification(items, item(4, 'error'));
  assert.deepEqual(items.map(entry => entry.id), [2, 3, 4]);
});

test('errors persist, other tones auto-dismiss, and dismissing removes one item', () => {
  assert.equal(shouldAutoDismiss({ tone: 'error' }), false);
  assert.equal(shouldAutoDismiss({ tone: 'success' }), true);
  assert.deepEqual(dismissNotification([item(1), item(2)], 1).map(entry => entry.id), [2]);
});

test('alert wording maps to a tone so migrated messages keep their meaning', () => {
  assert.equal(toneFor('Failed to submit review: network'), 'error');
  assert.equal(toneFor('Please login to submit a review.'), 'error');
  assert.equal(toneFor('Booking cancelled successfully'), 'success');
  assert.equal(toneFor('Thanks — your review was submitted and is pending moderation.'), 'success');
  assert.equal(toneFor('Starting the export'), 'info');
});

test('confirmation resolves true only when answered yes and false when superseded or cancelled', async () => {
  const store = createConfirmStore();
  const first = store.ask('Delete?');
  assert.equal(store.getSnapshot().message, 'Delete?');
  store.answer(true);
  assert.equal(await first, true);
  assert.equal(store.getSnapshot(), null);

  const second = store.ask({ message: 'Cancel booking?', danger: true });
  const third = store.ask({ message: 'Approve refund?' });
  assert.equal(await second, false, 'superseded question resolves false');
  store.answer(false);
  assert.equal(await third, false);
});

test('confirmation defaults are safe and labelled', () => {
  const options = normalizeOptions('Are you sure?');
  assert.equal(options.message, 'Are you sure?');
  assert.equal(options.danger, false);
  assert.equal(options.cancelLabel, 'Cancel');
  assert.equal(normalizeOptions({ danger: true }).confirmLabel, 'Confirm');
});

test('focus moves forward and backward and wraps at both ends', () => {
  assert.equal(nextFocusIndex(0, 3), 1);
  assert.equal(nextFocusIndex(2, 3), 0);
  assert.equal(nextFocusIndex(0, 3, true), 2);
  assert.equal(nextFocusIndex(-1, 3), 0);
  assert.equal(nextFocusIndex(-1, 3, true), 2);
  assert.equal(nextFocusIndex(0, 0), -1);
});

test('the focusable selector excludes disabled controls and hidden inputs', () => {
  assert.match(FOCUSABLE_SELECTOR, /button:not\(\[disabled\]\)/);
  assert.match(FOCUSABLE_SELECTOR, /input:not\(\[disabled\]\):not\(\[type="hidden"\]\)/);
});

test('failed requests show the server sentence only when it is safe prose', () => {
  const fallback = 'We could not save that. Please try again.';
  const axiosError = message => Object.assign(new Error('Request failed with status code 500'), { response: { data: { message } } });
  assert.equal(userMessage(axiosError('Refund reference already recorded.'), fallback), 'Refund reference already recorded.');
  assert.equal(userMessage(axiosError('<html>boom</html>'), fallback), fallback);
  assert.equal(userMessage(axiosError('{"stack":"x"}'), fallback), fallback);
  assert.equal(userMessage(new Error('Network Error'), fallback), fallback, 'network text is never shown');
  assert.equal(userMessage({ message: 'Booking is not cancelled.' }, fallback), 'Booking is not cancelled.');
  assert.equal(userMessage('{"message":"Seat already booked."}', fallback), 'Seat already booked.');
  assert.equal(userMessage('Internal server error at /app.js:12:4', fallback), fallback);
  assert.equal(userMessage(undefined, fallback), fallback);
  assert.equal(userMessage(axiosError('x'.repeat(250)), fallback), fallback);
});

function item(id, tone = 'success') {
  return { id, tone, message: `m${id}` };
}
