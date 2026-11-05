import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LuUser } from 'react-icons/lu';
import ErrorState from '../components/ui/ErrorState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import { notify } from '../utils/notifyStore.js';
import { userMessage } from '../utils/errorMessage.js';
import { profileChanged, profileDraft, validateProfileDraft } from '../utils/operatorProfile.js';
import AvailabilityPanel from './profile/AvailabilityPanel.jsx';
import KycPanel from './profile/KycPanel.jsx';
import ProfileForm from './profile/ProfileForm.jsx';
import StatsStrip from './profile/StatsStrip.jsx';

// The operator's own profile: contact details, availability, performance figures and identity verification.
const OperatorProfile = () => {
  const operatorId = localStorage.getItem('userId');
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(profileDraft(null));
  const [availability, setAvailability] = useState('AVAILABLE');
  const [stats, setStats] = useState({ completedTours: 0, totalTravelers: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [kyc, setKyc] = useState(null);
  const [kycSubmitting, setKycSubmitting] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/operator/${operatorId}/profile`);
      const data = await res.json();
      if (!res.ok || !data.profile) throw new Error(data.message || data.error || 'Your profile could not be loaded.');
      setSaved(data.profile);
      setDraft(profileDraft(data.profile));
      setAvailability(data.profile.availability || 'AVAILABLE');
      setStats({ completedTours: data.stats?.completedTours ?? 0, totalTravelers: data.stats?.totalTravelers ?? 0 });
    } catch (failure) {
      console.error('Failed to load operator profile:', failure);
      setLoadError(userMessage(failure, 'Your profile could not be loaded right now.'));
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  const loadKyc = useCallback(async () => {
    try {
      const res = await fetch('/api/kyc/my-kyc');
      const data = await res.json();
      setKyc(data.success ? data.kyc || null : null);
    } catch (failure) {
      console.error('Failed to load identity verification:', failure);
    }
  }, []);

  useEffect(() => {
    if (!operatorId) {
      setLoading(false);
      setLoadError('You are signed out. Log in again to see your profile.');
      return;
    }
    loadProfile();
    loadKyc();
  }, [operatorId, loadProfile, loadKyc]);

  const errors = useMemo(() => validateProfileDraft(draft), [draft]);
  const dirty = Boolean(saved) && profileChanged(draft, saved);

  // Saves the given fields and keeps the local copy in step with what the server returns.
  const persist = async patch => {
    const res = await fetch(`/api/operator/${operatorId}/profile`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (!res.ok || !data.profile) throw new Error(data.message || data.error || 'Your changes could not be saved.');
    setSaved(current => ({ ...current, ...data.profile }));
    if (data.profile.fullName) localStorage.setItem('userName', data.profile.fullName);
    return data.profile;
  };

  const saveDetails = async () => {
    if (saving || Object.keys(errors).length || !dirty) return;
    setSaving(true);
    try {
      const updated = await persist({ fullName: draft.fullName.trim(), email: draft.email.trim(), phone: draft.phone.trim() });
      setDraft(profileDraft(updated));
      notify.message('Profile saved.');
    } catch (failure) {
      notify.error(userMessage(failure, 'Your changes could not be saved. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async () => {
    if (saving) return;
    const next = availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    setSaving(true);
    try {
      const updated = await persist({ availability: next });
      setAvailability(updated.availability || next);
      notify.message(next === 'AVAILABLE' ? 'You are available for new departures.' : 'You are now unavailable for new departures.');
    } catch (failure) {
      notify.error(userMessage(failure, 'Availability could not be changed. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const submitKyc = async form => {
    setKycSubmitting(true);
    try {
      const body = new FormData();
      body.append('documentType', form.documentType);
      body.append('documentNumber', form.documentNumber.trim());
      body.append('documentImage', form.documentPhoto);
      const res = await fetch('/api/kyc/submit', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'The document could not be submitted.');
      notify.message('Document submitted. An administrator will review it.');
      await loadKyc();
      return true;
    } catch (failure) {
      notify.error(userMessage(failure, 'The document could not be submitted. Please try again.'));
      return false;
    } finally {
      setKycSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="glass-strong flex items-center gap-4 rounded-3xl p-6">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-brand/15">
          <LuUser aria-hidden="true" className="h-6 w-6 text-brand" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl font-semibold text-text sm:text-3xl">{draft.fullName || 'Your profile'}</h2>
          <p className="text-sm text-text-muted">Operator profile and identity verification</p>
        </div>
      </header>

      {loading && (
        <div className="space-y-4" aria-live="polite">
          <p className="sr-only">Loading your profile…</p>
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      )}

      {!loading && loadError && <ErrorState title="Profile unavailable" message={loadError} onRetry={loadProfile} />}

      {!loading && !loadError && saved && (
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <ProfileForm
              draft={draft}
              errors={errors}
              dirty={dirty}
              saving={saving}
              onChange={(field, value) => setDraft(current => ({ ...current, [field]: value }))}
              onSave={saveDetails}
            />
            <KycPanel kyc={kyc} submitting={kycSubmitting} onSubmit={submitKyc} />
          </div>
          <div className="space-y-6">
            <AvailabilityPanel available={availability === 'AVAILABLE'} saving={saving} onToggle={toggleAvailability} />
            <StatsStrip completedTours={stats.completedTours} totalTravelers={stats.totalTravelers} />
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorProfile;
