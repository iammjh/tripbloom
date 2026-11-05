import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Booking from '../model/booking.model.js';
import { User } from '../model/user.model.js';
import { TourPackage } from '../model/tourPackage.model.js';
import { GroupDeparture } from '../model/groupDeparture.model.js';
import * as controller from '../controller/booking.controller.js';
import * as service from '../service/booking.service.js';

const ids = { customer: new mongoose.Types.ObjectId().toString(), operator: new mongoose.Types.ObjectId().toString(), other: new mongoose.Types.ObjectId().toString(), package: new mongoose.Types.ObjectId().toString(), departure: new mongoose.Types.ObjectId().toString(), booking: new mongoose.Types.ObjectId().toString() };
const query = value => ({ populate() { return this; }, sort() { return this; }, select() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } }; }
const booking = () => ({ _id: ids.booking, customerId: { _id: ids.customer }, assignedOperator: ids.other, groupDepartureId: ids.departure, operatorNotes: 'Internal instructions', customizations: 'Vegetarian meals' });
test.afterEach(() => test.mock.restoreAll());

test('operator listing derives assignment scope from JWT, including assigned departure', async () => {
 let filter;
 test.mock.method(GroupDeparture, 'find', () => query([{ _id: ids.departure }]));
 test.mock.method(Booking, 'find', value => { filter = value; return query([booking()]); });
 const res = response();
 await controller.listBookingsController({ user: { id: ids.operator, roles: ['tour_operator'] }, query: { assignedOperator: ids.other } }, res);
 assert.equal(res.code, 200);
 assert.deepEqual(filter.$or, [{ assignedOperator: ids.operator, groupDepartureId: null }, { groupDepartureId: { $in: [ids.departure] } }]);
 assert.equal(filter.assignedOperator, undefined);
});

test('admin can explicitly filter assigned operator', async () => {
 let filter;
 test.mock.method(Booking, 'find', value => { filter = value; return query([]); });
 await controller.listBookingsController({ user: { id: ids.other, roles: ['admin'] }, query: { assignedOperator: ids.operator } }, response());
 assert.equal(filter.assignedOperator, ids.operator);
});

test('customer list remains own-only and excludes internal operator notes', async () => {
 let filter;
 test.mock.method(Booking, 'find', value => { filter = value; return query([booking()]); });
 const res = response();
 await controller.listBookingsController({ user: { id: ids.customer, roles: ['customer'] }, query: { customerId: ids.other } }, res);
 assert.equal(filter.customerId, ids.customer);
 assert.equal(res.data.bookings[0].operatorNotes, undefined);
 assert.equal(res.data.bookings[0].customizations, 'Vegetarian meals');
});

test('assigned departure operators can read booking; customers cannot read internal notes', async () => {
 test.mock.method(Booking, 'findById', () => query(booking()));
 test.mock.method(GroupDeparture, 'exists', async () => ({ _id: ids.departure }));
 const op = response();
 await controller.getBookingByIdController({ params: { bookingId: ids.booking }, user: { id: ids.operator, roles: ['tour_operator'] } }, op);
 assert.equal(op.code, 200);
 const customer = response();
 await controller.getBookingByIdController({ params: { bookingId: ids.booking }, user: { id: ids.customer, roles: ['customer'] } }, customer);
 assert.equal(customer.data.booking.operatorNotes, undefined);
});

test('unassigned operator cannot save notes', async () => {
 assert.equal(typeof controller.updateOperatorNotesController, 'function');
 test.mock.method(Booking, 'findById', () => query(booking()));
 test.mock.method(GroupDeparture, 'exists', async () => null);
 const res = response();
 await controller.updateOperatorNotesController({ params: { bookingId: ids.booking }, user: { id: ids.operator, roles: ['tour_operator'] }, body: { operatorNotes: 'Changed' } }, res);
 assert.equal(res.code, 403);
});

test('an operator booking as a customer cannot see another operator internal notes', async () => {
 test.mock.method(Booking, 'findById', () => query(booking()));
 test.mock.method(GroupDeparture, 'exists', async () => null);
 const res = response();
 await controller.getBookingByIdController({ params: { bookingId: ids.booking }, user: { id: ids.customer, roles: ['customer', 'tour_operator'] } }, res);
 assert.equal(res.code, 200);
 assert.equal(res.data.booking.operatorNotes, undefined);
});

test('assigned operator notes update is validated and limited to the note field', async () => {
 assert.equal(typeof controller.updateOperatorNotesController, 'function');
 let update;
 test.mock.method(Booking, 'findById', () => query(booking()));
 test.mock.method(GroupDeparture, 'exists', async () => ({ _id: ids.departure }));
 test.mock.method(Booking, 'findByIdAndUpdate', (id, value, options) => { update = value; assert.equal(options.runValidators, true); return query({ _id: id, operatorNotes: value.$set.operatorNotes }); });
 const res = response();
 await controller.updateOperatorNotesController({ params: { bookingId: ids.booking }, user: { id: ids.operator, roles: ['tour_operator'] }, body: { operatorNotes: '  Dietary requests noted  ', totalAmount: 1 } }, res);
 assert.equal(res.code, 200);
 assert.deepEqual(update, { $set: { operatorNotes: 'Dietary requests noted' } });
 assert.equal(res.data.booking.operatorNotes, 'Dietary requests noted');
 const invalid = await service.updateOperatorNotes({ bookingId: ids.booking, operatorNotes: 'x'.repeat(5001) });
 assert.ok(invalid.error);
});

test('customer cannot edit internal notes through general booking update', async () => {
 test.mock.method(Booking, 'findById', () => query(booking()));
 const res = response();
 await controller.updateBookingController({ params: { bookingId: ids.booking }, user: { id: ids.customer, roles: ['customer'] }, body: { operatorNotes: 'Private change' } }, res);
 assert.equal(res.code, 403);
});

test('booking customization survives controller/service/model serialization', async () => {
 test.mock.method(mongoose.connection, 'transaction', async work => work({}));
 test.mock.method(mongoose.connection, 'collection', () => ({ findOneAndUpdate: async () => ({ value: { seq: 1 } }) }));
 test.mock.method(TourPackage, 'findById', async () => ({ _id: ids.package, isActive: true, isInternational: false, type: 'PERSONAL', basePrice: 1000, defaultDays: 3 }));
 test.mock.method(User, 'findById', async () => ({ _id: ids.customer, rewardPoints: 100, pointsHistory: [] }));
 test.mock.method(Booking.prototype, 'save', async function () { await this.validate(); return this; });
 test.mock.method(Booking.prototype, 'populate', async function () { return this; });
 const res = response();
 await controller.createBookingController({ user: { id: ids.customer, roles: ['customer'] }, body: { customerId: ids.customer, packageId: ids.package, bookingType: 'PRIVATE', startDate: '2027-01-01', endDate: '2027-01-04', numTravelers: 1, travelers: [{ fullName: 'Synthetic Traveler', age: 30 }], totalAmount: 1000, customizations: '  Vegetarian meals  ' } }, res);
 assert.equal(res.code, 201);
 const reloaded = new Booking(JSON.parse(JSON.stringify(res.data.booking)));
 assert.equal(reloaded.customizations, 'Vegetarian meals');
});

test('oversized customization is rejected before database operations', async () => {
 let lookups = 0;
 test.mock.method(TourPackage, 'findById', async () => { lookups++; return null; });
 const result = await service.createBooking({ customizations: 'x'.repeat(4001) });
 assert.ok(result.error);
 assert.equal(lookups, 0);
});
