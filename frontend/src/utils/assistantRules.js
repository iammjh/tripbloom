// Client-side rules for the customer assistant panel. The server validates the same limits again (backend/service/assistant.service.js).

export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_HISTORY_MESSAGES = 10;

// A message can be sent when its trimmed length is 1 to 1000 characters.
export function isSendable(text) {
  const length = String(text ?? '').trim().length;
  return length >= 1 && length <= MAX_MESSAGE_LENGTH;
}

// The history sent with each request: only user and assistant turns with text, and only the most recent ones.
export function buildHistoryForRequest(messages) {
  return (messages || [])
    .filter(item => (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map(item => ({ role: item.role, content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH) }));
}

// Starting questions shown in the panel: package questions first, then destination questions.
export const suggestedPrompts = [
  'Show me packages for a family of four',
  'Which package is best for a short weekend trip?',
  'Tell me about Sundarbans',
  'Tell me about Cox\'s Bazar',
];
