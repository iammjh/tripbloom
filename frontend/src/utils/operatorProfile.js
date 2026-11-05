// Operator profile and KYC helpers. Option values match the backend: KYC document types are in kyc.model.js.

export const KYC_DOCUMENT_OPTIONS = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driving_license', label: 'Driving licence' }
];

const KYC_STATUS_VIEW = {
  pending: { label: 'Pending review', tone: 'warning' },
  approved: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' }
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+0-9 ()-]{6,20}$/;

export function profileDraft(profile) {
  const source = profile || {};
  return {
    fullName: source.fullName || '',
    email: source.email || '',
    phone: source.phone || ''
  };
}

// Same rules as the server, so the operator sees the problem before a request is sent.
export function validateProfileDraft(draft) {
  const errors = {};
  if (!String(draft.fullName || '').trim()) errors.fullName = 'Enter your full name.';
  if (!EMAIL.test(String(draft.email || '').trim())) errors.email = 'Enter a valid email address.';
  const phone = String(draft.phone || '').trim();
  if (phone && !PHONE.test(phone)) errors.phone = 'Use digits, spaces, +, - or brackets for the phone number.';
  return errors;
}

export function profileChanged(draft, saved) {
  const current = profileDraft(draft);
  const original = profileDraft(saved);
  return Object.keys(current).some(key => current[key].trim() !== original[key].trim());
}

export function kycStatusView(kyc) {
  const status = String(kyc?.status || '').toLowerCase();
  return KYC_STATUS_VIEW[status] || { label: 'Not submitted', tone: 'neutral' };
}

export function validateKycForm({ documentType, documentNumber, documentPhoto }) {
  const errors = {};
  if (!KYC_DOCUMENT_OPTIONS.some(option => option.value === documentType)) errors.documentType = 'Choose a document type.';
  if (!String(documentNumber || '').trim()) errors.documentNumber = 'Enter the document number.';
  if (!documentPhoto) errors.documentPhoto = 'Upload a photo of the document.';
  else if (!String(documentPhoto.type || '').startsWith('image/')) errors.documentPhoto = 'Upload an image file (JPG, PNG or similar).';
  return errors;
}
