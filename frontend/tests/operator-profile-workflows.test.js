import test from 'node:test';
import assert from 'node:assert/strict';
import { KYC_DOCUMENT_OPTIONS, kycStatusView, profileChanged, profileDraft, validateKycForm, validateProfileDraft } from '../src/utils/operatorProfile.js';

test('KYC document options match the backend enum', () => {
  assert.deepEqual(KYC_DOCUMENT_OPTIONS.map(option => option.value), ['passport', 'national_id', 'driving_license']);
});

test('profile validation mirrors the server rules', () => {
  assert.deepEqual(validateProfileDraft({ fullName: '  ', email: 'bad', phone: '' }), {
    fullName: 'Enter your full name.',
    email: 'Enter a valid email address.'
  });
  assert.deepEqual(validateProfileDraft({ fullName: 'Rafi', email: 'rafi@example.com', phone: '' }), {});
  assert.equal(validateProfileDraft({ fullName: 'Rafi', email: 'rafi@example.com', phone: 'call me' }).phone !== undefined, true);
  assert.deepEqual(validateProfileDraft({ fullName: 'Rafi', email: 'rafi@example.com', phone: '+880 17-123 456' }), {});
});

test('profile changed ignores surrounding spaces only', () => {
  const saved = { fullName: 'Rafi', email: 'rafi@example.com', phone: '0170' };
  assert.equal(profileChanged({ fullName: 'Rafi ', email: 'rafi@example.com', phone: '0170' }, saved), false);
  assert.equal(profileChanged({ fullName: 'Rafi Ahmed', email: 'rafi@example.com', phone: '0170' }, saved), true);
  assert.deepEqual(profileDraft(null), { fullName: '', email: '', phone: '' });
});

test('KYC status maps to a label and tone, with a neutral default', () => {
  assert.deepEqual(kycStatusView({ status: 'approved' }), { label: 'Verified', tone: 'success' });
  assert.deepEqual(kycStatusView({ status: 'PENDING' }), { label: 'Pending review', tone: 'warning' });
  assert.deepEqual(kycStatusView(null), { label: 'Not submitted', tone: 'neutral' });
});

test('KYC form needs a known type, a number and an image', () => {
  const image = { type: 'image/jpeg', name: 'passport.jpg' };
  assert.deepEqual(validateKycForm({ documentType: 'driving_license', documentNumber: 'DL-1', documentPhoto: image }), {});
  assert.equal(validateKycForm({ documentType: 'drivers_license', documentNumber: 'DL-1', documentPhoto: image }).documentType !== undefined, true);
  assert.equal(validateKycForm({ documentType: 'passport', documentNumber: ' ', documentPhoto: image }).documentNumber !== undefined, true);
  assert.equal(validateKycForm({ documentType: 'passport', documentNumber: 'P1', documentPhoto: null }).documentPhoto !== undefined, true);
  assert.equal(validateKycForm({ documentType: 'passport', documentNumber: 'P1', documentPhoto: { type: 'application/pdf' } }).documentPhoto !== undefined, true);
});
