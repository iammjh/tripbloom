import Booking from '../model/booking.model.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { GroupDeparture } from '../model/groupDeparture.model.js';
import { User } from '../model/user.model.js';
import { updateGroupDepartureController, assignOperatorsToDepartureController } from '../controller/groupDeparture.controller.js';
import { updateGroupDeparture } from '../service/groupDeparture.service.js';
import { getOperatorProfile, updateOperatorProfile } from '../service/operator.service.js';
import { updateOperatorProfileController } from '../controller/operator.controller.js';

const operatorId = new mongoose.Types.ObjectId();
const otherId = new mongoose.Types.ObjectId();
function query(value) {
  return { populate() { return this; }, select() { return this; }, exec: async () => value,
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function departure() {
  const doc = new GroupDeparture({ packageId: new mongoose.Types.ObjectId(), startDate: '2027-01-01', endDate: '2027-01-03', totalSeats: 3, pricePerPerson: 500, operators: [{ operatorId }] });
  doc.save = async function () { await this.validate(); this.saved = (this.saved || 0) + 1; return this; };
  doc.populate = async function () { return this; };
  return doc;
}

test('assigned operator saves operational fields and they survive model serialization', async t => {
  const doc = departure();
  const bookingId = new mongoose.Types.ObjectId();
  doc.bookedSeats = 1;
  t.mock.method(Booking, 'find', () => query([{ _id: bookingId, customerId: otherId, numTravelers: 1 }]));
  t.mock.method(GroupDeparture, 'findById', () => query(doc));
  const res = response();
  await updateGroupDepartureController({ params: { departureId: doc.id }, user: { id: String(operatorId), roles: ['tour_operator'] }, body: {
    safetyChecklist: { firstAid: true }, itinerary: [{ day: 1, stops: [{ name: 'Museum', time: '09:00', status: 'completed' }] }],
    seatMap: [{ seatNumber: '1', status: 'BOOKED', checkedIn: true, bookedBy: otherId, bookingId }], seatMapChecked: true,
  } }, res);
  assert.equal(res.statusCode, 200);
  const stored = doc.toObject();
  assert.equal(stored.safetyChecklist.firstAid, true);
  assert.equal(stored.itinerary[0].stops[0].name, 'Museum');
  assert.equal(stored.seatMap[0].checkedIn, true);
  assert.equal(String(stored.seatMap[0].bookedBy), String(otherId));
});

test('unassigned user cannot update a departure', async t => {
  const doc = departure(); t.mock.method(GroupDeparture, 'findById', () => query(doc));
  const res = response();
  await updateGroupDepartureController({ params: { departureId: doc.id }, user: { id: String(otherId), roles: ['tour_operator'] }, body: { tourStarted: true } }, res);
  assert.equal(res.statusCode, 403); assert.equal(doc.saved, undefined);
});

test('assigned operator cannot change prices, dates or assignments', async t => {
  const doc = departure(); t.mock.method(GroupDeparture, 'findById', () => query(doc));
  const res = response();
  await updateGroupDepartureController({ params: { departureId: doc.id }, user: { id: String(operatorId), roles: ['tour_operator'] }, body: { pricePerPerson: 1, operatorIds: [String(otherId)] } }, res);
  assert.equal(res.statusCode, 403); assert.equal(doc.saved, undefined);
});

test('invalid operational payload is rejected before saving', async t => {
  const doc = departure(); t.mock.method(GroupDeparture, 'findById', () => query(doc));
  for (const patch of [ { safetyChecklist: { firstAid: 'yes' } }, { seatMap: [{ seatNumber: '1', status: 'free' }] },
    { itinerary: [{ day: 0, stops: [] }] }, { tourStarted: 'true' },
    { seatMap: [{ seatNumber: '1', status: 'AVAILABLE' }, { seatNumber: '1', status: 'BOOKED' }] } ]) {
    const result = await updateGroupDeparture({ departureId: doc.id, ...patch });
    assert.ok(result.error, JSON.stringify(patch));
  }
  assert.equal(doc.saved, undefined);
});

test('starting a tour requires all server-side safety checks', async t => {
  const doc = departure(); t.mock.method(GroupDeparture, 'findById', () => query(doc));
  const denied = await updateGroupDeparture({ departureId: doc.id, tourStarted: true });
  assert.ok(denied.error); assert.equal(doc.saved, undefined);
  const accepted = await updateGroupDeparture({ departureId: doc.id, safetyChecklist: { firstAid: true, vehicleDocs: true, foodHygiene: true, emergencyContacts: true, routePlanned: true }, tourStarted: true });
  assert.equal(accepted.departure.tourStarted, true);
});

test('assignment response uses the persisted operators field', async t => {
  const doc = departure(); doc.operators = [];
  t.mock.method(GroupDeparture, 'findById', () => query(doc));
  t.mock.method(User, 'findById', () => query({ availability: 'AVAILABLE', isActive: true, roles: ['tour_operator'] }));
  const res = response();
  await assignOperatorsToDepartureController({ user: { id: String(operatorId), roles: ['admin'] }, params: { departureId: doc.id }, body: { operatorIds: [String(operatorId)] } }, res);
  assert.equal(res.body.success, true); assert.match(res.body.message, /successfully/);
});

test('operator profile queries exclude credential hashes', async t => {
  let projection;
  t.mock.method(User, 'findById', () => ({ select(value) { projection = value; return this; }, exec: async () => ({ fullName: 'Guide' }) }));
  await getOperatorProfile(String(operatorId));
  assert.match(projection, /-passwordHash/);
});

test('operator cannot save another profile', async t => {
  t.mock.method(User, 'findByIdAndUpdate', () => query({ fullName: 'Changed' }));
  const res = response();
  await updateOperatorProfileController({ params: { operatorId: String(otherId) }, user: { id: String(operatorId), roles: ['tour_operator'] }, body: { fullName: 'Changed' } }, res);
  assert.equal(res.statusCode, 403);
});

test('profile save validates values and strips fields absent from editable schema', async t => {
  let update, options;
  t.mock.method(User, 'findByIdAndUpdate', (id, value, opts) => { update = value; options = opts; return query({ fullName: 'Updated', availability: 'AVAILABLE' }); });
  const profile = await updateOperatorProfile(String(operatorId), { fullName: 'Updated', phone: '01234', address: 'unsupported', roles: ['admin'], passwordHash: 'unsafe' });
  assert.equal(profile.fullName, 'Updated'); assert.deepEqual(update.$set, { fullName: 'Updated', phone: '01234' });
  assert.match(options.select, /-passwordHash/);
  await assert.rejects(() => updateOperatorProfile(String(operatorId), { fullName: '' }), /name/i);
});
