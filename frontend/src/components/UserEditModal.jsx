import React, { useState, useEffect } from 'react';
import { LuKeyRound, LuMail, LuPhone, LuShieldCheck, LuUser } from 'react-icons/lu';
import axios from 'axios';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import FormField, { fieldAria, inputClass } from './ui/FormField.jsx';
import { notify } from '../utils/notifyStore.js';

const ROLE_OPTIONS = [
  { value: 'CUSTOMER', label: 'Customer', hint: 'Can book tours and manage their bookings.' },
  { value: 'TOUR_OPERATOR', label: 'Tour operator', hint: 'Can manage tour operations and departures.' },
  { value: 'ADMIN', label: 'Administrator', hint: 'Full system access and management capabilities.' },
];

const EMPTY_FORM = { fullName: '', email: '', phone: '', password: '', roles: ['CUSTOMER'], isActive: true };

// Create or edit a user. Roles and status are saved through the audited admin endpoints, so the form reports each outcome.
const UserEditModal = ({ isOpen, onClose, user, onUserUpdated }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      // Editing: normalise roles to uppercase so the checkboxes match.
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        roles: (user.roles || ['CUSTOMER']).map(role => String(role).toUpperCase()),
        isActive: user.isActive !== undefined ? user.isActive : true,
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setError('');
  }, [user, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleRole = (role) => {
    setFormData(prev => {
      const hasRole = prev.roles.includes(role);
      const roles = hasRole ? prev.roles.filter(r => r !== role) : [...prev.roles, role];
      // A user always keeps at least one role.
      return { ...prev, roles: roles.length > 0 ? roles : prev.roles };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.fullName.trim() || !formData.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!user && !formData.password) {
      setError('A password is required for new users.');
      return;
    }
    if (formData.roles.length === 0) {
      setError('Select at least one role.');
      return;
    }

    // Existing users: only the fields the backend applies. Roles and status go through the audited admin services.
    const payload = user
      ? { fullName: formData.fullName, phone: formData.phone, roles: formData.roles, isActive: formData.isActive }
      : { fullName: formData.fullName, email: formData.email, phone: formData.phone, roles: formData.roles, isActive: formData.isActive, password: formData.password };

    setLoading(true);
    try {
      if (user) {
        await axios.put(`/api/admin/users/${user._id}`, payload);
        notify.message(payload.isActive ? `${payload.fullName} is saved and active.` : `${payload.fullName} is saved and suspended.`);
      } else {
        await axios.post('/api/admin/users', payload);
        notify.message(`${payload.fullName} was added.`);
      }
      onUserUpdated?.();
      onClose();
    } catch (failure) {
      console.error('Failed to save user:', failure);
      const message = failure.response?.data?.message || 'The user could not be saved. Nothing changed; please try again.';
      setError(message);
      notify.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = inputClass;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={user ? 'Edit user' : 'Add user'}
      description={user ? 'Name, phone, roles and account status. Email is the sign-in address and cannot change here.' : 'Create an account with a sign-in password and its roles.'}
      size="lg"
      rootClassName="dark"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="user-edit-form" loading={loading}>
            {user ? 'Save changes' : 'Create user'}
          </Button>
        </>
      )}
    >
      <form id="user-edit-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
        {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}

        <section aria-labelledby="user-profile-heading" className="space-y-4">
          <h3 id="user-profile-heading" className="font-display text-base font-semibold text-text">Profile</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="user-full-name" label="Full name" required>
              <div className="relative">
                <LuUser aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input {...fieldAria('user-full-name')} name="fullName" value={formData.fullName} onChange={handleChange} className={`${fieldClass} pl-9`} placeholder="Enter full name" autoComplete="off" />
              </div>
            </FormField>
            <FormField id="user-email" label="Email address" required hint={user ? 'Cannot be changed here.' : 'Used to sign in.'}>
              <div className="relative">
                <LuMail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input {...fieldAria('user-email', { hint: true })} type="email" name="email" value={formData.email} onChange={handleChange} disabled={Boolean(user)} className={`${fieldClass} pl-9`} placeholder="user@example.com" autoComplete="off" />
              </div>
            </FormField>
            <FormField id="user-phone" label="Phone number">
              <div className="relative">
                <LuPhone aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input {...fieldAria('user-phone')} type="tel" name="phone" value={formData.phone} onChange={handleChange} className={`${fieldClass} pl-9`} placeholder="+8801XXXXXXXXX" autoComplete="off" />
              </div>
            </FormField>
            {!user && (
              <FormField id="user-password" label="Password" required hint="Give this to the user; they can change it after signing in.">
                <div className="relative">
                  <LuKeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input {...fieldAria('user-password', { hint: true })} type="password" name="password" value={formData.password} onChange={handleChange} className={`${fieldClass} pl-9`} placeholder="Enter password" autoComplete="new-password" />
                </div>
              </FormField>
            )}
          </div>
        </section>

        <section aria-labelledby="user-roles-heading" className="space-y-3">
          <h3 id="user-roles-heading" className="flex items-center gap-2 font-display text-base font-semibold text-text">
            <LuShieldCheck aria-hidden="true" className="h-4 w-4 text-brand" /> Roles
          </h3>
          <p className="text-sm text-text-muted">Select at least one. A role change takes effect the next time the user signs in.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {ROLE_OPTIONS.map(option => {
              const checked = formData.roles.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors ${checked ? 'border-brand/50 bg-brand/5' : 'border-border hover:bg-surface-muted'}`}
                >
                  <span className="flex items-center gap-3">
                    <input type="checkbox" name="roles" value={option.value} checked={checked} onChange={() => toggleRole(option.value)} className="h-5 w-5 accent-brand" />
                    <span className="font-semibold text-text">{option.label}</span>
                  </span>
                  <span className="text-xs text-text-muted">{option.hint}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="user-status-heading" className="space-y-3">
          <h3 id="user-status-heading" className="font-display text-base font-semibold text-text">Account status</h3>
          <label className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${formData.isActive ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'}`}>
            <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} className="mt-1 h-5 w-5 accent-brand" />
            <span className="min-w-0">
              <span className="block font-semibold text-text">{formData.isActive ? 'Active account' : 'Suspended account'}</span>
              <span className="mt-1 block text-sm text-text-muted">
                {formData.isActive ? 'The user can sign in and use their roles.' : 'Suspended users cannot sign in until the account is reactivated.'}
              </span>
            </span>
          </label>
        </section>
      </form>
    </Modal>
  );
};

export default UserEditModal;
