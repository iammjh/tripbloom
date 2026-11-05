import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bookingConversation, departureBroadcast, departureCustomerConversations, adminConversation, isAdminContact,
  mergeConversations, filterConversations, threadItems, sendPayload, relativeTime
} from '../src/utils/operatorMessages.js';

const OP = 'op1';
const CUSTOMER = 'cust1';
const OTHER = 'cust2';
const ADMIN = 'admin1';
const at = (minutesAgo, base = new Date('2027-01-10T12:00:00Z')) => new Date(base.getTime() - minutesAgo * 60000).toISOString();

const msg = (id, from, to, content, minutesAgo, extra = {}) => ({
  _id: id,
  senderId: typeof from === 'string' ? { _id: from, fullName: from === OP ? 'Operator' : 'Rafi' } : from,
  recipientId: to ? (typeof to === 'string' ? { _id: to, fullName: to === OP ? 'Operator' : 'Rafi' } : to) : null,
  content,
  sentAt: at(minutesAgo),
  ...extra
});

const tour = { _id: 'tour1', packageId: { title: 'Sundarbans Trip' } };

test('a booking without a customer is not listed; with one, its newest operator message is shown', () => {
  const booking = { _id: 'b1', customerId: { _id: CUSTOMER, fullName: 'Rafi' }, packageId: { title: 'Lake Tour' }, createdAt: at(500) };
  const messages = [msg('m1', CUSTOMER, OP, 'Is the bus AC?', 30), msg('m2', OP, CUSTOMER, 'Yes it is.', 10)];
  const conv = bookingConversation(booking, messages, OP);
  assert.equal(conv.id, 'booking-b1');
  assert.equal(conv.lastMessage, 'Yes it is.');
  assert.equal(bookingConversation({ _id: 'b2', customerId: null }, [], OP), null);
});

test('a booking with no operator messages shows the placeholder at the booking time', () => {
  const booking = { _id: 'b3', customerId: CUSTOMER, createdAt: at(120) };
  const conv = bookingConversation(booking, [msg('x', CUSTOMER, OTHER, 'Hello other guide', 5)], OP);
  assert.equal(conv.lastMessage, 'No messages yet');
  assert.equal(conv.timestamp.toISOString(), at(120));
});

test('traveller threads keep the NEWEST message per traveller, not the first one seen', () => {
  // Messages arrive oldest first; the old code kept the first message, so the list showed stale text.
  const messages = [
    msg('a', CUSTOMER, OP, 'First question', 90),
    msg('b', OP, CUSTOMER, 'Reply', 60),
    msg('c', CUSTOMER, OP, 'Latest question', 5)
  ];
  const convs = departureCustomerConversations(tour, messages, OP);
  assert.equal(convs.length, 1);
  assert.equal(convs[0].lastMessage, 'Latest question');
  assert.equal(convs[0].customerName, 'Rafi');
});

test('messages between two travellers, or announcements, do not create traveller threads', () => {
  const messages = [
    msg('a', CUSTOMER, OTHER, 'Hi there', 10),
    msg('b', CUSTOMER, null, 'Broadcast body', 8, { isBroadcast: true })
  ];
  assert.deepEqual(departureCustomerConversations(tour, messages, OP), []);
});

test('the departure broadcast shows the latest announcement, or nothing', () => {
  const messages = [
    msg('a', OP, null, 'Old announcement', 300, { isBroadcast: true }),
    msg('b', OP, null, 'Meet at 8 AM', 20, { isBroadcast: true }),
    msg('c', CUSTOMER, OP, 'Private', 5)
  ];
  const conv = departureBroadcast(tour, messages);
  assert.equal(conv.lastMessage, 'Meet at 8 AM');
  assert.equal(departureBroadcast(tour, [msg('d', CUSTOMER, OP, 'x', 1)]), null);
});

test('administrator threads list only when there are messages', () => {
  assert.equal(adminConversation({ _id: ADMIN, fullName: 'Support' }, []), null);
  const conv = adminConversation({ _id: ADMIN, fullName: 'Support' }, [msg('a', ADMIN, OP, 'Please check the bus', 4)]);
  assert.equal(conv.adminId, ADMIN);
  assert.equal(conv.lastMessage, 'Please check the bus');
});

test('admin contacts are recognised by role string or role list', () => {
  assert.equal(isAdminContact({ role: 'ADMIN' }), true);
  assert.equal(isAdminContact({ roles: ['admin'] }), true);
  assert.equal(isAdminContact({ roles: 'TOUR_OPERATOR' }), false);
  assert.equal(isAdminContact(null), false);
});

test('merge keeps the newest copy of each id and sorts newest first', () => {
  const merged = mergeConversations([
    { id: 'a', timestamp: new Date('2027-01-01') },
    { id: 'b', timestamp: new Date('2027-01-05') },
    { id: 'a', timestamp: new Date('2027-01-03') }
  ]);
  assert.deepEqual(merged.map(c => c.id), ['b', 'a']);
  assert.equal(merged[1].timestamp.toISOString(), new Date('2027-01-03').toISOString());
});

test('search matches the traveller name or tour name, ignoring case', () => {
  const list = [{ customerName: 'Rafi Ahmed', tourName: 'Sundarbans' }, { customerName: 'Lima', tourName: 'Cox Bazar' }];
  assert.equal(filterConversations(list, 'rafi').length, 1);
  assert.equal(filterConversations(list, 'COX').length, 1);
  assert.equal(filterConversations(list, '').length, 2);
});

test('booking threads show every message for the assigned operator, and only their own otherwise', () => {
  const messages = [msg('a', CUSTOMER, OP, 'Hi', 9), msg('b', CUSTOMER, OTHER, 'Not for you', 8)];
  const assigned = threadItems({ type: 'booking', assignedOperator: OP }, messages, OP);
  const unassigned = threadItems({ type: 'booking', assignedOperator: 'someone-else' }, messages, OP);
  assert.equal(assigned.length, 2);
  assert.equal(unassigned.length, 1);
  assert.equal(unassigned[0].sender, 'customer');
});

test('a traveller thread holds only messages between this operator and that traveller', () => {
  const messages = [
    msg('a', CUSTOMER, OP, 'Question', 9),
    msg('b', OP, CUSTOMER, 'Answer', 8),
    msg('c', OTHER, OP, 'Someone else', 7)
  ];
  const items = threadItems({ type: 'tour', customerId: CUSTOMER }, messages, OP);
  assert.deepEqual(items.map(item => [item.sender, item.text]), [['customer', 'Question'], ['operator', 'Answer']]);
});

test('announcement threads show only broadcasts, and other senders are labelled admin', () => {
  const messages = [msg('a', ADMIN, null, 'Admin announcement', 9, { isBroadcast: true }), msg('b', CUSTOMER, OP, 'Direct', 8)];
  const items = threadItems({ type: 'broadcast' }, messages, OP);
  assert.equal(items.length, 1);
  assert.equal(items[0].sender, 'admin');
});

test('administrator threads label the other side as admin', () => {
  const items = threadItems({ type: 'admin', adminId: ADMIN }, [msg('a', ADMIN, OP, 'Hello', 3)], OP);
  assert.equal(items[0].sender, 'admin');
});

test('send payloads bind to a booking, a departure, or an administrator', () => {
  const booking = sendPayload({ type: 'booking', bookingId: 'b1', customerId: CUSTOMER }, 'Hi', OP);
  assert.deepEqual(booking, { senderId: OP, recipientId: CUSTOMER, content: 'Hi', isBroadcast: false, bookingId: 'b1' });
  const traveller = sendPayload({ type: 'tour', tourId: 'tour1', customerId: CUSTOMER }, 'Hi', OP);
  assert.equal(traveller.tourId, 'tour1');
  assert.equal(traveller.bookingId, undefined);
  const admin = sendPayload({ type: 'admin', adminId: ADMIN, customerId: ADMIN }, 'Hi', OP);
  assert.equal(admin.tourId, undefined);
  assert.equal(admin.bookingId, undefined);
});

test('relative times read as just now, minutes, hours and then a date', () => {
  const now = new Date('2027-01-10T12:00:00Z');
  assert.equal(relativeTime(new Date(now.getTime() - 10 * 1000), now), 'Just now');
  assert.equal(relativeTime(new Date(now.getTime() - 5 * 60000), now), '5 min ago');
  assert.equal(relativeTime(new Date(now.getTime() - 3 * 3600000), now), '3 hr ago');
  assert.match(relativeTime(new Date(now.getTime() - 3 * 24 * 3600000), now), /Jan/);
});
