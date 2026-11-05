import { LuArrowRight, LuCalendar, LuCalendarDays, LuCheck, LuClock, LuInfo, LuMail, LuPackage, LuUser, LuUsers, LuWallet, LuX } from 'react-icons/lu';
import { CloseIcon } from './ui/icons.js';
import { userMessage } from '../utils/errorMessage.js';
import { confirmAction } from '../utils/confirmStore.js';
import { notify } from '../utils/notifyStore.js';
import { notifyAdminDataChanged } from '../utils/adminEvents.js';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { thClass, tdClass } from './admin/AdminPrimitives.jsx';
import { bookingLabel } from '../utils/bookingCode.js';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import { DetailFact, DetailSection, DetailText, formatBDT, formatDetailDate } from './admin/DetailPrimitives.jsx';

const REQUEST_TONE = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' };
const REQUEST_LABEL = { PENDING: 'Awaiting decision', APPROVED: 'Approved', REJECTED: 'Rejected' };


const DateChangeRequestsManager = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDateChangeRequests();
  }, []);

  const fetchDateChangeRequests = async () => {
    setLoading(true);
    try {
      // Fetch all bookings and filter for those with date change requests
      const res = await axios.get('/api/bookings');
      const allBookings = res.data.bookings || [];
      
      // Filter bookings that have date change requests
      const withRequests = allBookings.filter(b => b.dateChangeRequest);
      
      setRequests(withRequests);
    } catch (err) {
      console.error('Failed to fetch date change requests:', err);
    }
    setLoading(false);
  };

  const handleApprove = async (bookingId, requestedDate) => {
    if (!(await confirmAction({ message: 'Are you sure you want to approve this date change request?' }))) {
      return;
    }

    setProcessing(true);
    try {
      const adminId = localStorage.getItem('userId');
      const res = await axios.post(`/api/admin/bookings/${bookingId}/approve-date-change`, {
        adminId,
        newStartDate: requestedDate
      });

      if (res.data.success) {
        notify.message('Date change request approved successfully!');
        notifyAdminDataChanged();
        fetchDateChangeRequests(); // Refresh the list
        setShowDetailModal(false);
      }
    } catch (err) {
      console.error('Failed to approve request:', err);
      notify.error(userMessage(err, 'The request could not be approved. Please try again.'));
    }
    setProcessing(false);
  };

  const handleReject = async (bookingId) => {
    const reason = prompt('Please provide a reason for rejection (optional):');
    
    setProcessing(true);
    try {
      const adminId = localStorage.getItem('userId');
      const res = await axios.post(`/api/admin/bookings/${bookingId}/reject-date-change`, {
        adminId,
        reviewNotes: reason || 'Request rejected by admin'
      });

      if (res.data.success) {
        notify.message('Date change request rejected.');
        notifyAdminDataChanged();
        fetchDateChangeRequests(); // Refresh the list
        setShowDetailModal(false);
      }
    } catch (err) {
      console.error('Failed to reject request:', err);
      notify.error(userMessage(err, 'The request could not be rejected. Please try again.'));
    }
    setProcessing(false);
  };

  const filteredRequests = requests.filter(req => {
    if (statusFilter === 'all') return true;
    return req.dateChangeRequest?.status === statusFilter.toUpperCase();
  });

  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'bg-warning/10 text-warning',
      APPROVED: 'bg-success/10 text-success',
      REJECTED: 'bg-danger/10 text-danger'
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

  return (
    <div className="p-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-text">
          Date Change Requests
        </h2>
        <button
          onClick={fetchDateChangeRequests}
          className="px-4 py-2 bg-brand text-white rounded-lg hover:opacity-90"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
        >
          <option value="all">All Requests</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-warning/10 p-4 rounded-lg border border-warning/30">
          <div className="text-sm text-warning">Pending</div>
          <div className="text-2xl font-bold text-warning">
            {requests.filter(r => r.dateChangeRequest?.status === 'PENDING').length}
          </div>
        </div>
        <div className="bg-success/10 p-4 rounded-lg border border-success/30">
          <div className="text-sm text-success">Approved</div>
          <div className="text-2xl font-bold text-success">
            {requests.filter(r => r.dateChangeRequest?.status === 'APPROVED').length}
          </div>
        </div>
        <div className="bg-danger/10 p-4 rounded-lg border border-danger/30">
          <div className="text-sm text-danger">Rejected</div>
          <div className="text-2xl font-bold text-danger">
            {requests.filter(r => r.dateChangeRequest?.status === 'REJECTED').length}
          </div>
        </div>
      </div>

      {/* Requests Table */}
      {loading ? (
        <p>Loading requests...</p>
      ) : filteredRequests.length === 0 ? (
        <p className="text-text-muted">No date change requests found.</p>
      ) : (
        <div className="bg-surface rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-muted">
              <tr>
                <th className={thClass}>
                  Booking ID
                </th>
                <th className={thClass}>
                  Customer
                </th>
                <th className={thClass}>
                  Package
                </th>
                <th className={thClass}>
                  Current Date
                </th>
                <th className={thClass}>
                  Requested Date
                </th>
                <th className={thClass}>
                  Status
                </th>
                <th className={thClass}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-gray-200">
              {filteredRequests.map((booking) => (
                <tr key={booking._id} className="hover:bg-surface-muted">
                  <td className={tdClass}>
                    {bookingLabel(booking)}
                  </td>
                  <td className={tdClass}>
                    {booking.customerId?.fullName || booking.customerId?.name || 'N/A'}
                  </td>
                  <td className={tdClass}>
                    {booking.packageId?.title || 'N/A'}
                  </td>
                  <td className={tdClass}>
                    {formatDate(booking.startDate)}
                  </td>
                  <td className={tdClass}>
                    {formatDate(booking.dateChangeRequest.requestedDate)}
                  </td>
                  <td className={tdClass}>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.dateChangeRequest.status)}`}>
                      {booking.dateChangeRequest.status}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <button
                      onClick={() => {
                        setSelectedRequest(booking);
                        setShowDetailModal(true);
                      }}
                      className="text-info hover:text-info mr-3"
                    >
                      <LuInfo aria-hidden="true" className="inline mr-1" />
                      View
                    </button>
                    {booking.dateChangeRequest.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(booking._id, booking.dateChangeRequest.requestedDate)}
                          disabled={processing}
                          className="text-success hover:text-success mr-3 disabled:opacity-50"
                        >
                          <LuCheck aria-hidden="true" className="inline mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(booking._id)}
                          disabled={processing}
                          className="text-danger hover:text-danger disabled:opacity-50"
                        >
                          <LuX aria-hidden="true" className="inline mr-1" />
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Date change request details */}
      <Modal
        open={showDetailModal && Boolean(selectedRequest)}
        onClose={() => setShowDetailModal(false)}
        title="Date change request"
        description={selectedRequest ? `${bookingLabel(selectedRequest)} · ${selectedRequest.customerId?.fullName || selectedRequest.customerId?.name || 'Customer'}` : ''}
        size="xl"
        rootClassName="dark"
        footer={selectedRequest && (
          <>
            <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Close</Button>
            {selectedRequest.dateChangeRequest.status === 'PENDING' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  icon={LuX}
                  onClick={() => handleReject(selectedRequest._id)}
                  disabled={processing}
                >
                  Reject request
                </Button>
                <Button
                  icon={LuCheck}
                  onClick={() => handleApprove(selectedRequest._id, selectedRequest.dateChangeRequest.requestedDate)}
                  loading={processing}
                  disabled={processing}
                >
                  Approve request
                </Button>
              </div>
            )}
          </>
        )}
      >
        {selectedRequest && (() => {
          const request = selectedRequest.dateChangeRequest;
          const currentStart = selectedRequest.startDate;
          const requestedStart = request.requestedDate;
          const shiftDays = Math.round((new Date(requestedStart) - new Date(currentStart)) / 86400000);
          const shiftText = shiftDays === 0 ? 'No change in date' : `${shiftDays > 0 ? '+' : ''}${shiftDays} day${Math.abs(shiftDays) === 1 ? '' : 's'}`;
          return (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge tone={REQUEST_TONE[request.status] || 'neutral'}>{REQUEST_LABEL[request.status] || request.status}</Badge>
                <span className="text-xs text-text-muted">Requested {formatDetailDate(request.requestedAt)}</span>
              </div>

              {/* Current and requested start */}
              <div className="glass grid items-center gap-4 rounded-2xl p-5 sm:grid-cols-[1fr_auto_1fr]">
                <div>
                  <p className="text-xs text-text-muted">Current start</p>
                  <p className="mt-1 font-display text-xl font-semibold text-text">{formatDetailDate(currentStart, false)}</p>
                </div>
                <div className="flex flex-col items-center gap-1 text-text-muted">
                  <LuArrowRight aria-hidden="true" className="h-5 w-5" />
                  <span className={`text-xs font-semibold ${shiftDays > 0 ? 'text-warning' : shiftDays < 0 ? 'text-info' : 'text-text-muted'}`}>{shiftText}</span>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-text-muted">Requested start</p>
                  <p className="mt-1 font-display text-xl font-semibold text-brand">{formatDetailDate(requestedStart, false)}</p>
                </div>
              </div>

              <DetailSection id="date-change-facts-heading" title="Booking">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <DetailFact icon={LuUser} label="Customer" value={selectedRequest.customerId?.fullName || selectedRequest.customerId?.name || 'Not on file'} />
                  <DetailFact icon={LuMail} label="Email" value={selectedRequest.customerId?.email || 'Not on file'} />
                  <DetailFact icon={LuPackage} label="Package" value={selectedRequest.packageId?.title || 'Not on file'} />
                  <DetailFact icon={LuCalendarDays} label="Booking type" value={selectedRequest.bookingType === 'GROUP' ? 'Group departure' : 'Personal booking'} />
                  <DetailFact icon={LuUsers} label="Travellers" value={selectedRequest.numTravelers ?? '—'} />
                  <DetailFact icon={LuWallet} label="Booking total" value={formatBDT(selectedRequest.totalAmount)} />
                </dl>
              </DetailSection>

              <DetailSection id="date-change-reason-heading" title="Reason for the change">
                <DetailText>{request.reason || 'No reason was given.'}</DetailText>
              </DetailSection>

              {request.reviewedAt && (
                <DetailSection id="date-change-review-heading" title="Decision">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <DetailFact icon={LuCheck} label="Reviewed" value={formatDetailDate(request.reviewedAt)} />
                  </dl>
                  {request.reviewNotes && <DetailText>{request.reviewNotes.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, (iso) => formatDetailDate(iso, true))}</DetailText>}
                </DetailSection>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default DateChangeRequestsManager;
