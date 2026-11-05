// Conversation and thread helpers for the operator messages screen. Pure functions, so they can be tested without a browser.
// Conversation types: 'booking' (one traveller on a group booking), 'tour' (one traveller on a departure, any booking),
// 'broadcast' (a departure announcement, read-only in the thread) and 'admin' (an administrator).

export const MESSAGE_LIMIT = 5000;

export const idOf = value => String(value?._id || value || '');

const involves = (message, operatorId) => idOf(message.senderId) === operatorId || idOf(message.recipientId) === operatorId;

// The conversation for a group booking. A booking with no customer cannot be messaged, so it is skipped.
export function bookingConversation(booking, messages, operatorId) {
  const customerId = idOf(booking.customerId);
  if (!customerId) return null;
  const last = [...messages].reverse().find(message => involves(message, operatorId));
  return {
    id: `booking-${idOf(booking)}`,
    type: 'booking',
    bookingId: idOf(booking),
    assignedOperator: idOf(booking.assignedOperator),
    customerId,
    customerName: booking.customerId?.fullName || booking.customerId?.name || 'Customer',
    tourName: booking.packageId?.title || 'Tour package',
    lastMessage: last ? last.content : 'No messages yet',
    timestamp: new Date(last ? last.sentAt : booking.createdAt),
    unread: 0
  };
}

// The latest announcement on a departure, if there is one.
export function departureBroadcast(tour, messages) {
  const broadcasts = messages.filter(message => message.isBroadcast);
  if (!broadcasts.length) return null;
  const last = broadcasts[broadcasts.length - 1];
  return {
    id: `broadcast-${idOf(tour)}`,
    type: 'broadcast',
    tourId: idOf(tour),
    customerId: null,
    customerName: 'All travellers',
    tourName: tour.packageId?.title || 'Tour',
    lastMessage: last.content,
    timestamp: new Date(last.sentAt),
    unread: 0
  };
}

// One conversation per traveller who has written to the operator on this departure. The newest message is shown.
export function departureCustomerConversations(tour, messages, operatorId) {
  const latestByCustomer = new Map();
  messages.forEach(message => {
    if (message.isBroadcast || !involves(message, operatorId)) return;
    const sender = idOf(message.senderId);
    const recipient = idOf(message.recipientId);
    const customerId = sender === operatorId ? recipient : sender;
    if (!customerId || customerId === operatorId) return;
    const customer = recipient === customerId ? message.recipientId : message.senderId;
    const previous = latestByCustomer.get(customerId);
    if (!previous || new Date(message.sentAt) >= new Date(previous.timestamp)) {
      latestByCustomer.set(customerId, {
        id: `tour-${idOf(tour)}-${customerId}`,
        type: 'tour',
        tourId: idOf(tour),
        customerId,
        customerName: (typeof customer === 'object' && customer?.fullName) || 'Unknown traveller',
        tourName: tour.packageId?.title || 'Tour',
        lastMessage: message.content,
        timestamp: new Date(message.sentAt),
        unread: 0
      });
    }
  });
  return [...latestByCustomer.values()];
}

export function adminConversation(admin, messages) {
  if (!messages.length) return null;
  const last = messages[messages.length - 1];
  return {
    id: `admin-${idOf(admin)}`,
    type: 'admin',
    adminId: idOf(admin),
    customerId: idOf(admin),
    customerName: admin.fullName || admin.name || admin.email || 'Administrator',
    tourName: 'Support',
    lastMessage: last.content,
    timestamp: new Date(last.sentAt),
    unread: 0
  };
}

export function isAdminContact(user) {
  if (!user) return false;
  if (typeof user.role === 'string' && user.role.toUpperCase() === 'ADMIN') return true;
  const roles = Array.isArray(user.roles) ? user.roles : (typeof user.roles === 'string' ? [user.roles] : []);
  return roles.some(role => String(role || '').toUpperCase() === 'ADMIN');
}

// Keeps the newest entry for each id and sorts the list newest first.
export function mergeConversations(list) {
  const newest = new Map();
  list.forEach(conversation => {
    const previous = newest.get(conversation.id);
    if (!previous || conversation.timestamp > previous.timestamp) newest.set(conversation.id, conversation);
  });
  return [...newest.values()].sort((a, b) => b.timestamp - a.timestamp);
}

export function filterConversations(list, query) {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return list;
  return list.filter(conversation => `${conversation.customerName} ${conversation.tourName}`.toLowerCase().includes(term));
}

// The messages shown in one conversation, each with 'operator', 'customer' or 'admin' as sender.
export function threadItems(conversation, messages, operatorId) {
  const otherLabel = conversation.type === 'admin' ? 'admin' : 'customer';
  let scoped;
  if (conversation.type === 'broadcast') {
    scoped = messages.filter(message => message.isBroadcast);
  } else if (conversation.type === 'booking') {
    scoped = conversation.assignedOperator === operatorId ? messages : messages.filter(message => involves(message, operatorId));
  } else if (conversation.type === 'tour') {
    scoped = messages.filter(message => {
      const sender = idOf(message.senderId);
      const recipient = idOf(message.recipientId);
      return (sender === operatorId && recipient === conversation.customerId) || (recipient === operatorId && sender === conversation.customerId);
    });
  } else {
    scoped = messages;
  }
  return scoped.map(message => ({
    id: idOf(message),
    sender: idOf(message.senderId) === operatorId ? 'operator' : (conversation.type === 'broadcast' ? 'admin' : otherLabel),
    text: message.content,
    timestamp: new Date(message.sentAt)
  }));
}

// Request body for a one-to-one message. Broadcasts are sent from the broadcast panel instead.
export function sendPayload(conversation, content, operatorId) {
  const payload = { senderId: operatorId, recipientId: conversation.customerId, content, isBroadcast: false };
  if (conversation.type === 'booking' && conversation.bookingId) payload.bookingId = conversation.bookingId;
  else if (conversation.tourId) payload.tourId = conversation.tourId;
  return payload;
}

export function relativeTime(date, now = new Date()) {
  const diff = now - date;
  if (diff < 0 || Number.isNaN(diff)) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
