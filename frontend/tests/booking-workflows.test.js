import test from 'node:test';
import assert from 'node:assert/strict';
import { saveOperatorNotes } from '../src/api/bookingOperations.js';

test('notes send PATCH with only operatorNotes and use the persisted response', async () => {
 let request;
 const result = await saveOperatorNotes('booking-id', 'draft', async (url, options) => {
   request = { url, options };
   return { ok: true, json: async () => ({ success: true, booking: { _id: 'booking-id', operatorNotes: 'persisted' } }) };
 });
 assert.equal(request.url, '/api/bookings/booking-id/operator-notes');
 assert.equal(request.options.method, 'PATCH');
 assert.deepEqual(JSON.parse(request.options.body), { operatorNotes: 'draft' });
 assert.equal(result.operatorNotes, 'persisted');
});

test('notes failure rejects instead of reporting success', async () => {
 await assert.rejects(saveOperatorNotes('id', 'draft', async () => ({ ok: false, json: async () => ({ success: false, message: 'Not assigned' }) })), /Not assigned/);
 await assert.rejects(saveOperatorNotes('id', 'draft', async () => ({ ok: true, json: async () => ({ success: false, message: 'Save failed' }) })), /Save failed/);
 await assert.rejects(saveOperatorNotes('id', 'draft', async () => ({ ok: true, json: async () => ({ success: true }) })), /save/i);
});

test('empty notes are an intentional clear operation', async () => {
 const result = await saveOperatorNotes('id', '', async () => ({ ok: true, json: async () => ({ success: true, booking: { operatorNotes: '' } }) }));
 assert.equal(result.operatorNotes, '');
});
