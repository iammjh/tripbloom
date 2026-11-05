import { LuCircleCheck, LuClock, LuIdCard, LuLock, LuMail, LuPhone, LuSave, LuTriangleAlert, LuUser } from 'react-icons/lu';
import { ChecklistIcon, StarIcon } from './ui/icons.js';
import { confirmAction } from '../utils/confirmStore.js';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CustomerPageFrame from './customer/CustomerPageFrame.jsx';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import FormField, { inputClass } from './ui/FormField.jsx';


const CustomerProfile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Profile info state
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    age: '',
    rewardPoints: 0,
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'password', or 'kyc'
  const [kycData, setKycData] = useState(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycForm, setKycForm] = useState({
    documentType: 'passport',
    documentNumber: '',
    documentPhoto: null,
  });

  useEffect(() => {
    // Load current user data
    const loadProfile = async () => {
      const userId = user?.id || localStorage.getItem('userId');
      if (!userId) {
        navigate('/');
        return;
      }

      try {
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();
        if (data.success && data.user) {
          setProfileData({
            fullName: data.user.fullName || '',
            email: data.user.email || '',
            phone: data.user.phone || '',
            age: data.user.age || '',
            rewardPoints: data.user.rewardPoints || 0,
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };
    loadProfile();
    loadKYC();
  }, [user, navigate]);

  const loadKYC = async () => {
    const userId = user?.id || localStorage.getItem('userId');
    if (!userId) return;

    try {
      const res = await fetch('/api/kyc/my-kyc', {
        headers: {
          'x-user-id': userId
        }
      });
      const data = await res.json();
      if (data.success && data.kyc) {
        setKycData(data.kyc);
      }
    } catch (err) {
      console.error('Failed to load KYC:', err);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const userId = user?.id || localStorage.getItem('userId');
    if (!userId) {
      setError('User not found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profileData.fullName,
          phone: profileData.phone,
          age: profileData.age && profileData.age !== '' ? parseInt(profileData.age) : null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Profile updated successfully!');
        // Update state with server response to reflect saved values
        if (data.user) {
          setProfileData({
            fullName: data.user.fullName || '',
            email: data.user.email || profileData.email,
            phone: data.user.phone || '',
            age: data.user.age !== undefined && data.user.age !== null ? data.user.age : '',
            rewardPoints: data.user.rewardPoints || profileData.rewardPoints,
          });
        }
        // Update localStorage if name changed
        if (profileData.fullName) {
          localStorage.setItem('userName', profileData.fullName);
        }
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('All password fields are required');
      setLoading(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const userId = user?.id || localStorage.getItem('userId');
    if (!userId) {
      setError('User not found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Password changed successfully! Please log in again.');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        // Log out user after password change
        setTimeout(() => {
          logout();
          navigate('/');
        }, 2000);
      } else {
        setError(data.message || 'Failed to change password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKYCSubmit = async (e) => {
    e.preventDefault();
    setKycLoading(true);
    setMessage(null);
    setError(null);
    // If currently approved, warn user that resubmitting will set status back to pending
    if (kycData && (kycData.status || '').toString().toLowerCase() === 'approved') {
      const ok = await confirmAction({ message: 'Your KYC is already verified. Resubmitting will set status back to PENDING and require admin re-verification. Do you want to continue?' });
      if (!ok) {
        setKycLoading(false);
        return;
      }
    }
    try {
      const userId = user?.id || localStorage.getItem('userId');
      if (!userId) {
        setError('User not found. Please log in again.');
        setKycLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('documentType', kycForm.documentType);
      formData.append('documentNumber', kycForm.documentNumber);
      if (kycForm.documentPhoto) {
        formData.append('documentImage', kycForm.documentPhoto);
      }

      const res = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: {
          'x-user-id': userId
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setMessage('KYC submitted successfully! Awaiting verification.');
        loadKYC();
        setKycForm({
          documentType: 'passport',
          documentNumber: '',
          documentPhoto: null,
        });
      } else {
        setError(data.message || 'Failed to submit KYC');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setKycLoading(false);
    }
  };

  const getKYCStatusBadge = (status) => {
    const s = (status || '').toString().toUpperCase();
    if (s === 'VERIFIED' || s === 'APPROVED') return <Badge value="VERIFIED" />;
    if (s === 'PENDING') return <Badge value="PENDING" />;
    if (s === 'REJECTED') return <Badge value="REJECTED" />;
    return <Badge tone="neutral">Not submitted</Badge>;
  };

  // Normalized status string for checks in the component (handles backend values like 'pending'/'approved')
  const kycStatus = kycData && kycData.status ? kycData.status.toString().toUpperCase() : null;
  const kycVerified = kycStatus === 'VERIFIED' || kycStatus === 'APPROVED';

  const tabs = [
    { key: 'profile', label: 'Profile information', icon: LuUser },
    { key: 'password', label: 'Change password', icon: LuLock },
    { key: 'kyc', label: 'KYC verification', icon: LuIdCard },
  ];

  return (
    <CustomerPageFrame
      active="profile"
      eyebrow="Account"
      title="Profile settings"
      description="Manage your account information, password and identity verification."
    >
      {message && (
        <p role="status" className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm text-text">{message}</p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-text">{error}</p>
      )}

      <section aria-label="Reward points" className="glass flex flex-col gap-2 rounded-2xl p-6 ring-1 ring-brand/30 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">Reward points</p>
          <p className="mt-1 flex items-center gap-2 font-display text-3xl font-bold text-text">
            <StarIcon aria-hidden="true" className="h-6 w-6 text-brand" />
            {Number(profileData.rewardPoints || 0).toLocaleString()} points
          </p>
        </div>
        <p className="max-w-sm text-sm text-text-muted">1 point = 1 BDT. Points are shown for reference; they are not applied to bookings yet.</p>
      </section>

      <div className="glass overflow-hidden rounded-2xl">
        <div role="tablist" aria-label="Profile sections" className="flex flex-wrap gap-1 border-b border-border p-2">
          {tabs.map(({ key, label, icon: Icon }) => {
            const selected = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={selected}
                aria-controls={`panel-${key}`}
                onClick={() => setActiveTab(key)}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-150 ${
                  selected ? 'bg-brand text-on-brand' : 'text-text-muted hover:bg-surface-muted hover:text-text'
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {label}
                {key === 'kyc' && kycVerified && <LuCircleCheck aria-hidden="true" className="h-4 w-4 text-success" />}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="space-y-6 p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="space-y-5">
              <FormField id="profile-name" label="Full name" required>
                <input
                  id="profile-name"
                  type="text"
                  value={profileData.fullName}
                  onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                  className={inputClass}
                  required
                />
              </FormField>

              <FormField id="profile-email" label="Email address" hint="Email cannot be changed.">
                <input id="profile-email" type="email" value={profileData.email} disabled className={inputClass} aria-describedby="profile-email-hint" />
              </FormField>

              <FormField id="profile-phone" label="Phone number">
                <input
                  id="profile-phone"
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className={inputClass}
                />
              </FormField>

              <FormField id="profile-age" label="Age">
                <input
                  id="profile-age"
                  type="number"
                  min="1"
                  max="120"
                  value={profileData.age}
                  onChange={(e) => setProfileData({ ...profileData, age: e.target.value })}
                  placeholder="Enter your age"
                  className={inputClass}
                />
              </FormField>

              <div className="flex justify-end">
                <Button type="submit" icon={LuSave} loading={loading}>{loading ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <FormField id="password-current" label="Current password" required>
                <input
                  id="password-current"
                  type="password"
                  autoComplete="current-password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className={inputClass}
                  required
                />
              </FormField>

              <FormField id="password-new" label="New password" hint="At least 6 characters." required>
                <input
                  id="password-new"
                  type="password"
                  autoComplete="new-password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className={inputClass}
                  required
                  minLength={6}
                />
              </FormField>

              <FormField id="password-confirm" label="Confirm new password" required>
                <input
                  id="password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className={inputClass}
                  required
                />
              </FormField>

              <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
                <LuTriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-warning" />
                <p>You will be logged out after changing your password. Please log in again with your new password.</p>
              </div>

              <div className="flex justify-end">
                <Button type="submit" icon={LuLock} loading={loading}>{loading ? 'Changing…' : 'Change password'}</Button>
              </div>
            </form>
          )}

          {activeTab === 'kyc' && (
            <div className="space-y-6">
              {kycData && (
                <section aria-label="KYC status" className="rounded-xl border border-border bg-surface-muted p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-text">KYC status</p>
                      <p className="mt-1 text-text-muted">
                        Submitted on {kycData.createdAt ? new Date(kycData.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                      {kycStatus === 'REJECTED' && kycData.rejectionReason && (
                        <p className="mt-2 text-danger">Rejection reason: {kycData.rejectionReason}</p>
                      )}
                    </div>
                    <div>{getKYCStatusBadge(kycData.status)}</div>
                  </div>
                  {kycVerified && (
                    <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm font-semibold text-success">
                      <LuCircleCheck aria-hidden="true" className="h-4 w-4 flex-none" /> You can now book international tour packages.
                    </p>
                  )}
                  {kycStatus === 'PENDING' && (
                    <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm font-semibold text-warning">
                      <LuClock aria-hidden="true" className="h-4 w-4 flex-none" /> Your KYC is under review. We will notify you once it is verified.
                    </p>
                  )}
                </section>
              )}

              <section aria-labelledby="kyc-why" className="rounded-xl border border-brand/30 bg-brand/5 p-4">
                <h3 id="kyc-why" className="flex items-center gap-2 font-semibold text-text"><ChecklistIcon aria-hidden="true" className="h-4 w-4 text-brand" /> Why KYC verification?</h3>
                <p className="mt-2 text-sm text-text-muted">
                  KYC (Know Your Customer) verification is required for booking international tour packages. It confirms your identity for travel documentation.
                </p>
              </section>

              {kycVerified ? (
                <div className="rounded-xl border border-success/40 bg-success/10 p-4">
                  <p className="font-semibold text-text">KYC verified</p>
                  <p className="mt-1 text-sm text-text-muted">Your identity has been verified by an administrator.</p>
                  {kycData && (kycData.verifiedBy || kycData.verifiedAt) && (
                    <p className="mt-2 text-sm text-text-muted">
                      {kycData.verifiedBy ? `Verified by: ${kycData.verifiedBy}` : null}
                      {kycData.verifiedAt ? `${kycData.verifiedBy ? ' • ' : ''}On: ${new Date(kycData.verifiedAt).toLocaleString()}` : null}
                    </p>
                  )}
                  <p className="mt-3 text-sm text-text-muted">To update your documents, contact support.</p>
                </div>
              ) : (!kycData || kycStatus === 'REJECTED') && (
                <form onSubmit={handleKYCSubmit} className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField id="kyc-type" label="Document type" required>
                      <select
                        id="kyc-type"
                        value={kycForm.documentType}
                        onChange={(e) => setKycForm({ ...kycForm, documentType: e.target.value })}
                        className={inputClass}
                        required
                      >
                        <option value="passport">Passport</option>
                        <option value="national_id">National ID</option>
                        <option value="driving_license">Driving licence</option>
                      </select>
                    </FormField>

                    <FormField id="kyc-number" label="Document number" required>
                      <input
                        id="kyc-number"
                        type="text"
                        value={kycForm.documentNumber}
                        onChange={(e) => setKycForm({ ...kycForm, documentNumber: e.target.value })}
                        placeholder={kycForm.documentType === 'passport' ? 'e.g., BD1234567' : kycForm.documentType === 'national_id' ? 'e.g., 1234567890123' : 'e.g., DL123456'}
                        className={inputClass}
                        required
                      />
                    </FormField>
                  </div>

                  <FormField id="kyc-file" label="Document image" hint="A clear photo of the document: JPG, PNG or PDF, up to 5 MB." required>
                    <input
                      id="kyc-file"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setKycForm({ ...kycForm, documentPhoto: e.target.files[0] })}
                      className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand/15 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand`}
                      required
                    />
                  </FormField>

                  <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
                    <LuTriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-warning" />
                    <p>Make sure the details match your official documents. Incorrect information may delay verification.</p>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" icon={LuIdCard} loading={kycLoading}>{kycLoading ? 'Submitting…' : 'Submit KYC'}</Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </CustomerPageFrame>
  );
};

export default CustomerProfile;
