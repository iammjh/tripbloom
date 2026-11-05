import rateLimit from 'express-rate-limit';

// Limits per client address. app.set('trust proxy', 1) makes req.ip the visitor's address behind the host's proxy.
// Limits can be changed with environment variables without a code change.
const minutes = value => value * 60 * 1000;
const number = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const json = message => ({ success: false, message });

// Only failed sign-ins count, so a user who signs in normally is never locked out by their own use.
export const loginLimiter = rateLimit({
  windowMs: minutes(15),
  limit: number('LOGIN_RATE_LIMIT', 20),
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many sign-in attempts. Please wait a few minutes and try again.')
});

export const signupLimiter = rateLimit({
  windowMs: minutes(60),
  limit: number('SIGNUP_RATE_LIMIT', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many sign-up attempts from this network. Please try again later.')
});

export const contactLimiter = rateLimit({
  windowMs: minutes(60),
  limit: number('CONTACT_RATE_LIMIT', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many messages from this network. Please try again later.')
});

export const newsletterLimiter = rateLimit({
  windowMs: minutes(60),
  limit: number('NEWSLETTER_RATE_LIMIT', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many sign-up requests from this network. Please try again later.')
});
