import React, { useState, useEffect, useCallback } from 'react';
import { LuCalendarDays, LuCircleCheck, LuMail, LuPhone, LuShieldCheck, LuShoppingCart, LuTriangleAlert, LuUser, LuUserCog, LuWallet } from 'react-icons/lu';
import axios from 'axios';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import EmptyState from './ui/EmptyState.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { AdminTable, tdClass, thClass } from './admin/AdminPrimitives.jsx';
import { bookingLabel } from '../utils/bookingCode.js';
import { confirmAction } from '../utils/confirmStore.js';
import { notify } from '../utils/notifyStore.js';
import { userMessage } from '../utils/errorMessage.js';

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const money = (amount) => `BDT ${Number(amount || 0).toLocaleString()}`;

const BOOKING_TONE = { PENDING: 'warning', CONFIRMED: 'success', CANCELLED: 'danger', COMPLETED: 'info', REFUNDED: 'neutral' };
const DEPARTURE_TONE = { OPEN: 'success', FULL: 'warning', CLOSED: 'neutral', CANCELLED: 'danger' };

const isOperatorRole = (roles = []) => roles.some(r => ['TOUR_OPERATOR', 'OPERATOR'].includes(String(r).toUpperCase()));
const isCustomerRole = (roles = []) => roles.some(r => String(r).toUpperCase() === 'CUSTOMER');
const isAdminRole = (roles = []) => roles.some(r => String(r).toUpperCase() === 'ADMIN');
const roleLabel = (role) => {
  const upper = String(role).toUpperCase();
  if (upper === 'TOUR_OPERATOR' || upper === 'OPERATOR') return 'Tour operator';
  if (upper === 'ADMIN') return 'Administrator';
  return 'Customer';
};

// Tiles used in the profile summary.
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

// Literal class names so Tailwind keeps them.
const COUNT_TEXT = { brand: 'text-brand', success: 'text-success', warning: 'text-warning' };

function CountTile({ label, value, tone = 'brand' }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <p className={`font-display text-2xl font-semibold ${COUNT_TEXT[tone]}`}>{value}</p>
      <p className="mt-1 text-sm text-text-muted">{label}</p>
    </div>
  );
}

// Profile dialog for a user: contact details, bookings, payments and operator assignments. Suspension goes through an in-app confirmation.
const UserDetailModal = ({ isOpen, onClose, user, onEdit, onUserUpdated }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [bookings, setBookings] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [suspending, setSuspending] = useState(false);

  const roles = user?.roles || [];
  const operator = isOperatorRole(roles);
  const customer = isCustomerRole(roles);
  const admin = isAdminRole(roles);

  // Open on the most relevant tab: operators on assignments, everyone else on the profile.
  useEffect(() => {
    if (!isOpen || !user) return;
    setActiveTab(operator && !customer ? 'assignments' : 'profile');
    setBookings([]);
    setDepartures([]);
    setLoadError('');
  }, [isOpen, user?._id]);

  const loadTab = useCallback(async () => {
    if (!user) return;
    if (activeTab !== 'bookings' && activeTab !== 'payments' && activeTab !== 'assignments') return;
    setLoading(true);
    setLoadError('');
    try {
      if (activeTab === 'assignments') {
        const res = await axios.get(`/api/group-departure/operator/${user._id}/future`);
        setDepartures(res.data.departures || []);
      } else {
        const res = await axios.get('/api/bookings', { params: { customerId: user._id } });
        setBookings(res.data.bookings || []);
      }
    } catch (failure) {
      console.error('Failed to load user activity:', failure);
      setLoadError('This activity could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (isOpen) loadTab();
  }, [isOpen, loadTab]);

  const toggleSuspension = async () => {
    const suspend = Boolean(user.isActive);
    const confirmed = await confirmAction({
      title: suspend ? 'Suspend this account?' : 'Reactivate this account?',
      message: suspend
        ? `${user.fullName} will not be able to sign in. Their bookings and history are kept.`
        : `${user.fullName} will be able to sign in again.`,
      confirmLabel: suspend ? 'Confirm suspension' : 'Confirm reactivation',
      danger: suspend,
    });
    if (!confirmed) return;

    setSuspending(true);
    try {
      await axios.post(`/api/admin/users/${user._id}/suspend`, {
        suspend,
        reason: suspend ? 'Suspended from the user profile' : 'Reactivated from the user profile',
      });
      notify.message(suspend ? `${user.fullName} is suspended.` : `${user.fullName} is active again.`);
      onUserUpdated?.();
      onClose();
    } catch (failure) {
      console.error('Failed to change account status:', failure);
      notify.error(userMessage(failure, 'The account status could not be changed. Nothing changed; please try again.'));
    } finally {
      setSuspending(false);
    }
  };

  if (!user) return null;

  const activeBookings = bookings.filter(b => ['PENDING', 'CONFIRMED'].includes(b.status));
  const futureDepartures = departures.filter(d => new Date(d.startDate) > new Date());

  // Payment submissions and receipts recorded on the customer's bookings (refund rows are not payments).
  const payments = bookings.flatMap(booking => (booking.payments || [])
    .filter(payment => payment.method !== 'REFUND')
    .map(payment => ({
      id: String(payment._id),
      date: payment.paidAt || payment.submittedAt || payment.createdAt || booking.createdAt,
      amount: Number(payment.amount) || 0,
      method: payment.method,
      status: payment.status,
      label: bookingLabel(booking),
    })));
  const totalPaid = payments.reduce((sum, p) => sum + (p.status === 'SUCCESS' ? p.amount : 0), 0);

  const tabs = [{ id: 'profile', label: 'Profile', icon: LuUser }];
  if (customer) {
    tabs.push({ id: 'bookings', label: 'Bookings', icon: LuShoppingCart, count: bookings.length });
    tabs.push({ id: 'payments', label: 'Payments', icon: LuWallet, count: payments.length });
  }
  if (operator) {
    tabs.push({ id: 'assignments', label: 'Assignments', icon: LuUserCog, count: departures.length });
  }

  const showWarning = user.isActive && (activeBookings.length > 0 || futureDepartures.length > 0);
  const statusTone = user.isActive ? 'success' : 'danger';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={user.fullName || 'User profile'}
      description={roles.map(roleLabel).join(' · ') || 'No roles'}
      size="xl"
      rootClassName="dark"
      footer={(
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={user.isActive ? 'danger' : 'primary'} onClick={toggleSuspension} loading={suspending} disabled={suspending}>
              {user.isActive ? 'Suspend account' : 'Reactivate account'}
            </Button>
            <Button variant="secondary" icon={LuShieldCheck} onClick={() => onEdit?.(user)} disabled={suspending}>Edit user</Button>
          </div>
        </>
      )}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone}>{user.isActive ? 'Active' : 'Suspended'}</Badge>
          {roles.map(role => <Badge key={role} tone={admin && String(role).toUpperCase() === 'ADMIN' ? 'danger' : 'info'}>{roleLabel(role)}</Badge>)}
        </div>

        {showWarning && (
          <p role="alert" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
            <LuTriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-warning" />
            <span>
              This user has {activeBookings.length} active booking(s)
              {futureDepartures.length > 0 && ` and ${futureDepartures.length} future departure(s)`}.
              Suspending prevents sign-in but keeps all data.
            </span>
          </p>
        )}

        <div role="tablist" aria-label="User sections" className="glass flex flex-wrap gap-1 rounded-full p-1">
          {tabs.map(tab => {
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
                <tab.icon aria-hidden="true" className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && <span className={`rounded-full px-2 text-xs ${selected ? 'bg-on-brand/20' : 'bg-surface-muted'}`}>{tab.count}</span>}
              </button>
            );
          })}
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <section aria-labelledby="user-contact-heading" className="space-y-3">
              <h3 id="user-contact-heading" className="font-display text-base font-semibold text-text">Contact</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoTile icon={LuMail} label="Email" value={user.email || 'Not provided'} />
                <InfoTile icon={LuPhone} label="Phone" value={user.phone || 'Not provided'} />
                <InfoTile icon={LuCalendarDays} label="Member since" value={formatDate(user.createdAt)} />
                <InfoTile icon={LuUser} label="Account" value={user.isActive ? 'Active' : 'Suspended'} />
              </div>
            </section>

            {(customer || operator) && (
              <section aria-labelledby="user-activity-heading" className="space-y-3">
                <h3 id="user-activity-heading" className="font-display text-base font-semibold text-text">Activity</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {customer && <CountTile label="Total bookings" value={user.bookingsCount || 0} />}
                  {customer && <CountTile label="Active bookings" value={user.activeBookingsCount || 0} tone="success" />}
                  {operator && <CountTile label="Future departures" value={user.futureDepartures || 0} tone="warning" />}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <section aria-labelledby="user-bookings-heading" className="space-y-3">
            <h3 id="user-bookings-heading" className="font-display text-base font-semibold text-text">Booking history</h3>
            {loading && <Skeleton className="h-24 w-full rounded-xl" />}
            {!loading && loadError && <p role="alert" className="text-sm text-danger">{loadError}</p>}
            {!loading && !loadError && bookings.length === 0 && <EmptyState title="No bookings yet" description="Bookings this customer makes appear here." />}
            {!loading && !loadError && bookings.length > 0 && (
              <AdminTable label="Booking history" minWidth={640}>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>Booking</th>
                    <th scope="col" className={thClass}>Package</th>
                    <th scope="col" className={thClass}>Travellers</th>
                    <th scope="col" className={thClass}>Start</th>
                    <th scope="col" className={thClass}>Amount</th>
                    <th scope="col" className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(booking => (
                    <tr key={booking._id}>
                      <td className={`${tdClass} font-semibold text-brand`}>{bookingLabel(booking)}</td>
                      <td className={tdClass}>{booking.packageId?.title || 'Package'}</td>
                      <td className={tdClass}>{booking.numTravelers}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{formatDate(booking.startDate)}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{money(booking.totalAmount)}</td>
                      <td className={tdClass}><Badge tone={BOOKING_TONE[booking.status] || 'neutral'}>{booking.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            )}
          </section>
        )}

        {activeTab === 'payments' && (
          <section aria-labelledby="user-payments-heading" className="space-y-3">
            <h3 id="user-payments-heading" className="font-display text-base font-semibold text-text">Payment history</h3>
            {loading && <Skeleton className="h-24 w-full rounded-xl" />}
            {!loading && loadError && <p role="alert" className="text-sm text-danger">{loadError}</p>}
            {!loading && !loadError && payments.length === 0 && <EmptyState title="No payments yet" description="Payments and receipts recorded on this customer's bookings appear here." />}
            {!loading && !loadError && payments.length > 0 && (
              <>
                <ul className="space-y-3">
                  {payments.map(payment => (
                    <li key={payment.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-success/10 text-success">
                          <LuCircleCheck aria-hidden="true" className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-text">{money(payment.amount)}</p>
                          <p className="text-sm text-text-muted">{formatDate(payment.date)} · {payment.method} · {payment.label}</p>
                        </div>
                      </div>
                      <Badge tone={payment.status === 'SUCCESS' ? 'success' : 'neutral'}>{payment.status}</Badge>
                    </li>
                  ))}
                </ul>
                <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                  <span className="text-sm font-semibold text-text-muted">Total paid (successful payments)</span>
                  <span className="font-display text-xl font-semibold text-success">{money(totalPaid)}</span>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'assignments' && (
          <section aria-labelledby="user-assignments-heading" className="space-y-3">
            <h3 id="user-assignments-heading" className="font-display text-base font-semibold text-text">Upcoming group departures</h3>
            {loading && <Skeleton className="h-24 w-full rounded-xl" />}
            {!loading && loadError && <p role="alert" className="text-sm text-danger">{loadError}</p>}
            {!loading && !loadError && departures.length === 0 && <EmptyState title="No departures assigned" description="Group departures this operator is assigned to appear here." />}
            {!loading && !loadError && departures.length > 0 && (
              <ul className="space-y-3">
                {departures.map(departure => (
                  <li key={departure._id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-text">{departure.packageId?.title || 'Package'}</p>
                      <p className="text-sm text-text-muted">{formatDate(departure.startDate)} – {formatDate(departure.endDate)} · Seats {departure.bookedSeats}/{departure.totalSeats}</p>
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

export default UserDetailModal;
