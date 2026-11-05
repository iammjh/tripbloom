import { Message } from '../model/message.model.js';
import { sendMessage } from '../service/message.service.js';
import { isAdmin, userId, bookingParticipants, requireBookingAccess, requireDepartureAccess, requireSupportPair } from '../service/access.service.js';
import { domainError } from '../service/reservation.service.js';
const involved = actor => ({ $or: [{ senderId: actor.id }, { recipientId: actor.id }] });
const load = query => Message.find(query).sort({ sentAt: 1 }).populate('senderId', 'fullName').populate('recipientId', 'fullName');
const endpoint = fn => async (req, res) => {
 try { await fn(req, res); }
 catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to process messages.' }); }
};
export const sendMessageController = endpoint(async (req, res) => {
 const { tourId, bookingId, isBroadcast = false } = req.body;
 const content = req.body.content || req.body.messageText;
 const recipientId = req.body.recipientId || req.body.receiverId;
 if (typeof content !== 'string' || !content.trim() || content.length > 5000 || typeof isBroadcast !== 'boolean') throw domainError('Message text (up to 5000 characters) is required.');
 // A spoofed sender is never stored, even when a legacy caller includes senderId.
 if (req.body.senderId && req.body.senderId !== req.user.id) throw domainError('Cannot send as another user.', 403);
 if (isBroadcast) {
   if (!tourId || recipientId || bookingId) throw domainError('Broadcasts require a departure and no direct recipient.');
   const { assigned } = await requireDepartureAccess(tourId, req.user);
   if (!isAdmin(req.user) && !assigned) throw domainError('Only assigned operators or administrators can broadcast.', 403);
 } else {
   if (!recipientId) throw domainError('A recipient is required.');
   if (bookingId) {
     const booking = await requireBookingAccess(bookingId, req.user);
     const participants = await bookingParticipants(booking);
     if (tourId && userId(booking.groupDepartureId) !== tourId) throw domainError('Booking and departure do not match.');
     if (!isAdmin(req.user) && !participants.includes(recipientId)) await requireSupportPair(req.user, recipientId);
   } else if (tourId) {
     await requireDepartureAccess(tourId, req.user);
     // Both participants must belong to the departure unless one is a support administrator.
     const recipient = { id: recipientId, roles: [] };
     try { await requireDepartureAccess(tourId, recipient); }
     catch (error) { if (error.status !== 403) throw error; await requireSupportPair(req.user, recipientId); }
   } else await requireSupportPair(req.user, recipientId);
 }
 const result = await sendMessage({ tourId, bookingId, senderId: req.user.id, recipientId, content: content.trim(), isBroadcast });
 if (result.error) throw domainError(result.error);
 res.json({ success: true, message: 'Message sent.', data: result.message });
});
export const getMessagesController = endpoint(async (req, res) => {
 const { tourId, recipientId } = req.query;
 if (recipientId && recipientId !== req.user.id && !isAdmin(req.user)) throw domainError('Inbox access denied.', 403);
 let query;
 if (tourId) {
   await requireDepartureAccess(tourId, req.user);
   query = isAdmin(req.user) ? { tourId } : { tourId, $or: [{ isBroadcast: true }, { senderId: req.user.id }, { recipientId: req.user.id }] };
   if (recipientId) query.recipientId = recipientId;
 } else if (recipientId) query = { recipientId };
 else query = involved(req.user);
 res.json({ success: true, messages: await load(query) });
});
export const getBookingMessagesController = endpoint(async (req, res) => {
 await requireBookingAccess(req.params.bookingId, req.user);
 const query = { bookingId: req.params.bookingId, ...(!isAdmin(req.user) ? involved(req.user) : {}) };
 res.json({ success: true, messages: await load(query) });
});
export const getBroadcastMessagesController = endpoint(async (req, res) => {
 if (!req.query.tourId) throw domainError('Departure ID is required.');
 await requireDepartureAccess(req.query.tourId, req.user);
 res.json({ success: true, messages: await load({ tourId: req.query.tourId, isBroadcast: true }) });
});
export const getConversationController = endpoint(async (req, res) => {
 const { userA, userB } = req.query;
 if (!userA || !userB) throw domainError('userA and userB are required.');
 if (!isAdmin(req.user) && ![userA, userB].includes(req.user.id)) throw domainError('Conversation access denied.', 403);
 // Pair filtering is sufficient for historical chats: only the two participants or an administrator can read them.
 res.json({ success: true, messages: await load({ $or: [{ senderId: userA, recipientId: userB }, { senderId: userB, recipientId: userA }] }) });
});
