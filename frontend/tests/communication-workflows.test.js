import test from 'node:test';
import assert from 'node:assert/strict';
import { toDisplayReviews } from '../src/utils/reviewPresentation.js';
import { loadSystemSettings, saveSystemSettings } from '../src/api/settings.js';

test('approved populated API reviews become real display records and pending feedback stays unpublished', () => {
  const result = toDisplayReviews({ success: true, reviews: [
    { _id: 'live', status: 'APPROVED', customerId: { fullName: 'Verified traveler' }, rating: 5, comment: 'A real approved review.' },
    { _id: 'pending', status: 'PENDING', customerId: { fullName: 'Private' }, rating: 1, comment: 'Unpublished.' }
  ] });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'live');
  assert.equal(result[0].name, 'Verified traveler');
  assert.equal(result[0].comment, 'A real approved review.');
  assert.equal(result[0].rating, 5);
});

test('legacy formatted review arrays remain compatible and empty results stay empty', () => {
  assert.equal(toDisplayReviews([{ id: 1, name: 'Legacy traveler', rating: 4, comment: 'Published feedback', avatar: 'photo.jpg' }])[0].name, 'Legacy traveler');
  assert.deepEqual(toDisplayReviews({ success: true, reviews: [] }), []);
  assert.deepEqual(toDisplayReviews(null), []);
});

test('stored settings load and save through the existing endpoint with confirmed success', async () => {
  const payload = { cancellationRules: { enabled: true } };
  const calls = [];
  const client = {
    async get(path) { calls.push(path); return { data: { success: true, ...payload } }; },
    async post(path, body) { calls.push([path, body]); return { data: { success: true } }; }
  };
  assert.deepEqual((await loadSystemSettings(client)).cancellationRules, payload.cancellationRules);
  await saveSystemSettings(payload, client);
  assert.deepEqual(calls, ['/api/admin/settings', ['/api/admin/settings', payload]]);
});

test('settings errors reject rather than reporting a successful save', async () => {
  const offline = new Error('Network unavailable');
  await assert.rejects(saveSystemSettings({}, { async post() { throw offline; } }), /Network unavailable/);
  await assert.rejects(saveSystemSettings({}, { async post() { return { data: { success: false, message: 'Denied' } }; } }), /Denied/);
  await assert.rejects(loadSystemSettings({ async get() { return { data: {} }; } }), /load/i);
});
