import { NewsletterSubscriber } from '../model/newsletter.model.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The same answer for new and existing addresses, so the form cannot be used to check who has subscribed.
export async function subscribeNewsletterController(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL.test(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }
  try {
    await NewsletterSubscriber.updateOne({ email }, { $setOnInsert: { email, subscribedAt: new Date() } }, { upsert: true });
  } catch (error) {
    // A concurrent request for the same address hits the unique index; the subscription exists either way.
    if (error.code !== 11000) {
      console.error('Newsletter subscription failed');
      return res.status(500).json({ success: false, message: 'We could not save your subscription. Please try again.' });
    }
  }
  res.json({ success: true, message: 'Thanks for subscribing to the TripBloom newsletter.' });
}
