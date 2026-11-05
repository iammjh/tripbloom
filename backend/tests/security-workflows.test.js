import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { User } from '../model/user.model.js';
import { requireAuth, requireRole, requireSelfOrAdmin } from '../controller/user.controller.js';
import { registerUser } from '../service/user.service.js';
process.env.JWT_SECRET = 'synthetic-security-test-secret';
afterEach(() => test.mock.restoreAll());
const id = '64a000000000000000000001';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
test('privileged public signup is rejected before persistence', async () => {
 let queried = false; test.mock.method(User, 'findOne', async () => { queried = true; });
 const result = await registerUser({ fullName: 'Synthetic', email: 'fake@example.invalid', passwordHash: 'validpass', roles: ['ADMIN'] });
 assert.match(result.error, /customer/); assert.equal(queried, false);
});
test('demoted account cannot use admin role from an existing signed token', async () => {
 test.mock.method(User, 'findById', () => ({ select: async () => ({ _id: id, isActive: true, roles: ['customer'] }) }));
 const res = response(); let proceeded = false;
 await requireRole('admin')({ headers: { authorization: 'Bearer ' + jwt.sign({ id, roles: ['ADMIN'] }, process.env.JWT_SECRET) } }, res, () => { proceeded = true; });
 assert.equal(res.code, 403); assert.equal(proceeded, false);
});
test('suspended and deleted accounts cannot reuse signed tokens', async () => {
 for (const account of [null, { _id: id, isActive: false, roles: ['admin'] }]) {
 test.mock.method(User, 'findById', () => ({ select: async () => account }));
 const res = response(); await requireAuth({ headers: { authorization: 'Bearer ' + jwt.sign({ id }, process.env.JWT_SECRET) } }, res, () => assert.fail('inactive actor allowed'));
 assert.equal(res.code, 401); test.mock.restoreAll();
 }
});
test('cross-user account access is forbidden', () => {
 const res = response(); requireSelfOrAdmin({ params: { userId: '64a000000000000000000002' }, user: { id, roles: ['customer'] } }, res, () => assert.fail('cross-user access allowed'));
 assert.equal(res.code, 403);
});

test('user serialization never exposes stored credentials, including administrator responses', () => {
 const account = new User({ fullName: 'Synthetic', email: 'synthetic@example.invalid', roles: ['admin'], passwordHash: 'stored-secret-hash' });
 const serialized = JSON.parse(JSON.stringify({ user: account }));
 assert.equal(serialized.user.passwordHash, undefined);
 assert.equal(account.passwordHash, 'stored-secret-hash');
});
