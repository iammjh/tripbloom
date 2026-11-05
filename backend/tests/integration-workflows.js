// Runs only against a new loopback replica set. Never reads .env or accepts an external database URI.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Booking from '../model/booking.model.js';
import { User } from '../model/user.model.js';
import { TourPackage } from '../model/tourPackage.model.js';
import { GroupDeparture } from '../model/groupDeparture.model.js';
import { PaymentReceipt } from '../model/paymentReceipt.model.js';
import { ActivityLog } from '../model/admin.model.js';
import { Review } from '../model/review.model.js';
import KYC from '../model/kyc.model.js';
import { reserveBooking, domainError } from '../service/reservation.service.js';

const binary = process.env.MONGOD_BINARY;
assert.ok(binary && path.isAbsolute(binary), 'Set MONGOD_BINARY to an installed disposable mongod executable.');
await access(binary);
const temporary = await mkdtemp('/private/tmp/tripbloom-verification-');
const processes = [];
let server, vite, client;
const originalDirectory = process.cwd();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening'); const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); return port; }
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${checks}: ${name}`); }
try {
  const port = await freePort();
  const dbpath = path.join(temporary, 'database'); await mkdir(dbpath);
  const mongod = spawn(binary, ['--dbpath', dbpath, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'tripbloom_test', '--logpath', path.join(temporary, 'mongodb.log'), '--setParameter', 'diagnosticDataCollectionEnabled=false'], { stdio: ['ignore', 'ignore', 'pipe'] });
  processes.push(mongod); let mongoError = ''; mongod.stderr.on('data', chunk => { mongoError += chunk.toString(); });
  mongod.on('error', error => { mongoError += error.message; });
  const local = `mongodb://127.0.0.1:${port}`;
  console.log('Starting disposable loopback MongoDB replica set.');
  for (let attempt = 0; attempt < 80; attempt++) {
    if (mongod.exitCode !== null) throw new Error(`Disposable mongod stopped: ${mongoError}`);
    try { client = new mongoose.mongo.MongoClient(`${local}/?directConnection=true`, { serverSelectionTimeoutMS: 300 }); await client.connect(); break; }
    catch { await client?.close(); client = null; await pause(200); }
  }
  assert.ok(client, 'Disposable MongoDB did not become reachable.');
  await client.db('admin').command({ replSetInitiate: { _id: 'tripbloom_test', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
  for (let attempt = 0; attempt < 100; attempt++) { if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) break; await pause(200); }
  await client.close(); client = null;
  const uri = `${local}/tripbloom_disposable?replicaSet=tripbloom_test`;
  assert.equal(new URL(uri).hostname, '127.0.0.1');
  mongoose.set('bufferCommands', false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  process.env.JWT_SECRET = 'disposable-integration-secret-never-for-production';
  process.env.KYC_UPLOAD_DIR = path.join(temporary, 'kyc');
  const frontendPort = await freePort();
  process.env.FRONTEND_URL = `http://127.0.0.1:${frontendPort}`;
  const { default: app } = await import('../app.js');
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const password = 'Synthetic-test-password-42!';
  const hash = await bcrypt.hash(password, 10);
  const [customer, stranger, operator, unrelatedOperator, admin] = await User.create([
    { fullName: 'Synthetic Customer', email: 'customer@example.invalid', passwordHash: hash, roles: ['CUSTOMER'], rewardPoints: 100 },
    { fullName: 'Synthetic Other', email: 'other@example.invalid', passwordHash: hash, roles: ['customer'] },
    { fullName: 'Synthetic Guide', email: 'guide@example.invalid', passwordHash: hash, roles: ['TOUR_OPERATOR'] },
    { fullName: 'Synthetic Unassigned Guide', email: 'unassigned@example.invalid', passwordHash: hash, roles: ['tour_operator'] },
    { fullName: 'Synthetic Administrator', email: 'admin@example.invalid', passwordHash: hash, roles: ['admin'] }
  ]);
  const tokenFor = user => jwt.sign({ id: String(user._id), roles: user.roles, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const tokens = new Map([customer, stranger, operator, unrelatedOperator, admin].map(user => [String(user._id), tokenFor(user)]));
  const token = user => user && (typeof user === 'string' ? user : tokens.get(String(user._id)));
  const api = async (url, { actor, method = 'GET', body } = {}) => {
    const response = await fetch(base + url, { method, headers: { ...(actor ? { Authorization: `Bearer ${token(actor)}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, headers: response.headers };
  };
  const expect = (result, status) => { assert.equal(result.status, status, JSON.stringify(result.data)); return result.data; };
  // Synthetic landscape photo (inline SVG) so screenshots show a real image rather than a one-pixel placeholder.
  const landscapePhoto = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f5f57"/><stop offset="0.6" stop-color="#34d399"/><stop offset="1" stop-color="#fde68a"/></linearGradient></defs><rect width="1200" height="700" fill="url(#s)"/><circle cx="880" cy="250" r="90" fill="#fef3c7" opacity="0.85"/><path d="M0 460 L220 300 L400 420 L620 260 L860 430 L1040 320 L1200 420 L1200 700 L0 700Z" fill="#065f46"/><path d="M0 540 L300 430 L560 520 L820 420 L1200 540 L1200 700 L0 700Z" fill="#022c22"/></svg>');
  const [groupPackage, privatePackage] = await TourPackage.create([
    { title: 'Synthetic Group Tour', type: 'GROUP', basePrice: 1000, defaultDays: 3, defaultNights: 2, photos: ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='] },
    { title: 'Synthetic Private Tour', type: 'PERSONAL', category: 'SILVER', basePrice: 1000, defaultDays: 3, defaultNights: 2, inclusions: { transport: 'Private air-conditioned car with driver', hotel: '3-star hotels, twin sharing', meals: 'Daily breakfast', guide: true }, destinations: [{ name: 'Cox\'s Bazar', city: 'Cox\'s Bazar', country: 'Bangladesh', order: 1 }, { name: 'Sajek Valley', city: 'Sajek', country: 'Bangladesh', order: 2 }], extras: ['Sunset boat ride', 'Local cooking class'], photos: [landscapePhoto] }
  ]);
  const start = new Date(Date.now() + 40 * 86400000), end = new Date(+start + 3 * 86400000);
  const departure = await GroupDeparture.create({ packageId: groupPackage._id, startDate: start, endDate: end, totalSeats: 1, pricePerPerson: 1000, operators: [{ operatorId: operator._id, assignedBy: admin._id }], seatMap: [{ seatNumber: '1' }] });
  const bookingBody = (actor = customer, dep = departure) => ({ customerId: String(actor._id), packageId: String(groupPackage._id), bookingType: 'GROUP', groupDepartureId: String(dep._id), startDate: start.toISOString(), endDate: end.toISOString(), numTravelers: 1, travelers: [{ fullName: 'Synthetic Traveler', age: 30 }], totalAmount: 1, reservedSeats: ['1'] });
  const privateBody = actor => ({ ...bookingBody(actor), packageId: String(privatePackage._id), bookingType: 'PRIVATE', groupDepartureId: undefined, reservedSeats: [] });
  const makePrivate = async actor => expect(await api('/api/bookings', { actor, method: 'POST', body: privateBody(actor) }), 201).booking;
  await check('existing bcrypt login and safe public signup', async () => {
    const login = expect(await api('/api/login', { method: 'POST', body: { email: customer.email, passwordHash: password } }), 200); assert.ok(login.token); assert.equal(login.user.passwordHash, undefined);
    expect(await api('/api/signup', { method: 'POST', body: { fullName: 'Synthetic Signup', email: 'signup@example.invalid', passwordHash: password, roles: ['CUSTOMER'] } }), 200);
    expect(await api('/api/signup', { method: 'POST', body: { fullName: 'Attack', email: 'attack@example.invalid', passwordHash: password, roles: ['ADMIN'] } }), 400);
    const legacy = await User.create({ fullName: 'Legacy Synthetic', email: 'legacy@example.invalid', passwordHash: password, roles: ['customer'] });
    expect(await api('/api/login', { method: 'POST', body: { email: legacy.email, passwordHash: password } }), 200);
    assert.match((await User.findById(legacy._id)).passwordHash, /^\$2/);
  });
  await check('anonymous routes, ownership, stale roles and inactive accounts are denied', async () => {
    for (const url of ['/api/messages', '/api/admin/payments', '/api/stats/bookings']) expect(await api(url), 401);
    for (const url of [`/api/users/${customer._id}`, `/api/users/${customer._id}/saved`, `/api/customers/${customer._id}/stats`]) expect(await api(url, { actor: stranger }), 403);
    expect(await api(`/api/users/${customer._id}/password`, { actor: admin, method: 'PUT', body: { currentPassword: password, newPassword: password } }), 403);
    await User.updateOne({ _id: admin._id }, { $set: { roles: ['customer'] } }); expect(await api('/api/admin/payments', { actor: admin }), 403);
    await User.updateOne({ _id: admin._id }, { $set: { roles: ['ADMIN'] } });
    await User.updateOne({ _id: stranger._id }, { $set: { isActive: false } }); expect(await api(`/api/users/${stranger._id}`, { actor: stranger }), 401);
    await User.updateOne({ _id: stranger._id }, { $set: { isActive: true } });
    expect(await api('/api/messages?recipientId[$ne]=anything', { actor: customer }), 400);
    expect(await api('/api/bookings/not-an-id', { actor: customer }), 400);
  });
  let lastSeat;
  await check('admin role and suspension changes are guarded, audited and reachable from the user editor', async () => {
    expect(await api(`/api/admin/users/${admin._id}/role`, { actor: admin, method: 'PUT', body: { roles: ['CUSTOMER'] } }), 400);
    expect(await api(`/api/admin/users/${admin._id}/suspend`, { actor: admin, method: 'POST', body: { suspend: true } }), 400);
    expect(await api(`/api/admin/users/${stranger._id}/role`, { actor: admin, method: 'PUT', body: { roles: ['SUPERUSER'] } }), 400);
    const edited = expect(await api(`/api/admin/users/${stranger._id}`, { actor: admin, method: 'PUT', body: { fullName: 'Synthetic Renamed', roles: ['TOUR_OPERATOR'], isActive: false } }), 200);
    assert.equal(edited.user.fullName, 'Synthetic Renamed'); assert.deepEqual(edited.user.roles, ['TOUR_OPERATOR']); assert.equal(edited.user.isActive, false);
    expect(await api(`/api/admin/users/${stranger._id}`, { actor: admin, method: 'PUT', body: { isActive: true, roles: ['CUSTOMER'] } }), 200);
    const created = expect(await api('/api/admin/users', { actor: admin, method: 'POST', body: { fullName: 'Synthetic Created', email: 'created-by-admin@example.invalid', password: 'Synthetic-Password-1', roles: ['CUSTOMER'] } }), 200);
    assert.equal(created.user.passwordHash, undefined); assert.ok(await User.exists({ email: 'created-by-admin@example.invalid', passwordHash: { $exists: true, $ne: 'Synthetic-Password-1' } }));
    const logs = await ActivityLog.find({ targetId: stranger._id, action: { $in: ['ROLE_CHANGED', 'USER_SUSPENDED', 'USER_ACTIVATED'] } }).lean();
    assert.ok(logs.some(log => log.action === 'ROLE_CHANGED') && logs.some(log => log.action === 'USER_SUSPENDED'), JSON.stringify(logs.map(log => log.action)));
  });
  await check('administrator user mutations return no password hashes and invalidate old role claims', async () => {
    const role = expect(await api(`/api/admin/users/${stranger._id}/role`, { actor: admin, method: 'PUT', body: { roles: ['CUSTOMER'] } }), 200);
    assert.equal(role.user.passwordHash, undefined);
    const suspended = expect(await api(`/api/admin/users/${stranger._id}/suspend`, { actor: admin, method: 'POST', body: { suspend: true, reason: 'Synthetic suspension test' } }), 200);
    assert.equal(suspended.user.passwordHash, undefined);
    expect(await api(`/api/users/${stranger._id}`, { actor: stranger }), 401);
    expect(await api(`/api/admin/users/${stranger._id}/suspend`, { actor: admin, method: 'POST', body: { suspend: false } }), 200);
  });
  await check('ten competing final-seat reservations produce one correctly priced booking', async () => {
    const attempts = await Promise.all(Array.from({ length: 10 }, () => api('/api/bookings', { actor: customer, method: 'POST', body: bookingBody() })));
    assert.equal(attempts.filter(r => r.status === 201).length, 1, JSON.stringify(attempts));
    assert.ok(attempts.every(r => [201, 400].includes(r.status)), JSON.stringify(attempts));
    lastSeat = attempts.find(r => r.status === 201).data.booking;
    assert.equal(lastSeat.totalAmount, 1000); assert.equal(lastSeat.finalAmount, 1000);
    const stored = await GroupDeparture.findById(departure._id); assert.equal(stored.bookedSeats, 1); assert.equal(stored.status, 'FULL');
    assert.equal(stored.seatMap[0].status, 'BOOKED'); assert.equal(String(stored.seatMap[0].bookingId), lastSeat._id);
  });
  await check('booking/points/inventory roll back together after a late save failure', async () => {
    const spare = await GroupDeparture.create({ packageId: groupPackage._id, startDate: start, endDate: end, totalSeats: 2, pricePerPerson: 1000 });
    const before = await User.findById(customer._id); const count = await Booking.countDocuments();
    const original = Booking.prototype.save;
    Booking.prototype.save = async function(...args) { if (this.isNew) throw domainError('Synthetic persistence failure', 500); return original.apply(this, args); };
    try { const result = await reserveBooking({ ...bookingBody(customer, spare), pointsToUse: 20 }); assert.equal(result.status, 500); }
    finally { Booking.prototype.save = original; }
    assert.equal((await GroupDeparture.findById(spare._id)).bookedSeats, 0);
    assert.equal((await User.findById(customer._id)).rewardPoints, before.rewardPoints); assert.equal(await Booking.countDocuments(), count);
  });
  await check('cancellation is idempotent and capacity/seat ownership release exactly once', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => api(`/api/bookings/${lastSeat._id}/cancel`, { actor: customer, method: 'POST', body: { reason: 'Synthetic cancellation' } })));
    results.forEach(result => expect(result, 200));
    const stored = await GroupDeparture.findById(departure._id); assert.equal(stored.bookedSeats, 0); assert.equal(stored.seatMap[0].status, 'AVAILABLE'); assert.equal(stored.status, 'OPEN');
  });
  const first = await makePrivate(customer), second = await makePrivate(customer), third = await makePrivate(customer);
  const submit = async (booking, amount, ref, actor = customer) => api(`/api/bookings/${booking._id}/payment`, { actor, method: 'POST', body: { amount, method: 'BKASH', transactionRef: ref } });
  const verify = async (booking, payment, approved = true, actor = admin) => api(`/api/admin/bookings/${booking._id}/payments/${payment._id}/verify`, { actor, method: 'POST', body: { approved, notes: 'Synthetic external verification' } });
  await check('pending manual submissions are idempotent and never confirm or count as receipts', async () => {
    const results = await Promise.all([submit(first, 300, ' first-300 '), submit(first, 300, 'FIRST-300')]); results.forEach(r => expect(r, 200));
    const stored = await Booking.findById(first._id); assert.equal(stored.payments.length, 1); assert.equal(stored.payments[0].status, 'PENDING'); assert.equal(stored.totalPaid, 0); assert.equal(stored.status, 'PENDING');
    expect(await submit(first, 301, 'FIRST-300'), 409); expect(await submit(first, 701, 'TOO-MUCH'), 400); expect(await submit(first, -1, 'NEGATIVE'), 400); expect(await submit(first, 1.001, 'PRECISION'), 400);
    expect(await submit(first, 100, 'CROSS-USER', stranger), 403); expect(await verify(first, stored.payments[0], true, customer), 403);
    expect(await api(`/api/bookings/${first._id}/checkin`, { actor: customer, method: 'POST', body: {} }), 400);
    expect(await api(`/api/bookings/${first._id}/complete`, { actor: admin, method: 'POST' }), 400);
    const dashboard = expect(await api('/api/admin/dashboard', { actor: admin }), 200).dashboard; assert.equal(dashboard.revenue.gross, 0);
  });
  await check('administrator approval credits once, supports partial balances and confirms at finalAmount', async () => {
    const pending = (await Booking.findById(first._id)).payments[0];
    const approvals = await Promise.all([verify(first, pending), verify(first, pending)]); approvals.forEach(r => expect(r, 200));
    let stored = await Booking.findById(first._id); assert.equal(stored.totalPaid, 300); assert.equal(stored.status, 'PENDING'); assert.equal(await PaymentReceipt.countDocuments({ bookingId: first._id }), 1);
    assert.equal(String(stored.payments[0].verifiedBy), String(admin._id));
    expect(await verify(first, pending, false), 409);
    const rest = expect(await submit(first, 700, 'FINAL-700'), 200).payment;
    expect(await verify(first, rest), 200); stored = await Booking.findById(first._id); assert.equal(stored.status, 'CONFIRMED'); assert.equal(stored.remainingAmount, 0);
  });
  await check('rejection preserves FAILED status and permits a new reference', async () => {
    const pending = expect(await submit(second, 100, 'REJECTED'), 200).payment; expect(await verify(second, pending, false), 200);
    assert.equal(expect(await submit(second, 100, 'REJECTED'), 200).payment.status, 'FAILED'); expect(await verify(second, pending, true), 409);
  });
  await check('one normalized external receipt cannot credit two bookings concurrently or reuse legacy receipts', async () => {
    const a = expect(await submit(second, 100, 'SHARED-RECEIPT'), 200).payment;
    const b = expect(await submit(third, 100, ' shared-receipt '), 200).payment;
    const decisions = await Promise.all([verify(second, a), verify(third, b)]);
    assert.equal(decisions.filter(r => r.status === 200).length, 1); assert.equal(decisions.filter(r => r.status === 409).length, 1, JSON.stringify(decisions));
    assert.equal(await PaymentReceipt.countDocuments({ transactionRef: 'SHARED-RECEIPT' }), 1);
    await Booking.create({ customerId: customer._id, packageId: privatePackage._id, bookingType: 'PRIVATE', startDate: start, endDate: end, numTravelers: 1, travelers: [{ fullName: 'Legacy Synthetic', age: 20 }], totalAmount: 1000, finalAmount: 1000, payments: [{ amount: 100, method: 'BKASH', transactionRef: ' legacy-ref ', status: 'SUCCESS', paidAt: new Date() }] });
    const legacy = expect(await submit(second, 100, 'LEGACY-REF'), 200).payment; expect(await verify(second, legacy), 409); expect(await verify(second, legacy, false), 200);
  });
  await check('approval of a claim on an already refunded booking conflicts while rejection stays allowed', async () => {
    const booking = await makePrivate(customer); const claim = expect(await submit(booking, 100, 'REFUNDED-CLAIM'), 200).payment;
    await Booking.updateOne({ _id: booking._id }, { $set: { status: 'REFUNDED' } });
    const blocked = expect(await verify(booking, claim), 409); assert.match(blocked.message || '', /already refunded/);
    expect(await verify(booking, claim, false), 200); assert.equal((await Booking.findById(booking._id)).payments[0].status, 'FAILED');
  });
  await check('refund references cannot be reused across bookings and ledger rows point at the refund payment', async () => {
    const a = await makePrivate(customer), b = await makePrivate(customer);
    for (const booking of [a, b]) await Booking.updateOne({ _id: booking._id }, { $set: { status: 'CANCELLED', cancellation: { isCancelled: true, cancelledAt: new Date(), refundAmount: 100, refundProcessed: false }, payments: [{ amount: 100, method: 'BKASH', transactionRef: `PAID-${booking._id}`, status: 'SUCCESS', paidAt: new Date() }] } });
    const refund = (booking, transactionRef) => api(`/api/admin/bookings/${booking._id}/refund`, { actor: admin, method: 'POST', body: { transactionRef, notes: 'Synthetic completed transfer' } });
    expect(await refund(a, 'SHARED-REFUND'), 200);
    const conflict = expect(await refund(b, 'SHARED-REFUND'), 409); assert.match(conflict.message || '', /another booking/);
    assert.equal(await Booking.countDocuments({ _id: b._id, 'payments.method': 'REFUND' }), 0, 'rejected refund must not leave a partial write');
    const stored = await Booking.findById(a._id); const refundPayment = stored.payments.find(p => p.method === 'REFUND' && p.status === 'SUCCESS');
    const receipt = await PaymentReceipt.findOne({ bookingId: a._id, method: 'REFUND' });
    assert.equal(String(receipt.paymentId), String(refundPayment._id));
  });
  await check('cancelled pending receipts reconcile without reopening and manual refund is recorded once', async () => {
    const booking = await makePrivate(customer); const receipt = expect(await submit(booking, 1000, 'LATE-RECEIPT'), 200).payment;
    expect(await api(`/api/bookings/${booking._id}/cancel`, { actor: customer, method: 'POST', body: { reason: 'Before verification' } }), 200);
    expect(await verify(booking, receipt), 200);
    const cancelled = await Booking.findById(booking._id); assert.equal(cancelled.status, 'CANCELLED'); assert.equal(cancelled.cancellation.refundAmount, 1000);
    const refund = () => api(`/api/admin/bookings/${booking._id}/refund`, { actor: admin, method: 'POST', body: { transactionRef: 'MANUAL-REFUND', notes: 'Synthetic completed transfer' } });
    expect(await refund(), 200); expect(await refund(), 200);
    expect(await api(`/api/admin/bookings/${booking._id}/refund`, { actor: admin, method: 'POST', body: { transactionRef: 'DIFFERENT-REFUND' } }), 409);
    const stored = await Booking.findById(booking._id); assert.equal(stored.status, 'REFUNDED'); assert.equal(stored.totalPaid, 1000); assert.equal(stored.netPaid, 0); assert.equal(stored.payments.filter(p => p.method === 'REFUND' && p.status === 'SUCCESS').length, 1);
  });
  await check('message routes bind senders, scope participants and preserve support aliases', async () => {
    expect(await api('/api/messages', { actor: customer, method: 'POST', body: { senderId: String(stranger._id), recipientId: String(admin._id), content: 'Spoofed message' } }), 403);
    expect(await api('/api/messages/send', { actor: customer, method: 'POST', body: { receiverId: String(admin._id), messageText: 'Synthetic private support' } }), 200);
    expect(await api(`/api/messages?recipientId=${admin._id}`, { actor: stranger }), 403);
    expect(await api(`/api/messages/conversation?userA=${customer._id}&userB=${admin._id}`, { actor: stranger }), 403);
    const group = expect(await api('/api/bookings', { actor: customer, method: 'POST', body: bookingBody() }), 201).booking;
    expect(await api('/api/messages', { actor: operator, method: 'POST', body: { bookingId: group._id, recipientId: String(customer._id), content: 'Assigned guide message' } }), 200);
    expect(await api(`/api/messages/booking/${group._id}`, { actor: unrelatedOperator }), 403);
    const messages = expect(await api(`/api/messages/booking/${group._id}`, { actor: customer }), 200).messages; assert.equal(messages.length, 1); assert.equal(messages[0].senderId.email, undefined);
    expect(await api('/api/messages', { actor: customer, method: 'POST', body: { tourId: String(departure._id), isBroadcast: true, content: 'Forbidden broadcast' } }), 403);
    expect(await api('/api/messages', { actor: operator, method: 'POST', body: { tourId: String(departure._id), isBroadcast: true, content: 'Assigned departure broadcast' } }), 200);
    expect(await api(`/api/messages?tourId=${departure._id}`, { actor: unrelatedOperator }), 403);
  });
  await check('review moderation, pending visibility and public field projection are enforced', async () => {
    const review = await Review.create({ customerId: customer._id, packageId: privatePackage._id, rating: 4, comment: 'Synthetic private review text', moderatorNote: 'Private moderation note' });
    expect(await api(`/api/reviews/${review._id}`), 404);
    assert.equal(expect(await api('/api/reviews?status=PENDING'), 200).reviews.length, 0);
    assert.equal(expect(await api(`/api/reviews?customerId=${customer._id}`, { actor: customer }), 200).reviews.length, 1);
    expect(await api(`/api/reviews/${review._id}/moderate`, { actor: stranger, method: 'PATCH', body: { status: 'APPROVED' } }), 403);
    expect(await api(`/api/reviews/${review._id}`, { actor: stranger, method: 'PUT', body: { customerId: String(customer._id), rating: 1 } }), 403);
    expect(await api(`/api/reviews/${review._id}/moderate`, { actor: admin, method: 'PATCH', body: { status: 'APPROVED' } }), 200);
    const publicReview = expect(await api(`/api/reviews/${review._id}`), 200).review;
    for (const field of ['bookingId', 'moderatorNote']) assert.equal(publicReview[field], undefined);
    assert.equal(publicReview.customerId.email, undefined); assert.equal(publicReview.customerId._id, undefined); assert.equal(publicReview.customerId.fullName, customer.fullName);
  });
  await check('assignment routes reject non-admins and private KYC cannot be fetched by another user', async () => {
    expect(await api(`/api/group-departure/${departure._id}/assign-operators`, { actor: operator, method: 'POST', body: { operatorIds: [String(unrelatedOperator._id)] } }), 403);
    expect(await api(`/api/group-departure/operator/${operator._id}/future`, { actor: unrelatedOperator }), 403);
    expect(await api(`/api/admin/group-departures/${departure._id}/operators`, { actor: admin, method: 'POST', body: { operatorId: String(stranger._id) } }), 400);
    const filename = 'kyc-synthetic.png'; await writeFile(path.join(process.env.KYC_UPLOAD_DIR, filename), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVNcAAAAASUVORK5CYII=', 'base64'));
    await KYC.create({ user: customer._id, documentType: 'national_id', documentNumber: 'SYNTHETIC-ONLY', documentImage: `uploads/kyc/${filename}` });
    expect(await api(`/uploads/kyc/${filename}`), 401);
    expect(await api(`/uploads/kyc/${filename}`, { actor: stranger }), 404);
    const owned = await api(`/uploads/kyc/${filename}`, { actor: customer }); expect(owned, 200); assert.equal(owned.headers.get('cache-control'), 'private, no-store');
    expect(await api(`/uploads/kyc/${filename}`, { actor: admin }), 200);
    expect(await api(`/uploads/kyc%2f${filename}`, { actor: stranger }), 404);
  });
  await check('KYC upload validates file metadata and stores a real private document', async () => {
    const pixels = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVNcAAAAASUVORK5CYII=', 'base64');
    const upload = async filename => {
      const form = new FormData(); form.set('documentType', 'national_id'); form.set('documentNumber', 'SYNTHETIC-UPLOAD'); form.set('documentImage', new Blob([pixels], { type: 'image/png' }), filename);
      const response = await fetch(base + '/api/kyc/submit', { method: 'POST', headers: { Authorization: `Bearer ${token(customer)}` }, body: form });
      return { status: response.status, data: await response.json() };
    };
    expect(await upload('synthetic.png.exe'), 400);
    const saved = expect(await upload('synthetic.png'), 201); assert.match(saved.kyc.documentImage, /^uploads\/kyc\/kyc-[a-zA-Z0-9.-]+\.png$/);
    expect(await api('/' + saved.kyc.documentImage, { actor: stranger }), 404);
    expect(await api('/' + saved.kyc.documentImage, { actor: customer }), 200);
  });
  await check('dashboard receipts equal an independent real MongoDB payment aggregation', async () => {
    const dashboard = expect(await api('/api/admin/dashboard', { actor: admin }), 200).dashboard;
    const rows = await Booking.aggregate([{ $match: { currency: 'BDT' } }, { $unwind: '$payments' }, { $match: { 'payments.status': 'SUCCESS' } }, { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' } } }]);
    const gross = rows.filter(row => row._id !== 'REFUND').reduce((sum, row) => sum + row.total, 0), refunded = rows.find(row => row._id === 'REFUND')?.total || 0;
    assert.equal(dashboard.revenue.gross, gross); assert.equal(dashboard.revenue.refunded, refunded); assert.equal(dashboard.revenue.net, gross - refunded);
    assert.equal(dashboard.bookings.overall, await Booking.countDocuments()); assert.equal(dashboard.revenueOverTime.length, 30); assert.equal(dashboard.timezone, 'Asia/Dhaka');
    const metrics = expect(await api('/api/admin/metrics', { actor: admin }), 200).metrics; assert.equal(metrics.revenue, gross - refunded);
  });
  await check('completion awards points once under concurrent requests and rejects unpaid bookings', async () => {
    const before = (await User.findById(customer._id)).rewardPoints;
    const results = await Promise.all(Array.from({ length: 3 }, () => api(`/api/bookings/${first._id}/complete`, { actor: admin, method: 'POST' })));
    results.forEach(result => expect(result, 200));
    const stored = await Booking.findById(first._id); assert.equal(stored.status, 'COMPLETED'); assert.equal(stored.pointsEarned, 60);
    assert.equal((await User.findById(customer._id)).rewardPoints, before + 60);
    assert.equal((await User.findById(customer._id)).pointsHistory.filter(item => String(item.bookingId) === first._id && item.type === 'EARNED').length, 1);
  });
  await check('spent reward points and capacity reverse once on cancellation', async () => {
    const dep = await GroupDeparture.create({ packageId: groupPackage._id, startDate: start, endDate: end, totalSeats: 2, pricePerPerson: 1000 });
    const before = (await User.findById(customer._id)).rewardPoints;
    const result = await reserveBooking({ ...bookingBody(customer, dep), pointsToUse: 50 }); assert.equal(result.error, undefined);
    assert.equal(result.booking.finalAmount, 950); assert.equal((await User.findById(customer._id)).rewardPoints, before - 50);
    await Promise.all(Array.from({ length: 3 }, async () => expect(await api(`/api/bookings/${result.booking._id}/cancel`, { actor: customer, method: 'POST', body: { reason: 'Synthetic point reversal' } }), 200)));
    assert.equal((await User.findById(customer._id)).rewardPoints, before); assert.equal((await GroupDeparture.findById(dep._id)).bookedSeats, 0);
  });
  await check('general departure cancellation atomically cancels bookings and queues full verified receipts', async () => {
    const dep = await GroupDeparture.create({ packageId: groupPackage._id, startDate: start, endDate: end, totalSeats: 2, pricePerPerson: 1000, operators: [{ operatorId: operator._id }] });
    const booking = expect(await api('/api/bookings', { actor: customer, method: 'POST', body: bookingBody(customer, dep) }), 201).booking;
    const receipt = expect(await submit(booking, 300, 'DEPARTURE-CANCEL'), 200).payment; expect(await verify(booking, receipt), 200);
    expect(await api(`/api/admin/group-departures/${dep._id}`, { actor: admin, method: 'PUT', body: { status: 'CANCELLED' } }), 200);
    expect(await api(`/api/admin/group-departures/${dep._id}`, { actor: admin, method: 'PUT', body: { status: 'CANCELLED' } }), 200);
    const stored = await Booking.findById(booking._id); assert.equal(stored.status, 'CANCELLED'); assert.equal(stored.cancellation.refundAmount, 300);
    assert.equal(stored.payments.filter(payment => payment.method === 'REFUND').length, 1);
    assert.equal((await GroupDeparture.findById(dep._id)).bookedSeats, 0); assert.equal((await GroupDeparture.findById(dep._id)).status, 'CANCELLED');
  });
  await check('unpaid expiry releases capacity and keeps a full partial-payment refund queued', async () => {
    const dep = await GroupDeparture.create({ packageId: groupPackage._id, startDate: start, endDate: end, totalSeats: 1, pricePerPerson: 1000 });
    const booking = expect(await api('/api/bookings', { actor: customer, method: 'POST', body: bookingBody(customer, dep) }), 201).booking;
    const receipt = expect(await submit(booking, 200, 'EXPIRED-PARTIAL'), 200).payment; expect(await verify(booking, receipt), 200);
    await Booking.updateOne({ _id: booking._id }, { $set: { startDate: new Date(Date.now() - 86400000) } });
    expect(await api('/api/admin/bookings/cancel-unpaid', { actor: admin, method: 'POST' }), 200);
    const stored = await Booking.findById(booking._id); assert.equal(stored.status, 'CANCELLED'); assert.equal(stored.cancellation.refundAmount, 200); assert.equal((await GroupDeparture.findById(dep._id)).bookedSeats, 0);
  });
  await check('group date approval transfers reservation, dates and assignments together', async () => {
    const from = await GroupDeparture.create({ packageId: groupPackage._id, startDate: start, endDate: end, totalSeats: 1, pricePerPerson: 1000 });
    const targetDate = new Date(+start + 4 * 86400000);
    const target = await GroupDeparture.create({ packageId: groupPackage._id, startDate: targetDate, endDate: new Date(+targetDate + 3 * 86400000), totalSeats: 1, pricePerPerson: 1000, operators: [{ operatorId: operator._id }], seatMap: [{ seatNumber: '1' }] });
    const booking = expect(await api('/api/bookings', { actor: customer, method: 'POST', body: bookingBody(customer, from) }), 201).booking;
    expect(await api(`/api/bookings/${booking._id}/request-date-change`, { actor: customer, method: 'POST', body: { requestedDate: targetDate.toISOString(), reason: 'Synthetic transfer' } }), 200);
    expect(await api(`/api/admin/bookings/${booking._id}/approve-date-change`, { actor: admin, method: 'POST', body: { newStartDate: targetDate.toISOString() } }), 200);
    const stored = await Booking.findById(booking._id); assert.equal(String(stored.groupDepartureId), String(target._id)); assert.equal(+stored.startDate, +target.startDate); assert.equal(String(stored.assignedOperator), String(operator._id));
    assert.equal((await GroupDeparture.findById(from._id)).bookedSeats, 0); assert.equal((await GroupDeparture.findById(target._id)).bookedSeats, 1);
    expect(await api(`/api/admin/group-departures/${target._id}`, { actor: operator, method: 'PUT', body: { seatMap: [] } }), 400);
  });
  await check('departure reassignment revokes the stale direct operator and updates customer contact', async () => {
    const dep = await GroupDeparture.create({ packageId: groupPackage._id, startDate: start, endDate: end, totalSeats: 2, pricePerPerson: 1000, operators: [{ operatorId: operator._id }] });
    const booking = expect(await api('/api/bookings', { actor: customer, method: 'POST', body: bookingBody(customer, dep) }), 201).booking;
    expect(await api(`/api/admin/group-departures/${dep._id}`, { actor: admin, method: 'PUT', body: { operatorIds: [String(unrelatedOperator._id)] } }), 200);
    // The old denormalized field deliberately remains; it must not grant current group access.
    assert.equal(String((await Booking.findById(booking._id)).assignedOperator), String(operator._id));
    expect(await api(`/api/bookings/${booking._id}`, { actor: operator }), 403);
    expect(await api(`/api/messages/booking/${booking._id}`, { actor: operator }), 403);
    expect(await api(`/api/bookings/${booking._id}/operator-notes`, { actor: operator, method: 'PATCH', body: { operatorNotes: 'Forbidden stale assignment' } }), 403);
    expect(await api(`/api/bookings/${booking._id}`, { actor: unrelatedOperator }), 200);
    const customerView = expect(await api(`/api/bookings/${booking._id}`, { actor: customer }), 200).booking;
    assert.equal(customerView.assignedOperator._id, String(unrelatedOperator._id));
    const former = expect(await api('/api/bookings', { actor: operator }), 200).bookings;
    assert.equal(former.some(item => item._id === booking._id), false);
  });
  await check('blocked seats reduce capacity and cannot be reserved or replaced with forged ownership', async () => {
    const dep = await GroupDeparture.create({ packageId: groupPackage._id, startDate: start, endDate: end, totalSeats: 2, pricePerPerson: 1000, operators: [{ operatorId: operator._id }], seatMap: [{ seatNumber: '1', status: 'BLOCKED' }, { seatNumber: '2' }] });
    assert.equal(expect(await api(`/api/departures/${dep._id}/availability`), 200).availability.availableSeats, 1);
    expect(await api('/api/bookings', { actor: customer, method: 'POST', body: bookingBody(customer, dep) }), 400);
    const booking = expect(await api('/api/bookings', { actor: customer, method: 'POST', body: { ...bookingBody(customer, dep), reservedSeats: ['2'] } }), 201).booking;
    assert.equal((await GroupDeparture.findById(dep._id)).bookedSeats, 1); assert.equal((await GroupDeparture.findById(dep._id)).status, 'FULL');
    expect(await api(`/api/admin/group-departures/${dep._id}`, { actor: operator, method: 'PUT', body: { seatMap: [{ seatNumber: '1', status: 'BLOCKED' }, { seatNumber: '2', status: 'BOOKED', bookingId: booking._id, bookedBy: String(stranger._id) }] } }), 400);
  });
  if (process.env.RUN_BROWSER_TESTS === '1') {
    process.env.VITE_API_URL = '/api';
    const { createServer } = await import('../../frontend/node_modules/vite/dist/node/index.js');
    const root = fileURLToPath(new URL('../../frontend/', import.meta.url));
    process.chdir(root);
    vite = await createServer({ root, envDir: temporary, server: { host: '127.0.0.1', port: frontendPort, strictPort: true, proxy: { '/api': { target: base, changeOrigin: true }, '/uploads': { target: base, changeOrigin: true } } } });
    await vite.listen();
    const browserBooking = await makePrivate(customer);
    const { runBrowserWorkflows } = await import('./browser-workflows.js');
    await check('real Chrome customer/admin payment and measured dashboard workflows', () => runBrowserWorkflows({ origin: `http://127.0.0.1:${frontendPort}`, temporary, customer, admin, password, browserBooking, api, expect, processes }));
  }
  console.log(`Verified ${checks} isolated database/HTTP${process.env.RUN_BROWSER_TESTS === '1' ? '/browser' : ''} scenarios.`);
} finally {
  process.chdir(originalDirectory);
  await vite?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await client?.close(); await mongoose.disconnect();
  for (const child of processes.reverse()) {
    if (child.exitCode !== null) continue;
    const stopped = once(child, 'exit').catch(() => {}); child.kill('SIGTERM');
    await Promise.race([stopped, pause(5000)]);
    if (child.exitCode === null) { child.kill('SIGKILL'); await stopped; }
  }
  await rm(temporary, { recursive: true, force: true });
}
