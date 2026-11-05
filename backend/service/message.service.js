import { Message } from '../model/message.model.js';

// Send a message (1-to-1 or broadcast)
export async function sendMessage({ tourId, senderId, recipientId, content, isBroadcast, bookingId }) {
  if (!senderId || !content) return { error: 'Missing required fields.' };
  
  const message = new Message({ 
    tourId, 
    senderId, 
    recipientId, 
    content, 
    isBroadcast,
    bookingId 
  });
  
  await message.save();
  await message.populate('senderId', 'fullName');
  await message.populate('recipientId', 'fullName');
  
  return { message };
}

// Get messages for a tour (optionally filter by recipient)
export async function getMessages({ tourId, recipientId }) {
  const query = { tourId };
  if (recipientId) query.recipientId = recipientId;
  return await Message.find(query)
    .sort({ sentAt: 1 })
    .populate('senderId', 'fullName')
    .populate('recipientId', 'fullName');
}

// Get messages for a specific booking
export async function getBookingMessages({ bookingId }) {
  const query = { bookingId };
  return await Message.find(query)
    .sort({ sentAt: 1 })
    .populate('senderId', 'fullName')
    .populate('recipientId', 'fullName');
}

// Get broadcast messages for a tour
export async function getBroadcastMessages({ tourId }) {
  return await Message.find({ tourId, isBroadcast: true })
    .sort({ sentAt: 1 })
    .populate('senderId', 'fullName');
}

// Get conversation between two users (both directions)
export async function getConversation({ userA, userB }) {
  if (!userA || !userB) return [];
  const query = {
    $or: [
      { senderId: userA, recipientId: userB },
      { senderId: userB, recipientId: userA }
    ]
  };
  return await Message.find(query)
    .sort({ sentAt: 1 })
    .populate('senderId', 'fullName')
    .populate('recipientId', 'fullName');
}
