// HTTP layer for the customer assistant: validates the request, applies the per-client limit, and maps outcomes to responses.
import { askAssistant, validateChatInput, ASSISTANT_UNAVAILABLE_MESSAGE } from '../service/assistant.service.js';
import { createLimiter } from '../service/assistantLimiter.js';

const BUSY_MESSAGE = 'The assistant is busy right now. Please try again in a minute.';
const RATE_LIMIT_MESSAGE = 'You have asked many questions. Please wait a few minutes and try again.';

// The per-client limit alone cannot cap provider spend, because one caller can change address. This cap applies to all callers.
const DAILY_MESSAGE = 'The assistant has answered its daily limit of questions. Please try again tomorrow.';
const DAY_MS = 24 * 60 * 60 * 1000;
const dailyCap = () => {
  const parsed = Number(process.env.ASSISTANT_DAILY_LIMIT);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 300;
};

// Factory so tests can inject the assistant call and the limiters; the exported handler uses the real ones.
export function createChatController({
  askFn = askAssistant,
  limiter = createLimiter(),
  dailyLimiter = createLimiter({ limit: dailyCap(), windowMs: DAY_MS })
} = {}) {
  return async function chat(req, res) {
    const input = validateChatInput(req.body || {});
    if (!input.ok) return res.status(400).json({ success: false, message: input.message });

    const clientKey = req.ip || 'unknown';
    const allowance = limiter.consume(clientKey);
    if (!allowance.allowed) {
      res.set('Retry-After', String(allowance.retryAfterSeconds));
      return res.status(429).json({ success: false, message: RATE_LIMIT_MESSAGE });
    }

    const daily = dailyLimiter.consume('all');
    if (!daily.allowed) {
      res.set('Retry-After', String(daily.retryAfterSeconds));
      return res.status(429).json({ success: false, message: DAILY_MESSAGE });
    }

    try {
      const result = await askFn({ message: input.value.message, history: input.value.history });
      return res.status(200).json({ success: true, reply: result.reply, generatedAt: result.generatedAt });
    } catch (error) {
      // Configuration and provider failures share one visitor-facing message; details stay in the server log only.
      if (error?.code === 'ASSISTANT_RATE_LIMITED') {
        console.error('Customer assistant busy: provider rate limit');
        return res.status(503).json({ success: false, message: BUSY_MESSAGE });
      }
      if (error?.code === 'ASSISTANT_NOT_CONFIGURED' || error?.code === 'ASSISTANT_UPSTREAM_FAILED') {
        console.error('Customer assistant unavailable:', error.code, error.status ? `status=${error.status}` : '', error.detail ? `detail=${error.detail}` : '');
        return res.status(503).json({ success: false, message: ASSISTANT_UNAVAILABLE_MESSAGE });
      }
      console.error('Customer assistant failed:', error?.message || error);
      return res.status(503).json({ success: false, message: ASSISTANT_UNAVAILABLE_MESSAGE });
    }
  };
}

export const chatController = createChatController();
