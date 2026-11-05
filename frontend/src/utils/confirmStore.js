// Promise-based replacement for window.confirm. `await confirmAction({...})` resolves true only when the user confirms.
export function normalizeOptions(input = {}) {
  const options = typeof input === 'string' ? { message: input } : input;
  return {
    title: options.title || 'Please confirm',
    message: options.message || '',
    confirmLabel: options.confirmLabel || 'Confirm',
    cancelLabel: options.cancelLabel || 'Cancel',
    danger: Boolean(options.danger),
  };
}

export function createConfirmStore() {
  let pending = null;
  const listeners = new Set();
  const emit = () => listeners.forEach(listener => listener());

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return pending ? pending.options : null;
    },
    ask(input) {
      return new Promise(resolve => {
        // A new question supersedes an unanswered one; the old promise resolves false.
        if (pending) pending.resolve(false);
        pending = { options: normalizeOptions(input), resolve };
        emit();
      });
    },
    answer(result) {
      if (!pending) return;
      const current = pending;
      pending = null;
      current.resolve(Boolean(result));
      emit();
    },
  };
}

export const confirmStore = createConfirmStore();

export function confirmAction(input) {
  return confirmStore.ask(input);
}
