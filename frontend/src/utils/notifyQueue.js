// Pure queue rules for in-page notifications. The store in notifyStore.js applies these and the Notifications component renders them.
export const MAX_VISIBLE = 3;
export const AUTO_DISMISS_MS = 5000;

// Errors stay until the user dismisses them; everything else times out.
export function shouldAutoDismiss(item) {
  return item.tone !== 'error';
}

// Keeps the newest MAX_VISIBLE items. A new item never pushes out an error that is still unread
// unless every visible item is an error, so the most important feedback is not hidden by routine messages.
export function addNotification(items, item) {
  const next = [...items, item];
  if (next.length <= MAX_VISIBLE) return next;
  const overflow = next.length - MAX_VISIBLE;
  const removable = next.slice(0, -1).filter(entry => shouldAutoDismiss(entry));
  const dropIds = new Set(removable.slice(0, overflow).map(entry => entry.id));
  if (dropIds.size < overflow) {
    // Every older item is an error: drop the oldest so the new one still shows.
    return next.slice(next.length - MAX_VISIBLE);
  }
  return next.filter(entry => !dropIds.has(entry.id));
}

export function dismissNotification(items, id) {
  return items.filter(entry => entry.id !== id);
}

// Migration helper: picks a tone from the wording of an existing alert() message.
const ERROR_WORDS = /\b(fail|failed|failure|error|unable|cannot|can't|could not|couldn't|invalid|denied|not allowed|required|must|missing|unavailable|not found|please|provide|select|log ?in|logged in|not logged|already assigned|no \w+ (found|selected|assigned|provided|recipient))\b/i;
const SUCCESS_WORDS = /\b(success|successfully|saved|submitted|created|updated|deleted|removed|approved|rejected|cancelled|canceled|sent|added|confirmed|thanks|complete|completed|verified|recorded|changed|applied|checked in)\b/i;

export function toneFor(message) {
  const text = String(message ?? '');
  if (ERROR_WORDS.test(text)) return 'error';
  if (SUCCESS_WORDS.test(text)) return 'success';
  return 'info';
}
