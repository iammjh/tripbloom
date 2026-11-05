import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MESSAGE_LENGTH, MAX_HISTORY_MESSAGES, isSendable, buildHistoryForRequest, suggestedPrompts } from '../src/utils/assistantRules.js';

test('a message is sendable only when its trimmed length is 1 to 1000 characters', () => {
  assert.equal(isSendable(''), false);
  assert.equal(isSendable('   '), false);
  assert.equal(isSendable(' hi '), true);
  assert.equal(isSendable('a'.repeat(MAX_MESSAGE_LENGTH)), true);
  assert.equal(isSendable('a'.repeat(MAX_MESSAGE_LENGTH + 1)), false);
});

test('the history sent with a request keeps only user and assistant entries and at most the last 10', () => {
  const messages = [
    { role: 'system', content: 'drop me' },
    ...Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })),
    { role: 'user', content: '' },
  ];
  const history = buildHistoryForRequest(messages);
  assert.equal(history.length, MAX_HISTORY_MESSAGES);
  assert.equal(history.at(-1).content, 'm11');
  assert.ok(history.every(item => item.role === 'user' || item.role === 'assistant'));
  assert.ok(!history.some(item => item.content === 'drop me'));
});

test('suggested prompts include a package question and a destination question starting "Tell me about"', () => {
  assert.ok(suggestedPrompts.length >= 4);
  assert.ok(suggestedPrompts.some(p => /package|family|trip/i.test(p)));
  assert.ok(suggestedPrompts.some(p => p.startsWith('Tell me about')));
});

test('a long earlier reply is shortened to 1000 characters in the history sent with a request', () => {
  const history = buildHistoryForRequest([{ role: 'assistant', content: 'c'.repeat(MAX_MESSAGE_LENGTH + 500) }]);
  assert.equal(history[0].content.length, MAX_MESSAGE_LENGTH);
});
