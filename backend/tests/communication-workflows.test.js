import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../model/user.model.js';
import { GroupDeparture } from '../model/groupDeparture.model.js';
import Booking from '../model/booking.model.js';
import KYC from '../model/kyc.model.js';
import { getSupportContacts, getOperatorKycStatuses } from '../service/communication.service.js';
import { getSupportContactsController, getOperatorKycStatusesController } from '../controller/communication.controller.js';

afterEach(() => mock.restoreAll());
const operatorId = '111111111111111111111111';
const departureId = '222222222222222222222222';
const customerId = '333333333333333333333333';
const kycId = '444444444444444444444444';

function queryResult(value, inspect = {}) {
  const query = {};
  for (const method of ['select', 'sort', 'limit']) {
    query[method] = arg => { inspect[method] = arg; return query; };
  }
  query.lean = async () => value;
  query.distinct = async field => { inspect.distinct = field; return value; };
  return query;
}
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function stubOperatorStatuses() {
  const seen = {};
  mock.method(GroupDeparture, 'find', filter => {
    seen.departures = filter;
    return queryResult([departureId]);
  });
  mock.method(Booking, 'find', filter => {
    seen.bookings = filter;
    return queryResult([customerId]);
  });
  mock.method(KYC, 'find', filter => {
    seen.kyc = filter;
    return queryResult([{ _id: kycId, user: customerId, userFullName: 'Traveler', status: 'approved', verifiedAt: '2026-11-04', documentNumber: 'PRIVATE', documentImage: 'PRIVATE', userEmail: 'PRIVATE' }], seen.kycProjection = {});
  });
  return seen;
}

test('support directory returns only active admin display fields, never credentials/contact details', async () => {
  const seen = {};
  mock.method(User, 'find', filter => {
    seen.filter = filter;
    return queryResult([{ _id: operatorId, fullName: 'Support', roles: ['admin'], email: 'private@example.invalid', passwordHash: 'PRIVATE', phone: 'PRIVATE' }], seen);
  });
  const users = await getSupportContacts();
  assert.deepEqual(seen.filter, { roles: { $in: ['admin', 'ADMIN'] }, isActive: true });
  assert.equal(seen.select, '_id fullName roles');
  assert.deepEqual(users, [{ _id: operatorId, fullName: 'Support', roles: ['admin'] }]);
});

test('support controller rejects anonymous access before querying the directory', async () => {
  const res = response();
  await getSupportContactsController({ user: undefined }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('operator KYC status is scoped to assigned bookings/departures and excludes identity documents', async () => {
  const seen = stubOperatorStatuses();
  const statuses = await getOperatorKycStatuses(operatorId, 'approved');
  assert.deepEqual(seen.departures, { 'operators.operatorId': operatorId });
  assert.deepEqual(seen.bookings, { $or: [{ assignedOperator: operatorId, groupDepartureId: null }, { groupDepartureId: { $in: [departureId] } }] });
  assert.deepEqual(seen.kyc, { user: { $in: [customerId] }, status: 'approved' });
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].user, customerId);
  assert.equal(statuses[0].status, 'approved');
  assert.equal(statuses[0].documentNumber, undefined);
  assert.equal(statuses[0].documentImage, undefined);
  assert.equal(statuses[0].userEmail, undefined);
});

test('operator with no assigned customers receives no KYC data', async () => {
  mock.method(GroupDeparture, 'find', () => queryResult([]));
  mock.method(Booking, 'find', () => queryResult([]));
  mock.method(KYC, 'find', () => { throw new Error('Must not query all KYC documents'); });
  assert.deepEqual(await getOperatorKycStatuses(operatorId), []);
});

test('customer cannot use the operator KYC summary and invalid status is rejected', async () => {
  const customerResponse = response();
  await getOperatorKycStatusesController({ user: { id: customerId, roles: ['customer'] }, query: {} }, customerResponse);
  assert.equal(customerResponse.statusCode, 403);
  const operatorResponse = response();
  await getOperatorKycStatusesController({ user: { id: operatorId, roles: ['tour_operator'] }, query: { status: { $ne: 'rejected' } } }, operatorResponse);
  assert.equal(operatorResponse.statusCode, 400);
});

test('operator controller scopes to authenticated caller despite a different operator query', async () => {
  const seen = stubOperatorStatuses();
  const res = response();
  await getOperatorKycStatusesController({ user: { id: operatorId, roles: ['TOUR_OPERATOR'] }, query: { status: 'approved', operatorId: customerId } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(seen.departures, { 'operators.operatorId': operatorId });
  assert.equal(res.body.kycs[0].documentImage, undefined);
});

test('directory failures return an intentional non-sensitive error response', async () => {
  mock.method(User, 'find', () => { throw new Error('private connection information'); });
  const res = response();
  await getSupportContactsController({ user: { id: customerId } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.body).includes('private connection information'), false);
});
