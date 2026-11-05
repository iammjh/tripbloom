import { LuCalendarDays, LuCalendarX, LuCheck, LuCircleUser, LuDollarSign, LuEye, LuFilter, LuInfo, LuMail, LuPackage, LuSearch, LuShield, LuTriangleAlert, LuUser, LuUsers, LuX } from 'react-icons/lu';
import { userMessage } from '../utils/errorMessage.js';
import { notify } from '../utils/notifyStore.js';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AdminTable, thClass, tdClass } from './admin/AdminPrimitives.jsx';
import { bookingLabel } from '../utils/bookingCode.js';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import { DetailAmount, DetailFact, DetailSection, DetailText, formatBDT, formatDetailDate } from './admin/DetailPrimitives.jsx';
import { isRefundRecorded, refundStatusOf } from '../utils/refundState.js';
import FormField, { fieldAria, inputClass } from './ui/FormField.jsx';
import { notifyAdminDataChanged } from '../utils/adminEvents.js';


// Refund statuses in plain words. Only the first two still need money to be sent.
const STATUS_LABEL = { PENDING_REFUND: 'Refund due', PARTIAL_REFUND: 'Partly refunded', REFUNDED: 'Refunded', NO_REFUND: 'No refund due' };
const OPEN_STATUSES = ['PENDING_REFUND', 'PARTIAL_REFUND'];

const CancellationsRefundQueue = () => {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'refunded'
  const [initiatorFilter, setInitiatorFilter] = useState('all'); // 'all', 'customer', 'admin'
  const [reasonFilter, setReasonFilter] = useState('all'); // 'all', 'departure_cancelled', 'customer_request'
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  // Recording a refund happens in an in-app dialog: the admin sees the amount due and any refusal reason.
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundRef, setRefundRef] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [refundError, setRefundError] = useState('');
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    fetchRefunds();
  }, []);

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      // Fetch all bookings and filter for cancelled ones
      const bookingsRes = await axios.get('/api/bookings');
      const allBookings = bookingsRes.data.bookings || [];

      // Filter cancelled bookings where customer actually paid money
      // Include both pending and already processed refunds for tracking
      const cancelledBookings = allBookings.filter(booking => {
        const hasCancellation = booking.status === 'CANCELLED' || booking.status === 'REFUNDED' || booking.cancellation?.isCancelled;
        if (!hasCancellation) return false;
        
        // Calculate total paid amount
        const totalPaid = (booking.payments || [])
          .filter(p => p.status === 'SUCCESS' && p.method !== 'REFUND')
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        // Only show if customer actually paid money
        return totalPaid > 0;
      });

      // Build package -> bookings map (all bookings) to compute sequence numbers (for display IDs)
      const byPackage = {};
      allBookings.forEach(b => {
        const pkgId = b.packageId?._id || b.packageId;
        if (!pkgId) return;
        const key = pkgId.toString();
        byPackage[key] = byPackage[key] || [];
        byPackage[key].push(b);
      });

      // Sort each package list by createdAt ascending so sequence is deterministic
      Object.keys(byPackage).forEach(k => {
        byPackage[k].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });

      // Fetch additional data for each cancelled booking
      const refundsWithData = await Promise.all(
        cancelledBookings.map(async (booking) => {
          try {
            // Calculate total paid
            const totalPaid = (booking.payments || [])
              .filter(p => p.status === 'SUCCESS' && p.method !== 'REFUND')
              .reduce((sum, p) => sum + (p.amount || 0), 0);
            
            const refundAmount = booking.cancellation?.refundAmount || 0;
            const isRefundProcessed = isRefundRecorded(booking);
            
            // Calculate refunded so far from refund payments
            const refundedSoFar = isRefundProcessed ? refundAmount : 0;
            
            // Determine refund status
            const refundStatus = refundStatusOf(booking);

            // Determine initiator (customer vs admin)
            const initiator = booking.cancellation?.cancelledBy 
              ? (booking.customerId === booking.cancellation.cancelledBy ? 'customer' : 'admin')
              : 'customer';

            // Determine cancellation reason
            let reason = booking.cancellation?.reason || 'Customer requested cancellation';
            let isDepartureCancelled = false;
            
            // Check if booking has group departure
            if (booking.groupDepartureId) {
              try {
                const depRes = await axios.get(`/api/admin/group-departures`);
                const departure = (depRes.data.departures || []).find(d => d._id === booking.groupDepartureId);
                if (departure?.status === 'CANCELLED') {
                  isDepartureCancelled = true;
                  reason = 'Departure cancelled by operator';
                }
              } catch (err) {
                // Departure fetch failed
              }
            }

            // compute display id per package (like operator dashboard)
            const pkg = booking.packageId || {};
            const pkgId = pkg._id || pkg;
            const list = pkgId ? byPackage[pkgId.toString()] || [] : [];
            const index = list.findIndex(x => (x._id || x).toString() === (booking._id || booking).toString());
            const seq = index >= 0 ? index + 1 : 1;

            const pkgCode = pkg.packageCode || pkg.code || pkg.shortCode || pkg.packageIdCode;
            let prefix;
            if (pkgCode) {
              prefix = pkgCode.toString().toUpperCase();
            } else if (pkg.title) {
              const words = pkg.title.split(/\s+/).filter(Boolean);
              const a = (words[0] || '').charAt(0) || 'X';
              const b = (words[1] || words[0] || '').charAt(0) || 'X';
              prefix = (a + b).toUpperCase() + '000';
            } else {
              prefix = 'TB000';
            }

            const displayId = `${prefix}${seq}`;

            return {
              ...booking,
              _displayId: displayId,
              totalPaid,
              totalAmount: booking.totalAmount || booking.finalAmount || totalPaid,
              refundAmount,
              refundedSoFar,
              isPartialRefund: false,
              refundStatus,
              initiator,
              isDepartureCancelled,
              cancellationReason: reason,
              requestedDate: booking.cancellation?.cancelledAt || booking.updatedAt,
              customer: booking.customerId // Will be populated if API returns it
            };
          } catch (err) {
            return null;
          }
        })
      );

      // Filter out null entries and sort by requested date (newest first)
      const validRefunds = refundsWithData
        .filter(r => r !== null)
        .sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate));

      setRefunds(validRefunds);
    } catch (err) {
      console.error('Failed to fetch refunds:', err);
      setError('Unable to load refund records. Please retry.');
    }
    setLoading(false);
  };

  // Money still to send back on a booking: refund due less what has already been refunded.
  const refundDue = (row) => Math.max(0, (row.refundAmount || 0) - (row.refundedSoFar || 0));

  const openRefund = (row) => {
    setRefundTarget(row);
    setRefundRef('');
    setRefundNotes('');
    setRefundError('');
  };

  const submitRefund = async () => {
    if (!refundTarget) return;
    const reference = refundRef.trim();
    if (!reference) {
      setRefundError('Enter the reference of the transfer you made to the customer.');
      return;
    }
    setRefunding(true);
    setRefundError('');
    try {
      const res = await axios.post(`/api/admin/bookings/${refundTarget._id}/refund`, {
        transactionRef: reference,
        notes: refundNotes.trim(),
      });
      if (res.data?.success) {
        setRefundTarget(null);
        fetchRefunds();
        notifyAdminDataChanged();
        notify.message(`Refund of BDT ${Number(res.data.refundAmount || 0).toLocaleString()} recorded.`);
      }
    } catch (err) {
      console.error('Failed to record refund:', err);
      setRefundError(userMessage(err, 'The refund could not be recorded. Nothing changed; please try again.'));
    } finally {
      setRefunding(false);
    }
  };

  const filteredRefunds = refunds.filter(refund => {
    const matchesSearch = 
      refund._id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refund.customerId?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refund.packageId?.title?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'pending' && ['PENDING_REFUND', 'PARTIAL_REFUND'].includes(refund.refundStatus)) ||
      (statusFilter === 'refunded' && refund.refundStatus === 'REFUNDED') ||
      (statusFilter === 'none' && refund.refundStatus === 'NO_REFUND');

    const matchesInitiator = initiatorFilter === 'all' || refund.initiator === initiatorFilter;

    const matchesReason = reasonFilter === 'all' ||
      (reasonFilter === 'departure_cancelled' && refund.isDepartureCancelled) ||
      (reasonFilter === 'customer_request' && !refund.isDepartureCancelled);

    return matchesSearch && matchesStatus && matchesInitiator && matchesReason;
  });

  const getStatusColor = (status) => {
    const colors = {
      PENDING_REFUND: 'bg-warning/10 text-warning',
      PARTIAL_REFUND: 'bg-warning/10 text-warning',
      REFUNDED: 'bg-success/10 text-success',
      NO_REFUND: 'bg-surface-muted text-text-muted'
    };
    return colors[status] || 'bg-surface-muted text-text';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const totalPendingAmount = filteredRefunds
    .filter(r => r.refundStatus !== 'REFUNDED')
    .reduce((sum, r) => sum + ((r.refundAmount || 0) - (r.refundedSoFar || 0)), 0);

  const totalRefundedAmount = filteredRefunds
    .reduce((sum, r) => sum + (r.refundedSoFar || 0), 0);

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-danger">{error}</p>}
      <div className="max-w-7xl mx-auto">
        <div className="bg-surface rounded-2xl shadow-lg p-6 border border-border">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl font-bold text-text flex items-center">
              <LuDollarSign aria-hidden="true" className="mr-3 text-danger" />
              Cancellations & Refund Queue
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-text-muted">Pending Refunds</div>
                <div className="text-lg font-bold text-warning">
                  BDT {totalPendingAmount.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-text-muted">Total Refunded</div>
                <div className="text-lg font-bold text-success">
                  BDT {totalRefundedAmount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <LuSearch aria-hidden="true" className="absolute left-3 top-3 text-text-muted" />
              <input
                type="text"
                placeholder="Search by ID, customer, package..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-surface text-text focus:ring-2 focus:ring-brand"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending/Partial</option>
              <option value="refunded">Refunded</option>
              <option value="none">No refund due</option>
            </select>
            <select
              value={initiatorFilter}
              onChange={(e) => setInitiatorFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
            >
              <option value="all">All Initiators</option>
              <option value="customer">Customer Requested</option>
              <option value="admin">Admin Initiated</option>
            </select>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
            >
              <option value="all">All Reasons</option>
              <option value="departure_cancelled">Departure Cancelled</option>
              <option value="customer_request">Customer Request</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className={thClass}>Booking ID</th>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>Package</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Requested Refund</th>
                  <th className={thClass}>Refunded</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Initiator</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRefunds.map((refund) => (
                  <tr
                    key={refund._id}
                    className={`border-b border-border hover:bg-surface-muted transition-colors ${
                      refund.isDepartureCancelled ? 'bg-danger/10' : ''
                    }`}
                  >
                    <td className={tdClass}>
                      <div className="font-mono text-sm font-semibold text-text">
                        {bookingLabel(refund)}
                      </div>
                      <div className="text-xs text-text-muted">
                        {formatDate(refund.requestedDate)}
                      </div>
                    </td>
                    <td className={tdClass}>
                      <div className="font-medium text-text">
                        {refund.customerId?.fullName || 'N/A'}
                      </div>
                      <div className="text-xs text-text-muted">
                        {refund.customerId?.email || ''}
                      </div>
                    </td>
                    <td className={tdClass}>
                      <div className="text-sm text-text">
                        {refund.packageId?.title || 'Package'}
                      </div>
                      {refund.isDepartureCancelled && (
                        <div className="flex items-center text-xs text-danger mt-1">
                          <LuCalendarX aria-hidden="true" className="mr-1" />
                          Departure cancelled
                        </div>
                      )}
                    </td>
                    <td className={tdClass}>
                      <div className="font-semibold text-text">
                        BDT {(refund.totalAmount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className={tdClass}>
                      <div className="font-semibold text-warning">
                        BDT {(refund.refundAmount || 0).toLocaleString()}
                      </div>
                      {refund.totalAmount > 0 && refund.refundAmount > 0 && (
                        <div className="text-xs text-text-muted">
                          {((refund.refundAmount / refund.totalAmount) * 100).toFixed(0)}% of total
                        </div>
                      )}
                    </td>
                    <td className={tdClass}>
                      <div className="font-semibold text-success">
                        BDT {(refund.refundedSoFar || 0).toLocaleString()}
                      </div>
                      {refund.isPartialRefund && (
                        <div className="text-xs text-warning">
                          BDT {((refund.refundAmount || 0) - (refund.refundedSoFar || 0)).toLocaleString()} pending
                        </div>
                      )}
                    </td>
                    <td className={tdClass}>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(refund.refundStatus)}`}>
                        {STATUS_LABEL[refund.refundStatus] || refund.refundStatus}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center justify-center">
                        {refund.initiator === 'customer' ? (
                          <span className="inline-flex items-center px-2 py-1 bg-info/10 text-info rounded-full text-xs font-semibold">
                            <LuCircleUser aria-hidden="true" className="mr-1" />
                            Customer
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 bg-info/10 text-info rounded-full text-xs font-semibold">
                            <LuShield aria-hidden="true" className="mr-1" />
                            Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedRefund(refund);
                            setShowDetailsModal(true);
                          }}
                          className="p-2 text-info hover:bg-info/10 rounded transition-colors"
                          title="View Details"
                        >
                          <LuEye aria-hidden="true" />
                        </button>
                        {OPEN_STATUSES.includes(refund.refundStatus) && (
                          <button
                            onClick={() => openRefund(refund)}
                            className="p-2 text-success hover:bg-success/10 rounded transition-colors"
                            title="Record completed refund"
                          >
                            <LuCheck aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRefunds.length === 0 && !loading && (
              <div className="text-center py-12 text-text-muted">
                {searchTerm || statusFilter !== 'all' || initiatorFilter !== 'all' || reasonFilter !== 'all'
                  ? 'No refunds match your filters'
                  : 'No refund requests found'}
              </div>
            )}
          </div>

          {loading && (
            <div className="text-center py-8 text-brand font-semibold">Loading...</div>
          )}

          {/* Stats Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-info/10 to-info/5 rounded-lg">
              <div className="text-sm text-info font-semibold">Total Requests</div>
              <div className="text-2xl font-bold text-info">{refunds.length}</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-warning/10 to-warning/5 rounded-lg">
              <div className="text-sm text-warning font-semibold">Pending</div>
              <div className="text-2xl font-bold text-warning">
                {refunds.filter(r => r.refundStatus === 'PENDING_REFUND').length}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-warning/10 to-warning/5 rounded-lg">
              <div className="text-sm text-warning font-semibold">Partial</div>
              <div className="text-2xl font-bold text-warning">
                {refunds.filter(r => r.refundStatus === 'PARTIAL_REFUND').length}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-success/10 to-success/5 rounded-lg">
              <div className="text-sm text-success font-semibold">Completed</div>
              <div className="text-2xl font-bold text-success">
                {refunds.filter(r => r.refundStatus === 'REFUNDED').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Refund details */}
      <Modal
        open={showDetailsModal && Boolean(selectedRefund)}
        onClose={() => setShowDetailsModal(false)}
        title="Refund details"
        description={selectedRefund ? `${bookingLabel(selectedRefund)} · ${selectedRefund.customerId?.fullName || 'Customer'}` : ''}
        size="xl"
        rootClassName="dark"
        footer={selectedRefund && (
          <>
            <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>Close</Button>
            {OPEN_STATUSES.includes(selectedRefund.refundStatus) && (
              <Button
                icon={LuCheck}
                onClick={() => {
                  setShowDetailsModal(false);
                  openRefund(selectedRefund);
                }}
              >
                Record completed refund
              </Button>
            )}
          </>
        )}
      >
        {selectedRefund && (() => {
          const remaining = Math.max(0, (selectedRefund.refundAmount || 0) - (selectedRefund.refundedSoFar || 0));
          const refunded = selectedRefund.refundStatus === 'REFUNDED';
          const noRefund = selectedRefund.refundStatus === 'NO_REFUND';
          const ledger = [...(selectedRefund.payments || [])].sort((a, b) => new Date(a.paidAt || a.submittedAt || a.createdAt || 0) - new Date(b.paidAt || b.submittedAt || b.createdAt || 0));
          return (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge tone={refunded ? 'success' : noRefund ? 'neutral' : 'warning'}>{refunded ? 'Refunded' : noRefund ? 'No refund due' : 'Refund pending'}</Badge>
                <span className="text-xs text-text-muted">Cancelled {formatDetailDate(selectedRefund.cancellation?.cancelledAt || selectedRefund.updatedAt)}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailAmount label="Paid by customer" value={formatBDT(selectedRefund.totalPaid)} />
                <DetailAmount label="Refund due" value={formatBDT(selectedRefund.refundAmount)} tone="warning" />
                <DetailAmount label="Refunded so far" value={formatBDT(selectedRefund.refundedSoFar)} tone="success" />
                <DetailAmount label="Remaining" value={formatBDT(remaining)} tone={remaining > 0 ? 'danger' : 'success'} />
              </div>

              <DetailSection id="refund-facts-heading" title="Booking and cancellation">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <DetailFact icon={LuUser} label="Customer" value={selectedRefund.customerId?.fullName || 'Not on file'} />
                  <DetailFact icon={LuMail} label="Email" value={selectedRefund.customerId?.email || 'Not on file'} />
                  <DetailFact icon={LuPackage} label="Package" value={selectedRefund.packageId?.title || 'Not on file'} />
                  <DetailFact icon={LuUsers} label="Travellers" value={selectedRefund.numTravelers ?? '—'} />
                  <DetailFact icon={LuUser} label="Cancelled by" value={selectedRefund.initiator === 'admin' ? 'Administrator' : 'Customer'} />
                  <DetailFact icon={LuCalendarDays} label="Cancelled on" value={formatDetailDate(selectedRefund.cancellation?.cancelledAt || selectedRefund.updatedAt)} />
                </dl>
              </DetailSection>

              <DetailSection id="refund-reason-heading" title="Cancellation reason">
                <DetailText>{selectedRefund.cancellationReason || 'No reason recorded.'}</DetailText>
                {selectedRefund.isDepartureCancelled && (
                  <p className="flex items-center gap-2 text-sm text-warning"><LuTriangleAlert aria-hidden="true" className="h-4 w-4" />The group departure was cancelled, so this refund is owed in full.</p>
                )}
              </DetailSection>

              {selectedRefund.refundStatus === 'NO_REFUND' && (
                <p role="status" className="rounded-xl border border-border bg-surface-muted p-4 text-sm text-text">
                  Nothing is owed on this booking. The cancellation policy gives no refund for this cancellation, so there is nothing to record or send.
                </p>
              )}

              <DetailSection id="refund-ledger-heading" title="Payments and refunds">
                {ledger.length === 0 ? (
                  <p className="text-sm text-text-muted">No payments are recorded on this booking.</p>
                ) : (
                  <AdminTable label="Payments and refunds on this booking" minWidth={620}>
                    <thead>
                      <tr>
                        <th scope="col" className={thClass}>Date</th>
                        <th scope="col" className={thClass}>Method</th>
                        <th scope="col" className={thClass}>Reference</th>
                        <th scope="col" className={thClass}>Amount</th>
                        <th scope="col" className={thClass}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((payment, index) => (
                        <tr key={payment._id || index}>
                          <td className={`${tdClass} whitespace-nowrap text-text-muted`}>{formatDetailDate(payment.paidAt || payment.submittedAt || payment.createdAt, false)}</td>
                          <td className={tdClass}>{payment.method === 'REFUND' ? 'Refund' : payment.method}</td>
                          <td className={`${tdClass} font-mono text-xs`}>{payment.transactionRef || '—'}</td>
                          <td className={`${tdClass} whitespace-nowrap font-semibold`}>{formatBDT(payment.amount)}</td>
                          <td className={tdClass}><Badge tone={payment.status === 'SUCCESS' ? 'success' : payment.status === 'FAILED' ? 'danger' : 'warning'}>{payment.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminTable>
                )}
              </DetailSection>
            </div>
          );
        })()}
      </Modal>

      {/* Record completed refund */}
      <Modal
        open={Boolean(refundTarget)}
        onClose={() => { if (!refunding) setRefundTarget(null); }}
        title="Record completed refund"
        description={refundTarget ? `${bookingLabel(refundTarget)} · ${refundTarget.customerId?.fullName || 'Customer'}` : ''}
        size="md"
        rootClassName="dark"
        footer={refundTarget && (
          <>
            <Button variant="secondary" onClick={() => setRefundTarget(null)} disabled={refunding}>Cancel</Button>
            <Button onClick={submitRefund} loading={refunding} disabled={refunding || refundDue(refundTarget) <= 0}>Record refund</Button>
          </>
        )}
      >
        {refundTarget && (
          <div className="space-y-4">
            <DetailAmount
              label="Refund to send to the customer"
              value={formatBDT(refundDue(refundTarget))}
              tone={refundDue(refundTarget) > 0 ? 'warning' : 'success'}
              hint="Send this amount outside the platform, then record the transfer reference here."
            />
            {refundDue(refundTarget) <= 0 && (
              <p role="status" className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-text">No refund is outstanding on this booking.</p>
            )}
            {refundError && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{refundError}</p>}
            <FormField id="refund-transaction-ref" label="Transfer reference" required hint="The reference of the transfer you made, for example a bKash or bank transaction ID.">
              <input
                {...fieldAria('refund-transaction-ref', { hint: true })}
                type="text"
                maxLength={120}
                value={refundRef}
                onChange={(e) => setRefundRef(e.target.value)}
                placeholder="Transaction ID"
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
            <FormField id="refund-notes" label="Notes (optional)">
              <textarea
                id="refund-notes"
                rows={3}
                maxLength={1000}
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                placeholder="For example: sent to the customer's bKash account"
                className={`${inputClass} resize-none`}
              />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CancellationsRefundQueue;
