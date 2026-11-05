// Module-level store so any file (including non-component helpers that used alert()) can call notify.* without a hook.
import { addNotification, dismissNotification, toneFor } from './notifyQueue.js';

let items = [];
let nextId = 1;
const listeners = new Set();

const emit = () => listeners.forEach(listener => listener());

function push(tone, message, title) {
  const item = { id: nextId++, tone, message: String(message ?? ''), title: title || null };
  items = addNotification(items, item);
  emit();
  return item.id;
}

export const notifyStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return items;
  },
};

export function dismissNotificationById(id) {
  items = dismissNotification(items, id);
  emit();
}

export const notify = {
  success: (message, title) => push('success', message, title),
  error: (message, title) => push('error', message, title),
  info: (message, title) => push('info', message, title),
  // Drop-in replacement for alert(): the tone is chosen from the wording. Use explicit methods where the tone is known.
  message: message => push(toneFor(message), message),
};
