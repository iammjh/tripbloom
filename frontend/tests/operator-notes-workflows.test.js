import test from 'node:test';
import assert from 'node:assert/strict';
import { saveOperatorNotes } from '../src/api/bookingOperations.js';
import { withOperatorNotes } from '../src/utils/operatorBookings.js';

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

test('saving notes sends a PATCH with the notes and returns the saved booking', async () => {
  let call;
  const request = async (url, options) => {
    call = { url, options };
    return jsonResponse({ success: true, booking: { _id: 'b1', operatorNotes: 'Vegetarian meals' } });
  };
  const saved = await saveOperatorNotes('b1', 'Vegetarian meals', request);
  assert.equal(call.url, '/api/bookings/b1/operator-notes');
  assert.equal(call.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(call.options.body), { operatorNotes: 'Vegetarian meals' });
  assert.equal(saved.operatorNotes, 'Vegetarian meals');
});

test('an empty note is saved as an empty string, not treated as missing', async () => {
  const request = async () => jsonResponse({ success: true, booking: { _id: 'b1', operatorNotes: '' } });
  const saved = await saveOperatorNotes('b1', '', request);
  assert.equal(saved.operatorNotes, '');
});

test('a refused save throws the server message', async () => {
  const request = async () => jsonResponse({ success: false, message: 'Forbidden: you are not assigned to this booking.' }, false);
  await assert.rejects(saveOperatorNotes('b1', 'x', request), /not assigned to this booking/);
});

test('a reply without a notes string is treated as a failed save', async () => {
  const request = async () => jsonResponse({ success: true, booking: { _id: 'b1' } });
  await assert.rejects(saveOperatorNotes('b1', 'x', request), /Failed to save operator notes/);
});

test('updating notes changes only the chosen booking', () => {
  const bookings = [
    { _id: 'b1', operatorNotes: '' },
    { _id: 'b2', operatorNotes: 'Keep' }
  ];
  const updated = withOperatorNotes(bookings, 'b1', 'Window seat');
  assert.equal(updated[0].operatorNotes, 'Window seat');
  assert.equal(updated[1], bookings[1]);
  assert.equal(bookings[0].operatorNotes, '', 'the original list must not be mutated');
});

test('updating notes for an unknown booking leaves the list as it was', () => {
  const bookings = [{ _id: 'b1', operatorNotes: 'A' }];
  const updated = withOperatorNotes(bookings, 'zzz', 'B');
  assert.deepEqual(updated, bookings);
});
