// Chooses the text shown to a user for a failed request.
// Uses the server's own short sentence when it has one and it looks like prose. Never shows network text, stack traces, JSON or markup.
const MAX_SERVER_MESSAGE_LENGTH = 200;

export function userMessage(source, fallback) {
  let payload;
  if (source && source.response) payload = source.response.data;
  else if (source instanceof Error) payload = null;
  else if (source && typeof source === 'object' && 'data' in source) payload = source.data;
  else payload = source;

  let candidate = null;
  if (typeof payload === 'string') {
    try {
      candidate = JSON.parse(payload)?.message ?? null;
    } catch {
      candidate = null;
    }
  } else if (payload && typeof payload === 'object') {
    candidate = payload.message ?? null;
  }

  if (typeof candidate === 'string') {
    const text = candidate.trim();
    const looksLikeProse = text.length > 0
      && text.length <= MAX_SERVER_MESSAGE_LENGTH
      && !/[{}<>[\]]|\bstack\b|\bat\s+\S+:\d+/i.test(text);
    if (looksLikeProse) return text;
  }
  return fallback;
}
