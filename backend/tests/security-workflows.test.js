import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblem, registerUser, PASSWORD_MAX_BYTES } from '../service/user.service.js';
import { createContactController } from '../controller/contact.controller.js';
import { subscribeNewsletterController } from '../controller/newsletter.controller.js';
import { createChatController } from '../controller/assistant.controller.js';
import { createLimiter } from '../service/assistantLimiter.js';

function response() {
  return { statusCode: 200, headers: {}, set(name, value) { this.headers[name] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('passwords need 8 to 72 bytes', () => {
  assert.match(passwordProblem('short'), /at least 8/);
  assert.equal(passwordProblem('eightchr'), null);
  assert.match(passwordProblem('x'.repeat(PASSWORD_MAX_BYTES + 1)), /72 bytes/);
  assert.match(passwordProblem('é'.repeat(37)), /72 bytes/, 'multi-byte characters count by their bytes');
  assert.match(passwordProblem(12345678), /must be text/);
});

test('signup refuses a weak password, a bad email or a long name before touching the database', async () => {
  assert.match((await registerUser({ fullName: 'Rafi', email: 'rafi@example.com', password: 'a' })).error, /at least 8/);
  assert.match((await registerUser({ fullName: 'Rafi', email: 'not-an-email', password: 'longenough' })).error, /valid email/);
  assert.match((await registerUser({ fullName: 'x'.repeat(101), email: 'rafi@example.com', password: 'longenough' })).error, /100 characters/);
  assert.match((await registerUser({ fullName: 'Rafi', email: 'rafi@example.com', password: 'longenough', roles: ['ADMIN'] })).error, /customer accounts only/);
});

test('contact messages are checked for length and email format', async () => {
  const bad = [
    { name: 'Rafi', email: 'rafi@example.com', message: 'too short' },
    { name: 'x'.repeat(101), email: 'rafi@example.com', message: 'A long enough message' },
    { name: 'Rafi', email: 'rafi@@example', message: 'A long enough message' },
    { name: 'Rafi', email: { $ne: null }, message: 'A long enough message' },
    { name: 'Rafi', email: 'rafi@example.com', message: 'x'.repeat(2001) }
  ];
  for (const body of bad) {
    const res = response();
    await createContactController({ body }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(body).slice(0, 80));
  }
});

test('newsletter refuses a malformed address without storing anything', async () => {
  for (const body of [{}, { email: 'nope' }, { email: { $gt: '' } }, { email: 'x'.repeat(260) + '@example.com' }]) {
    const res = response();
    await subscribeNewsletterController({ body }, res);
    assert.equal(res.statusCode, 400);
  }
});

test('the assistant applies a daily cap across all callers', async () => {
  const controller = createChatController({
    askFn: async () => ({ reply: 'Hello', generatedAt: new Date().toISOString() }),
    limiter: createLimiter({ limit: 100 }),
    dailyLimiter: createLimiter({ limit: 1, windowMs: 60000 })
  });
  const first = response();
  await controller({ ip: '10.0.0.1', body: { message: 'Tell me about Sundarbans' } }, first);
  assert.equal(first.statusCode, 200);
  const second = response();
  await controller({ ip: '10.0.0.2', body: { message: 'Tell me about Cox Bazar' } }, second);
  assert.equal(second.statusCode, 429, 'a different address still hits the shared daily cap');
  assert.match(second.body.message, /daily limit/);
});
