import React from 'react';
import { LuMail, LuPhone, LuSave, LuUser } from 'react-icons/lu';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';

// Name, email and phone. Availability and documents have their own panels.
export default function ProfileForm({ draft, errors, dirty, saving, onChange, onSave }) {
  const submit = event => {
    event.preventDefault();
    onSave();
  };

  return (
    <form onSubmit={submit} noValidate className="glass space-y-5 rounded-2xl p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-text">Contact details</h2>
        <p className="text-sm text-text-muted">Travellers and administrators see these details on your departures.</p>
      </div>

      <FormField id="profile-name" label="Full name" required error={errors.fullName}>
        <div className="relative">
          <LuUser aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input id="profile-name" value={draft.fullName} onChange={e => onChange('fullName', e.target.value)} autoComplete="name" className={`${inputClass} pl-9`} aria-invalid={Boolean(errors.fullName) || undefined} />
        </div>
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="profile-email" label="Email" required error={errors.email}>
          <div className="relative">
            <LuMail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input id="profile-email" type="email" value={draft.email} onChange={e => onChange('email', e.target.value)} autoComplete="email" className={`${inputClass} pl-9`} aria-invalid={Boolean(errors.email) || undefined} />
          </div>
        </FormField>
        <FormField id="profile-phone" label="Phone" error={errors.phone}>
          <div className="relative">
            <LuPhone aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input id="profile-phone" type="tel" value={draft.phone} onChange={e => onChange('phone', e.target.value)} autoComplete="tel" placeholder="+880 17xx xxxxxx" className={`${inputClass} pl-9`} aria-invalid={Boolean(errors.phone) || undefined} />
          </div>
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-text-muted">{dirty ? 'You have unsaved changes.' : 'All changes are saved.'}</span>
        <Button type="submit" icon={LuSave} loading={saving} disabled={!dirty || saving}>Save details</Button>
      </div>
    </form>
  );
}
