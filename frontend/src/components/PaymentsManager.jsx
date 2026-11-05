import React, { useEffect, useState } from 'react';
import { LuCheck, LuRefreshCw, LuX } from 'react-icons/lu';
import Button from './ui/Button.jsx';
import Modal from './ui/Modal.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import FormField, { inputClass } from './ui/FormField.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { AdminPageHeader, AdminPanel, AdminTable, thClass, tdClass } from './admin/AdminPrimitives.jsx';
import { bookingLabel } from '../utils/bookingCode.js';
import { notify } from '../utils/notifyStore.js';
import { notifyAdminDataChanged } from '../utils/adminEvents.js';

const money = (currency, amount) => `${currency || 'BDT'} ${Number(amount || 0).toLocaleString()}`;

// Admin queue of manual payment submissions. Each decision goes through an in-app dialog and reports its outcome.
export default function PaymentsManager() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(null); // { payment, approved }
  const [notes, setNotes] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/payments');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load submissions.');
      setPayments(data.payments || []);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDecision = (payment, approved) => {
    setNotes('');
    setDecisionError('');
    setDecision({ payment, approved });
  };

  const closeDecision = () => {
    if (deciding) return;
    setDecision(null);
  };

  const confirmDecision = async () => {
    if (!decision) return;
    const { payment, approved } = decision;
    setDeciding(true);
    setDecisionError('');
    try {
      const response = await fetch(`/api/admin/bookings/${payment.bookingId}/payments/${payment._id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, notes }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'The decision could not be saved. Nothing changed; please try again.');
      setPayments(current => current.filter(item => item._id !== payment._id));
      setDecision(null);
      notifyAdminDataChanged();
      notify.message(approved
        ? `Receipt approved. ${bookingLabel(payment)} is updated.`
        : `Receipt rejected. ${bookingLabel(payment)} was not changed.`);
    } catch (failure) {
      setDecisionError(failure.message);
      notify.error(failure.message);
    } finally {
      setDeciding(false);
    }
  };

  const approving = decision?.approved;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Check each transfer externally before approving. Pending submissions do not confirm bookings or count as receipts."
        actions={(
          <Button variant="secondary" icon={LuRefreshCw} onClick={load} loading={loading}>Refresh</Button>
        )}
      />

      <AdminPanel>
        <h2 className="font-display text-lg font-semibold text-text">Manual payment verification</h2>
        <p className="mt-1 text-sm text-text-muted">
          {payments.length} {payments.length === 1 ? 'submission' : 'submissions'} waiting for a decision.
        </p>

        <div className="mt-5">
          {loading && (
            <div className="space-y-3" aria-live="polite">
              <p className="sr-only">Loading submissions…</p>
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          )}

          {!loading && error && (
            <ErrorState title="The submissions could not be loaded" message={error} onRetry={load} />
          )}

          {!loading && !error && payments.length === 0 && (
            <EmptyState title="No pending payment submissions" description="New transfers submitted by customers appear here for checking." />
          )}

          {!loading && !error && payments.length > 0 && (
            <AdminTable label="Pending payment submissions" minWidth={900}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Booking</th>
                  <th scope="col" className={thClass}>Customer</th>
                  <th scope="col" className={thClass}>Method and reference</th>
                  <th scope="col" className={thClass}>Amount</th>
                  <th scope="col" className={thClass}>Submitted</th>
                  <th scope="col" className={thClass}><span className="sr-only">Decision</span></th>
                </tr>
              </thead>
              <tbody>
                {payments.map(payment => (
                  <tr key={payment._id}>
                    <td className={tdClass}>
                      <div className="font-semibold text-brand">{bookingLabel(payment)}</div>
                      <div className="text-xs text-text-muted">{payment.package?.title || 'Package'} · {payment.bookingStatus}</div>
                    </td>
                    <td className={tdClass}>
                      <div className="font-medium text-text">{payment.customer?.fullName || 'Unavailable customer'}</div>
                      <div className="text-xs text-text-muted">{payment.customer?.email || ''}</div>
                    </td>
                    <td className={tdClass}>
                      <div>{payment.method}</div>
                      <div className="font-mono text-xs text-text-muted">{payment.transactionRef}</div>
                    </td>
                    <td className={`${tdClass} font-semibold`}>{money(payment.currency, payment.amount)}</td>
                    <td className={tdClass}>{new Date(payment.submittedAt || payment.createdAt).toLocaleString()}</td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" icon={LuCheck} disabled={deciding} onClick={() => openDecision(payment, true)}>Approve receipt</Button>
                        <Button size="sm" variant="secondary" icon={LuX} disabled={deciding} onClick={() => openDecision(payment, false)}>Reject receipt</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </div>
      </AdminPanel>

      <Modal
        open={Boolean(decision)}
        onClose={closeDecision}
        title={approving ? 'Approve this receipt?' : 'Reject this submission?'}
        description={decision ? `${bookingLabel(decision.payment)} · ${money(decision.payment.currency, decision.payment.amount)}` : ''}
        size="md"
        rootClassName="dark"
        footer={(
          <>
            <Button variant="secondary" onClick={closeDecision} disabled={deciding}>Cancel</Button>
            <Button variant={approving ? 'primary' : 'danger'} onClick={confirmDecision} loading={deciding}>
              {approving ? 'Confirm approval' : 'Confirm rejection'}
            </Button>
          </>
        )}
      >
        {decision && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-muted p-4">
              <div><dt className="text-text-muted">Method</dt><dd className="font-semibold text-text">{decision.payment.method}</dd></div>
              <div><dt className="text-text-muted">Reference</dt><dd className="font-mono font-semibold text-text">{decision.payment.transactionRef}</dd></div>
              <div className="col-span-2"><dt className="text-text-muted">Customer</dt><dd className="font-semibold text-text">{decision.payment.customer?.fullName || 'Unavailable customer'}</dd></div>
            </dl>
            <p className="text-text-muted">
              {approving
                ? 'Confirm that the money was received in the external account before approving. This records a verified receipt.'
                : 'The submission is rejected and the booking is left unchanged.'}
            </p>
            <FormField id="payment-notes" label="Verification notes (optional)">
              <textarea
                id="payment-notes"
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={approving ? 'For example: bank statement checked' : 'For example: reference not found in the account'}
                className={`${inputClass} resize-none`}
              />
            </FormField>
            {decisionError && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-danger">{decisionError}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
