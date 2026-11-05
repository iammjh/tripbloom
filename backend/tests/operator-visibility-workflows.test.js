import test from 'node:test';
import assert from 'node:assert/strict';
import { operatorsForActor, maskBookingOperators, departureForRole } from '../service/departureView.js';

const lead = '1111111111111111111111aa';
const co = '2222222222222222222222bb';
const customer = { id: '3333333333333333333333cc', roles: ['CUSTOMER'] };
const leadOperator = { id: lead, roles: ['TOUR_OPERATOR'] };
const coOperator = { id: co, roles: ['TOUR_OPERATOR'] };
const admin = { id: '4444444444444444444444dd', roles: ['ADMIN'] };

const leadEntry = { _id: lead, fullName: 'Lead Guide', email: 'lead@example.com', phone: '017100', roles: ['TOUR_OPERATOR'], availability: 'AVAILABLE' };
const coEntry = { _id: co, fullName: 'Co Guide', email: 'co@example.com', phone: '018200', roles: ['TOUR_OPERATOR'], availability: 'AVAILABLE' };
const operators = () => [{ operatorId: { ...leadEntry } }, { operatorId: { ...coEntry } }];

test('a customer sees the lead operator contact and not co-operators', () => {
  const [first, second] = operatorsForActor(operators(), customer);
  assert.equal(first.operatorId.email, 'lead@example.com');
  assert.equal(first.operatorId.phone, '017100');
  assert.equal(second.operatorId.fullName, 'Co Guide');
  assert.equal(second.operatorId.email, undefined);
  assert.equal(second.operatorId.phone, undefined);
});

test('an operator sees only their own contact details', () => {
  const [lead1, co1] = operatorsForActor(operators(), coOperator);
  assert.equal(co1.operatorId.email, 'co@example.com');
  assert.equal(lead1.operatorId.email, undefined, 'the lead operator is not visible to another operator');
  const [lead2] = operatorsForActor(operators(), leadOperator);
  assert.equal(lead2.operatorId.email, 'lead@example.com');
});

test('administrators see every contact', () => {
  const list = operatorsForActor(operators(), admin);
  assert.equal(list[1].operatorId.email, 'co@example.com');
});

test('a customer booking hides co-operators but keeps the lead as the contact', () => {
  const booking = {
    _id: 'b1',
    customerId: customer.id,
    assignedOperator: { ...leadEntry },
    groupDepartureId: { _id: 'd1', operators: operators() }
  };
  const view = maskBookingOperators(booking, customer);
  assert.equal(view.assignedOperator.phone, '017100');
  assert.equal(view.groupDepartureId.operators[0].operatorId.email, 'lead@example.com');
  assert.equal(view.groupDepartureId.operators[1].operatorId.email, undefined);
  assert.equal(view.groupDepartureId.operators[1].operatorId.phone, undefined);
  assert.equal(booking.groupDepartureId.operators[1].operatorId.email, 'co@example.com', 'the source object is not mutated');
});

test('an operator booking view shows the lead operator by name only', () => {
  const booking = { _id: 'b2', assignedOperator: { ...leadEntry }, groupDepartureId: { _id: 'd1', operators: operators() } };
  const view = maskBookingOperators(booking, coOperator);
  assert.equal(view.assignedOperator.fullName, 'Lead Guide');
  assert.equal(view.assignedOperator.email, undefined);
  assert.equal(view.groupDepartureId.operators[1].operatorId.email, 'co@example.com');
});

test('administrator booking views are returned unchanged', () => {
  const booking = { _id: 'b3', assignedOperator: { ...leadEntry } };
  assert.equal(maskBookingOperators(booking, admin), booking);
});

test('departure view masks co-operators for an operator who is not on the departure', () => {
  const view = departureForRole({ _id: 'd9', operators: operators() }, { id: '5555555555555555555555ee', roles: ['TOUR_OPERATOR'] });
  assert.equal(view.operators[0].operatorId.email, undefined);
  assert.equal(view.operators[1].operatorId.email, undefined);
});
