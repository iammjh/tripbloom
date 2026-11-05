import React, { useState } from 'react';
import { LuIdCard, LuUpload } from 'react-icons/lu';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import { KYC_DOCUMENT_OPTIONS, kycStatusView, validateKycForm } from '../../utils/operatorProfile.js';

const dateTime = value => (value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

// Identity verification: shows the current status and lets the operator submit or resubmit a document.
export default function KycPanel({ kyc, submitting, onSubmit }) {
  const [form, setForm] = useState({ documentType: 'passport', documentNumber: '', documentPhoto: null });
  const [errors, setErrors] = useState({});
  const status = kycStatusView(kyc);
  const statusKey = String(kyc?.status || '').toLowerCase();
  const verified = statusKey === 'approved';
  const canSubmit = !verified && statusKey !== 'pending';

  const submit = async event => {
    event.preventDefault();
    const problems = validateKycForm(form);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const sent = await onSubmit(form);
    if (sent) {
      setForm({ documentType: 'passport', documentNumber: '', documentPhoto: null });
      setErrors({});
    }
  };

  return (
    <section aria-labelledby="kyc-heading" className="glass space-y-5 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="kyc-heading" className="font-display text-lg font-semibold text-text">Identity verification</h2>
          <p className="text-sm text-text-muted">An administrator checks your document before you are assigned departures.</p>
        </div>
        <Badge tone={status.tone} icon={LuIdCard}>{status.label}</Badge>
      </div>

      {verified && (
        <p className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm text-text">
          Your identity was verified{kyc?.verifiedAt ? ` on ${dateTime(kyc.verifiedAt)}` : ''}. To change your documents, contact support.
        </p>
      )}

      {statusKey === 'pending' && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
          Submitted {dateTime(kyc.createdAt) || 'recently'}. An administrator will review it.
        </p>
      )}

      {statusKey === 'rejected' && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-text">
          This document was rejected. Check that the photo is clear and the number matches, then submit it again.
        </p>
      )}

      {canSubmit && (
        <form onSubmit={submit} noValidate className="grid gap-4 md:grid-cols-2">
          <FormField id="kyc-type" label="Document type" required error={errors.documentType}>
            <select id="kyc-type" value={form.documentType} onChange={e => setForm(current => ({ ...current, documentType: e.target.value }))} className={inputClass}>
              {KYC_DOCUMENT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormField>
          <FormField id="kyc-number" label="Document number" required error={errors.documentNumber}>
            <input id="kyc-number" value={form.documentNumber} onChange={e => setForm(current => ({ ...current, documentNumber: e.target.value }))} className={inputClass} aria-invalid={Boolean(errors.documentNumber) || undefined} />
          </FormField>
          <FormField id="kyc-photo" label="Photo of the document" required error={errors.documentPhoto} hint="JPG or PNG. Make sure every detail is readable." className="md:col-span-2">
            <span className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-sm text-text-muted hover:text-text focus-within:ring-2 focus-within:ring-brand/50">
              <LuUpload aria-hidden="true" className="h-4 w-4 flex-none" />
              <span className="min-w-0 truncate">{form.documentPhoto ? form.documentPhoto.name : 'Choose an image'}</span>
              <input
                id="kyc-photo"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={e => setForm(current => ({ ...current, documentPhoto: e.target.files?.[0] || null }))}
              />
            </span>
          </FormField>
          <div className="flex justify-end md:col-span-2">
            <Button type="submit" icon={LuUpload} loading={submitting}>{kyc?.status ? 'Resubmit document' : 'Submit document'}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
