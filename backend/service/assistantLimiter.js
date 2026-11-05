// Fixed-window request limiter kept in process memory. The backend runs as one instance, so per-instance
// counts are accurate; a multi-instance deployment would need a shared store (see specs/005 research.md section 5).

export function createLimiter({ limit = 20, windowMs = 600000, now = () => Date.now() } = {}) {
  const windows = new Map(); // clientKey -> { start, count }
  let lastPrune = now();

  // Drop windows that have already ended so memory stays bounded by the number of recent clients.
  function prune(current) {
    if (current - lastPrune < windowMs) return;
    lastPrune = current;
    for (const [key, window] of windows) {
      if (current - window.start >= windowMs) windows.delete(key);
    }
  }

  return {
    consume(clientKey) {
      const current = now();
      prune(current);
      let window = windows.get(clientKey);
      if (!window || current - window.start >= windowMs) {
        window = { start: current, count: 0 };
        windows.set(clientKey, window);
      }
      if (window.count >= limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((window.start + windowMs - current) / 1000));
        return { allowed: false, retryAfterSeconds };
      }
      window.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
