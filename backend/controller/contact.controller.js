import { ContactMessage } from '../model/contact.model.js';
import { logActivity } from '../service/activityLog.service.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Limits match what the administrator's inbox expects; anything longer is refused rather than cut short.
export async function createContactController(req, res) {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!name || !email || !message) return res.status(400).json({ success: false, message: 'name, email and message are required' });
    if (name.length > 100) return res.status(400).json({ success: false, message: 'Keep the name to 100 characters or fewer.' });
    if (email.length > 254 || !EMAIL.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    if (message.length < 10 || message.length > 2000) return res.status(400).json({ success: false, message: 'Your message must be between 10 and 2000 characters.' });
    const doc = new ContactMessage({ name, email, message });
    await doc.save();
    res.json({ success: true, message: 'Message received. We will contact you soon!', contactId: doc._id });
  } catch (err) {
    console.error('Failed to save contact message', err);
    res.status(500).json({ success: false, message: 'Failed to save message' });
  }
}

export async function listContactsController(req, res) {
  try {
    const items = await ContactMessage.find().sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, contacts: items });
  } catch (err) {
    console.error('Failed to list contacts', err);
    res.status(500).json({ success: false, message: 'Failed to load contacts' });
  }
}

export async function getContactController(req, res) {
  try {
    const { id } = req.params;
    const item = await ContactMessage.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, contact: item });
  } catch (err) {
    console.error('Failed to get contact', err);
    res.status(500).json({ success: false, message: 'Failed to get contact' });
  }
}

export async function markContactHandledController(req, res) {
  try {
    const { id } = req.params;
    const item = await ContactMessage.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    item.handled = true;
    await item.save();
    await logActivity({
      adminId: req.user?.id,
      action: 'CONTACT_RESOLVED',
      targetType: 'Contact',
      targetId: item._id,
      description: `Marked the message from ${item.name} as handled`,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to mark handled', err);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
}
