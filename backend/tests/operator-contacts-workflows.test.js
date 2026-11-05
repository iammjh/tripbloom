import test from 'node:test';
import assert from 'node:assert/strict';
import { departureForRole } from '../service/departureView.js';
import { updateOperatorProfileController } from '../controller/operator.controller.js';

const me = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const other = 'bbbbbbbbbbbbbbbbbbbbbbbb';

function departure() {
  return {
    _id: 'dep1',
    operators: [
      { operatorId: { _id: me, fullName: 'Me Operator', email: 'me@example.com', phone: '017111', roles: ['TOUR_OPERATOR'], availability: 'AVAILABLE' } },
      { operatorId: { _id: other, fullName: 'Co Operator', email: 'co@example.com', phone: '018222', roles: ['TOUR_OPERATOR'], availability: 'AVAILABLE' } }
    ]
  };
}

test('administrators see every operator contact on a departure', () => {
  const view = departureForRole(departure(), { id: 'admin1', roles: ['ADMIN'] });
  assert.equal(view.operators[1].operatorId.email, 'co@example.com');
  assert.equal(view.operators[1].operatorId.phone, '018222');
});

test('an operator sees co-operators by name and role only, without email or phone', () => {
  const view = departureForRole(departure(), { id: me, roles: ['TOUR_OPERATOR'] });
  const co = view.operators[1].operatorId;
  assert.equal(co.fullName, 'Co Operator');
  assert.deepEqual(co.roles, ['TOUR_OPERATOR']);
  assert.equal(co.email, undefined);
  assert.equal(co.phone, undefined);
});

test('an operator keeps their own entry in full', () => {
  const view = departureForRole(departure(), { id: me, roles: ['TOUR_OPERATOR'] });
  assert.equal(view.operators[0].operatorId.email, 'me@example.com');
});

test('plain objects and missing departures are handled without throwing', () => {
  assert.equal(departureForRole(null, { id: me, roles: [] }), null);
  const plain = departureForRole({ _id: 'x', operators: [] }, { id: me, roles: ['TOUR_OPERATOR'] });
  assert.deepEqual(plain.operators, []);
});

test('profile save returns the validation message to the operator', async () => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await updateOperatorProfileController({ user: { id: me, roles: ['TOUR_OPERATOR'] }, params: { operatorId: me }, body: { email: 'not-an-email' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'A valid email is required.');
});
