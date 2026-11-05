import React, { useState, useEffect } from 'react';
import { LuCalendarDays, LuCircleCheck, LuMail, LuPhone, LuTriangleAlert, LuUserCog, LuUsers, LuWallet } from 'react-icons/lu';
import axios from 'axios';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import EmptyState from './ui/EmptyState.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { confirmAction } from '../utils/confirmStore.js';
import { notify } from '../utils/notifyStore.js';
import { userMessage } from '../utils/errorMessage.js';

const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const DEPARTURE_TONE = { OPEN: 'success', FULL: 'warning', CLOSED: 'neutral', CANCELLED: 'danger' };

// Literal class names so Tailwind keeps them.
const STAT_TEXT = { brand: 'text-brand', success: 'text-success' };

function Stat({ label, value, tone = 'brand' }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <p className={`font-display text-2xl font-semibold ${STAT_TEXT[tone]}`}>{value}</p>
      <p className="mt-1 text-sm text-text-muted">{label}</p>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-4">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-text-muted">{label}</p>
        <p className="truncate font-semibold text-text">{value}</p>
      </div>
    </div>
  );
}

// Operator profile: contact details, past performance and upcoming departures. Inactive operators can be removed from their upcoming departures.
const OperatorDetailModal = ({ isOpen, onClose, operator, onEdit, onUserUpdated }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opStats, setOpStats] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('profile');
      setDepartures([]);
      setLoadError('');
    }
  }, [isOpen, operator?._id]);

  useEffect(() => {
    if (!isOpen || !operator?._id) return;
    axios.get('/api/group-departure/operator/' + operator._id + '/future')
      .then(res => setDepartures([...(res.data.departures || [])].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))))
      .catch(failure => {
        console.error('Failed to load operator departures:', failure);
        setLoadError('Upcoming departures could not be loaded.');
      })
      .finally(() => setLoading(false));
    setLoading(true);
  }, [isOpen, operator?._id]);

  useEffect(() => {
    if (!isOpen || !operator?._id) return;
    axios.get('/api/admin/operators/stats')
      .then(res => setOpStats((res.data.operators || []).find(item => String(item._id) === String(operator._id)) || null))
      .catch(() => setOpStats(null));
  }, [isOpen, operator?._id]);

  if (!operator) return null;

  const removeFromUpcoming = async () => {
    const confirmed = await confirmAction({
      title: 'Remove from upcoming departures?',
      message: `${operator.fullName} will be removed from ${departures.length} upcoming departure(s). Those departures will have no operator until you assign another one.`,
      confirmLabel: 'Confirm removal',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      const res = await axios.post(`/api/group-departure/operator/${operator._id}/remove-future`);
      notify.message(res.data?.message || 'Operator removed from upcoming departures.');
      onUserUpdated?.();
      onClose();
    } catch (failure) {
      console.error('Failed to remove operator from departures:', failure);
      notify.error(userMessage(failure, 'The departures could not be updated. Nothing changed; please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const showRemove = !operator.isActive && departures.length > 0;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={operator.fullName || 'Tour operator'}
      description="Tour operator profile"
      size="xl"
      rootClassName="dark"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <div className="flex flex-wrap gap-2">
            {showRemove && (
              <Button variant="danger" icon={LuUsers} onClick={removeFromUpcoming} loading={busy} disabled={busy}>
                Remove from departures
              </Button>
            )}
            <Button variant="secondary" onClick={() => onEdit?.(operator)} disabled={busy}>Edit operator</Button>
          </div>
        </>
      )}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={operator.isActive ? 'success' : 'danger'}>{operator.isActive ? 'Active' : 'Inactive'}</Badge>
          <Badge tone="info">Tour operator</Badge>
        </div>

        <div role="tablist" aria-label="Operator sections" className="glass flex flex-wrap gap-1 rounded-full p-1">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'assignments', label: 'Upcoming departures', count: departures.length },
          ].map(tab => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${selected ? 'bg-brand text-on-brand shadow-sm' : 'text-text-muted hover:text-text'}`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && <span className={`rounded-full px-2 text-xs ${selected ? 'bg-on-brand/20' : 'bg-surface-muted'}`}>{tab.count}</span>}
              </button>
            );
          })}
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <section aria-labelledby="operator-contact-heading" className="space-y-3">
              <h3 id="operator-contact-heading" className="font-display text-base font-semibold text-text">Contact</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoTile icon={LuMail} label="Email" value={operator.email || 'Not provided'} />
                <InfoTile icon={LuPhone} label="Phone" value={operator.phone || 'Not provided'} />
                <InfoTile icon={LuUserCog} label="Roles" value={operator.roles?.join(', ') || 'Tour operator'} />
                <InfoTile icon={LuCalendarDays} label="Status" value={operator.isActive ? 'Active' : 'Inactive'} />
              </div>
            </section>

            <section aria-labelledby="operator-performance-heading" className="space-y-3">
              <h3 id="operator-performance-heading" className="font-display text-base font-semibold text-text">Past performance</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Packages assigned" value={opStats ? opStats.packageCount : '—'} />
                <Stat label="Bookings handled" value={opStats ? opStats.bookingCount : '—'} tone="success" />
                <Stat label="Net receipts (BDT)" value={opStats ? Number(opStats.totalRevenue || 0).toLocaleString() : '—'} />
              </div>
            </section>
          </div>
        )}

        {activeTab === 'assignments' && (
          <section aria-labelledby="operator-departures-heading" className="space-y-4">
            <h3 id="operator-departures-heading" className="font-display text-base font-semibold text-text">Upcoming group departures</h3>

            {showRemove && (
              <p role="alert" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
                <LuTriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-warning" />
                <span>This operator is inactive but still assigned to {departures.length} upcoming departure(s). Assign another operator to each departure, or remove this operator from them.</span>
              </p>
            )}

            {loading && <Skeleton className="h-24 w-full rounded-xl" />}
            {!loading && loadError && <p role="alert" className="text-sm text-danger">{loadError}</p>}
            {!loading && !loadError && departures.length === 0 && <EmptyState title="No upcoming departures" description="Departures starting from today that include this operator appear here." />}
            {!loading && !loadError && departures.length > 0 && (
              <ul className="space-y-3">
                {departures.map(departure => (
                  <li key={departure._id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-text">{departure.packageId?.title || departure.packageId?.name || 'Package'}</p>
                      <p className="text-sm text-text-muted">
                        {formatDate(departure.startDate)} – {formatDate(departure.endDate)} · Seats {departure.bookedSeats}/{departure.totalSeats}
                      </p>
                    </div>
                    <Badge tone={DEPARTURE_TONE[departure.status] || 'neutral'}>{departure.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
};

export default OperatorDetailModal;
