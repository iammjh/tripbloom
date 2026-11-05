import React, { useState } from 'react';
import { LuMail, LuPhone, LuSave, LuTriangleAlert, LuUsers } from 'react-icons/lu';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import FormField, { inputClass } from '../components/ui/FormField.jsx';
import Modal from '../components/ui/Modal.jsx';
import { saveOperatorNotes } from '../api/bookingOperations.js';
import { bookingLabel } from '../utils/bookingCode.js';
import { paymentTotals } from '../utils/paymentAccounting.js';
import { notify } from '../utils/notifyStore.js';

const STATUS_TONE = { PENDING: 'warning', CONFIRMED: 'success', COMPLETED: 'info', CANCELLED: 'danger', REFUNDED: 'neutral' };
const PAYMENT_TONE = { SUCCESS: 'success', PENDING: 'warning', FAILED: 'danger', REJECTED: 'danger' };
const NOTES_LIMIT = 5000;

const money = value => `৳${Number(value || 0).toLocaleString('en-US')}`;
const dateOnly = value => (value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <div className="mt-1 text-sm text-text">{children}</div>
    </div>
  );
}

function Stat({ label, value, tone = 'text-text' }) {
  return (
    <div className="rounded-xl bg-surface-muted/60 p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`font-display text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

// Booking details for an operator. Prices and payment status are read-only here; the operator can write notes.
const BookingDetailModal = ({ booking, onClose, onUpdateNotes }) => {
  const [notes, setNotes] = useState(booking.operatorNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totals = paymentTotals(booking);
  const cancelledAfterStart = Boolean(booking.cancellation?.isCancelled)
    && new Date(booking.cancellation.cancelledAt) > new Date(booking.startDate);
  const customer = booking.customerId && typeof booking.customerId === 'object' ? booking.customerId : {};
  const customerName = customer.fullName || booking.customerName || 'Customer';
  const customerEmail = customer.email || booking.customerEmail || '';
  const customerPhone = customer.phone || booking.customerPhone || '';
  const travelers = booking.travelers || [];
  const payments = booking.payments || [];
  const unchanged = notes === (booking.operatorNotes || '');

  const saveNotes = async () => {
    if (saving || cancelledAfterStart || unchanged) return;
    setSaving(true);
    setError('');
    try {
      const saved = await saveOperatorNotes(booking._id, notes);
      const value = saved.operatorNotes ?? notes;
      setNotes(value);
      onUpdateNotes(value);
      notify.message('Notes saved.');
    } catch (failure) {
      setError(failure.message || 'Could not save notes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const footer = <Button variant="ghost" onClick={onClose}>Close</Button>;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Booking ${bookingLabel(booking)}`}
      description={booking.packageId?.title || 'Booking details'}
      size="lg"
      footer={footer}
      rootClassName="dark"
    >
      <div className="space-y-5">
        {cancelledAfterStart && (
          <div role="status" className="flex gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            <LuTriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none" />
            <p>This booking was cancelled after the tour started. Its notes can no longer be changed.</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="customer-heading" className="glass space-y-3 rounded-2xl p-4">
            <h3 id="customer-heading" className="font-display text-base font-semibold text-text">Customer</h3>
            <Field label="Name">{customerName}</Field>
            <Field label="Phone">
              {customerPhone
                ? <a href={`tel:${customerPhone}`} className="inline-flex items-center gap-1.5 text-brand hover:underline"><LuPhone aria-hidden="true" className="h-3.5 w-3.5" />{customerPhone}</a>
                : '—'}
            </Field>
            <Field label="Email">
              {customerEmail
                ? <a href={`mailto:${customerEmail}`} className="inline-flex items-center gap-1.5 break-all text-brand hover:underline"><LuMail aria-hidden="true" className="h-3.5 w-3.5 flex-none" />{customerEmail}</a>
                : '—'}
            </Field>
          </section>

          <section aria-labelledby="trip-heading" className="glass space-y-3 rounded-2xl p-4">
            <h3 id="trip-heading" className="font-display text-base font-semibold text-text">Trip</h3>
            <Field label="Package">
              {booking.packageId?.title || 'Tour'}
              {booking.packageId?.destination && <span className="block text-text-muted">{booking.packageId.destination}</span>}
            </Field>
            <Field label="Dates">{dateOnly(booking.startDate)} – {dateOnly(booking.endDate)}</Field>
            <Field label="Booking type">{booking.bookingType === 'GROUP' ? 'Group' : 'Private'}</Field>
            <Field label="Status"><Badge tone={STATUS_TONE[booking.status] || 'neutral'}>{booking.status || 'Unknown'}</Badge></Field>
          </section>
        </div>

        <section aria-labelledby="travelers-heading" className="glass rounded-2xl p-4">
          <h3 id="travelers-heading" className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-text">
            <LuUsers aria-hidden="true" className="h-4 w-4 text-brand" />Travellers ({booking.numTravelers ?? travelers.length})
          </h3>
          {travelers.length === 0 ? (
            <p className="text-sm text-text-muted">No travellers are listed on this booking.</p>
          ) : (
            <ul className="divide-y divide-border">
              {travelers.map((traveler, index) => (
                <li key={index} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-semibold text-text">{traveler.fullName || 'Traveller'}</span>
                  <span className="text-text-muted">{[traveler.age ? `Age ${traveler.age}` : '', traveler.phone || ''].filter(Boolean).join(' · ') || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="payments-heading" className="glass space-y-4 rounded-2xl p-4">
          <div>
            <h3 id="payments-heading" className="font-display text-base font-semibold text-text">Payments</h3>
            <p className="text-xs text-text-muted">Read-only. An administrator changes prices and payment status.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total" value={money(booking.finalAmount ?? booking.totalAmount)} />
            <Stat label="Paid" value={money(totals.gross)} tone="text-success" />
            <Stat label="Pending" value={money(totals.pending)} />
            <Stat label="Remaining" value={money(totals.remaining)} tone={totals.remaining > 0 ? 'text-warning' : 'text-text'} />
          </div>
          {payments.length > 0 && (
            <ul className="divide-y divide-border">
              {payments.map((payment, index) => (
                <li key={payment._id || index} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-text"><span className="font-semibold">{money(payment.amount)}</span> <span className="text-text-muted">via {payment.method || 'unknown'}</span></span>
                  <span className="flex items-center gap-2 text-xs text-text-muted">
                    {payment.paidAt && dateOnly(payment.paidAt)}
                    <Badge tone={PAYMENT_TONE[payment.status] || 'neutral'}>{payment.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {booking.customizations && (
          <section aria-labelledby="preferences-heading" className="glass rounded-2xl p-4">
            <h3 id="preferences-heading" className="font-display text-base font-semibold text-text">Customer preferences</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-text">{booking.customizations}</p>
          </section>
        )}

        <section aria-labelledby="notes-heading" className="glass space-y-3 rounded-2xl p-4">
          <h3 id="notes-heading" className="font-display text-base font-semibold text-text">Operator notes</h3>
          <FormField id="operator-notes" label="Notes for this booking" hint="Special requests, dietary needs and anything the guide should know." error={error || undefined}>
            <textarea
              id="operator-notes"
              rows={4}
              maxLength={NOTES_LIMIT}
              value={notes}
              onChange={event => setNotes(event.target.value)}
              disabled={cancelledAfterStart || saving}
              className={inputClass}
            />
          </FormField>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-text-muted">{notes.length} / {NOTES_LIMIT}</span>
            <Button icon={LuSave} onClick={saveNotes} loading={saving} disabled={cancelledAfterStart || unchanged}>Save notes</Button>
          </div>
        </section>
      </div>
    </Modal>
  );
};

export default BookingDetailModal;
