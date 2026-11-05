import {
  adminConversation, bookingConversation, departureBroadcast, departureCustomerConversations,
  idOf, isAdminContact, mergeConversations
} from '../../utils/operatorMessages.js';

async function readJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url} failed with status ${res.status}`);
  return res.json();
}

// A failed thread should not hide the rest of the list, so each thread falls back to no messages.
const orEmpty = (promise, pick) => promise.then(pick).catch(() => []);

async function loadAdminConversations(operatorId) {
  const contacts = await readJson('/api/support/contacts');
  const users = Array.isArray(contacts) ? contacts : (contacts.users || []);
  const admins = users.filter(isAdminContact);
  const threads = await Promise.all(admins.map(admin => {
    const query = new URLSearchParams({ userA: operatorId, userB: idOf(admin) });
    return orEmpty(readJson(`/api/messages/conversation?${query}`), data => data.messages || [])
      .then(messages => ({ admin, messages }));
  }));
  return threads.map(({ admin, messages }) => adminConversation(admin, messages)).filter(Boolean);
}

// Loads every conversation the operator can see: group bookings, departure announcements and traveller threads,
// and administrator threads. Returns the departures (for the broadcast picker) and the merged conversation list.
export async function loadOperatorConversations(operatorId) {
  const dashboard = await readJson(`/api/operator/${operatorId}/dashboard`);
  const departures = dashboard.groupDepartures || [];

  // The bookings endpoint already limits an operator to their own group departures.
  const bookingsData = await readJson('/api/bookings');
  const bookings = (bookingsData.bookings || []).filter(booking => booking.bookingType === 'GROUP' || booking.groupDepartureId);

  const [bookingThreads, departureThreads, adminConversations] = await Promise.all([
    Promise.all(bookings.map(booking =>
      orEmpty(readJson(`/api/messages/booking/${idOf(booking)}`), data => data.messages || [])
        .then(messages => ({ booking, messages }))
    )),
    Promise.all(departures.map(tour =>
      orEmpty(readJson(`/api/messages?tourId=${idOf(tour)}`), data => data.messages || [])
        .then(messages => ({ tour, messages }))
    )),
    loadAdminConversations(operatorId).catch(() => [])
  ]);

  const conversations = [
    ...bookingThreads.map(({ booking, messages }) => bookingConversation(booking, messages, operatorId)).filter(Boolean),
    ...departureThreads.flatMap(({ tour, messages }) => [
      departureBroadcast(tour, messages),
      ...departureCustomerConversations(tour, messages, operatorId)
    ]).filter(Boolean),
    ...adminConversations
  ];

  return { departures, conversations: mergeConversations(conversations) };
}

// Messages for one conversation, fetched from the endpoint that owns that conversation type.
export async function loadThreadMessages(conversation, operatorId) {
  if (conversation.type === 'booking') {
    const data = await readJson(`/api/messages/booking/${conversation.bookingId}`);
    return data.messages || [];
  }
  if (conversation.type === 'admin') {
    const query = new URLSearchParams({ userA: operatorId, userB: conversation.adminId });
    const data = await readJson(`/api/messages/conversation?${query}`);
    return data.messages || [];
  }
  const data = await readJson(`/api/messages?tourId=${conversation.tourId}`);
  return data.messages || [];
}
