import { LuCalendar, LuCircleCheck, LuCircleX, LuClock, LuEye, LuFileText, LuFilter, LuIdCard, LuMail, LuLoader, LuSearch, LuUser } from 'react-icons/lu';
import { confirmAction } from '../utils/confirmStore.js';
import { notify } from '../utils/notifyStore.js';
import { notifyAdminDataChanged } from '../utils/adminEvents.js';
import PrivateKycDocument from './PrivateKycDocument';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { thClass, tdClass } from './admin/AdminPrimitives.jsx';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import FormField, { fieldAria, inputClass } from './ui/FormField.jsx';
import { DetailFact } from './admin/DetailPrimitives.jsx';


const KYC_TONE = { pending: 'warning', approved: 'success', rejected: 'danger' };
const KYC_LABEL = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' };
const customerName = (kyc) => kyc.userFullName || kyc.user?.fullName || kyc.user?.name || 'Unknown customer';
const formatLongDate = (value) => new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const AdminKYCManager = () => {
  const [kycRequests, setKycRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKYC, setSelectedKYC] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [pendingActionKYC, setPendingActionKYC] = useState(null);

  useEffect(() => {
    fetchKYCRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [kycRequests, statusFilter, searchQuery]);



  const fetchKYCRequests = async () => {
    setLoading(true);
    try {
      const role = localStorage.getItem('userRole') || '';
      const response = await axios.get('/api/admin/kyc', {
        headers: { 
          'x-user-role': role
        }
      });
      
      if (response.data.success) {
        setKycRequests(response.data.kycs || []);
      }
    } catch (error) {
      console.error('Failed to fetch KYC requests:', error);
      notify.message('Failed to load KYC requests. Make sure you are authenticated as admin.');
    }
    setLoading(false);
  };

  const filterRequests = () => {
    let filtered = [...kycRequests];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(kyc => kyc.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(kyc => 
        ((kyc.userFullName || kyc.user?.fullName || kyc.user?.name || '')).toLowerCase().includes(query) ||
        kyc.user?.email?.toLowerCase().includes(query) ||
        (kyc.userEmail || '').toLowerCase().includes(query) ||
        kyc.documentNumber?.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  };

  // Keep selectedKYC updated when data refreshes
  useEffect(() => {
    if (selectedKYC && kycRequests.length > 0) {
      const updated = kycRequests.find(k => k._id === selectedKYC._id);
      if (updated) {
        setSelectedKYC(updated);
      }
    }
  }, [kycRequests]);

  const handleViewDetails = (kyc) => {
    setSelectedKYC(kyc);
    setShowDetailModal(true);
  };

  const handleApprove = async (kycId) => {
    if (!(await confirmAction({ message: 'Are you sure you want to approve this KYC submission?' }))) {
      return;
    }

    setActionLoading(true);
    try {
      const role = localStorage.getItem('userRole') || '';
      const response = await axios.put(
        `/api/admin/kyc/${kycId}/verify`,
        { status: 'approved', remarks: 'Approved by admin' },
        {
          headers: { 
            'x-user-role': role
          }
        }
      );

      if (response.data.success) {
        notify.message('KYC approved successfully');
        notifyAdminDataChanged();
        fetchKYCRequests();
        setShowDetailModal(false);
        setSelectedKYC(null);
      }
    } catch (error) {
      console.error('Failed to approve KYC:', error);
      notify.message(error.response?.data?.message || 'Failed to approve KYC');
    }
    setActionLoading(false);
  };

  const handleRejectClick = (kyc) => {
    setPendingActionKYC(kyc);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) {
      notify.message('Please provide a reason for rejection');
      return;
    }

    setActionLoading(true);
    try {
      const role = localStorage.getItem('userRole') || '';
      const response = await axios.put(
        `/api/admin/kyc/${pendingActionKYC._id}/verify`,
        { status: 'rejected', remarks: rejectionReason },
        {
          headers: { 
            'x-user-role': role
          }
        }
      );

      if (response.data.success) {
        notify.message('KYC rejected successfully');
        notifyAdminDataChanged();
        fetchKYCRequests();
        setShowRejectModal(false);
        setShowDetailModal(false);
        setSelectedKYC(null);
        setPendingActionKYC(null);
        setRejectionReason('');
      }
    } catch (error) {
      console.error('Failed to reject KYC:', error);
      notify.message(error.response?.data?.message || 'Failed to reject KYC');
    }
    setActionLoading(false);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: {
        bg: 'bg-warning/10',
        text: 'text-warning',
        icon: LuClock,
        label: 'Pending'
      },
      approved: {
        bg: 'bg-success/10',
        text: 'text-success',
        icon: LuCircleCheck,
        label: 'Approved'
      },
      rejected: {
        bg: 'bg-danger/10',
        text: 'text-danger',
        icon: LuCircleX,
        label: 'Rejected'
      }
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="mr-1.5" />
        {badge.label}
      </span>
    );
  };

  const getDocumentTypeLabel = (type) => {
    const labels = {
      passport: 'Passport',
      national_id: 'National ID',
      driving_license: 'Driving License'
    };
    return labels[type] || type;
  };

  const stats = {
    total: kycRequests.length,
    pending: kycRequests.filter(k => k.status === 'pending').length,
    approved: kycRequests.filter(k => k.status === 'approved').length,
    rejected: kycRequests.filter(k => k.status === 'rejected').length
  };

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">KYC Management</h1>
          <p className="text-text-muted">Review and manage customer KYC submissions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-text-muted text-sm">Total Submissions</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
              </div>
              <LuIdCard aria-hidden="true" className="text-info text-3xl" />
            </div>
          </div>

          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-text-muted text-sm">Pending Review</p>
                <p className="text-2xl font-bold text-warning mt-1">{stats.pending}</p>
              </div>
              <LuClock aria-hidden="true" className="text-warning text-3xl" />
            </div>
          </div>

          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-text-muted text-sm">Approved</p>
                <p className="text-2xl font-bold text-success mt-1">{stats.approved}</p>
              </div>
              <LuCircleCheck aria-hidden="true" className="text-success text-3xl" />
            </div>
          </div>

          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-text-muted text-sm">Rejected</p>
                <p className="text-2xl font-bold text-danger mt-1">{stats.rejected}</p>
              </div>
              <LuCircleX aria-hidden="true" className="text-danger text-3xl" />
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-surface rounded-lg p-4 border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <LuFilter aria-hidden="true" className="text-text-muted" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-surface-muted text-white rounded-lg px-4 py-2 border border-border focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 relative">
              <LuSearch aria-hidden="true" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search by name, email, or document number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-muted text-white rounded-lg pl-10 pr-4 py-2 border border-border focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* KYC List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <LuLoader aria-hidden="true" className="animate-spin text-info text-4xl" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-surface rounded-lg p-12 border border-border text-center">
            <LuIdCard aria-hidden="true" className="mx-auto text-text-muted text-6xl mb-4" />
            <p className="text-text-muted text-lg">No KYC submissions found</p>
          </div>
        ) : (
          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-muted">
                  <tr className="border-b border-border">
                    <th className={thClass}>Customer</th>
                    <th className={thClass}>Document Type</th>
                    <th className={thClass}>Document #</th>
                    <th className={thClass}>Submitted</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredRequests.map((kyc) => (
                    <tr key={kyc._id} className="hover:bg-surface-muted transition">
                      <td className={tdClass}>
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-semibold mr-3">
                            {((kyc.userFullName || kyc.user?.fullName || kyc.user?.name || 'U').charAt(0) || 'U').toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{kyc.userFullName || kyc.user?.fullName || kyc.user?.name || 'Unknown User'}</p>
                            <p className="text-text-muted text-sm">{kyc.userEmail || kyc.user?.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className={tdClass}>
                        {getDocumentTypeLabel(kyc.documentType)}
                      </td>
                      <td className={tdClass}>
                        {kyc.documentNumber}
                      </td>
                      <td className={tdClass}>
                        {new Date(kyc.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className={tdClass}>
                        {getStatusBadge(kyc.status)}
                      </td>
                      <td className={tdClass}>
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => handleViewDetails(kyc)}
                            className="bg-brand hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition"
                          >
                            <LuEye aria-hidden="true" />
                            <span>View</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Submission details */}
        <Modal
          open={showDetailModal && Boolean(selectedKYC)}
          onClose={() => setShowDetailModal(false)}
          title="KYC submission"
          description={selectedKYC ? `${customerName(selectedKYC)} · ${getDocumentTypeLabel(selectedKYC.documentType)}` : ''}
          size="lg"
          rootClassName="dark"
          footer={selectedKYC && selectedKYC.status === 'pending' ? (
            <>
              <Button variant="danger" icon={LuCircleX} onClick={() => handleRejectClick(selectedKYC)} disabled={actionLoading}>Reject</Button>
              <Button icon={LuCircleCheck} onClick={() => handleApprove(selectedKYC._id)} loading={actionLoading}>Approve</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Close</Button>
          )}
        >
          {selectedKYC && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge tone={KYC_TONE[selectedKYC.status] || 'warning'}>{KYC_LABEL[selectedKYC.status] || 'Pending review'}</Badge>
                <p className="text-xs text-text-muted">Submitted {formatLongDate(selectedKYC.createdAt)}</p>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailFact icon={LuUser} label="Customer" value={customerName(selectedKYC)} />
                <DetailFact icon={LuMail} label="Email" value={selectedKYC.user?.email || 'Not on file'} />
                <DetailFact icon={LuFileText} label="Document type" value={getDocumentTypeLabel(selectedKYC.documentType)} />
                <DetailFact icon={LuIdCard} label="Document number" value={selectedKYC.documentNumber || '—'} mono />
                {selectedKYC.verifiedAt && <DetailFact icon={LuCircleCheck} label="Verified at" value={formatLongDate(selectedKYC.verifiedAt)} />}
              </dl>

              <section aria-labelledby="kyc-document-heading" className="space-y-3">
                <h3 id="kyc-document-heading" className="font-display text-base font-semibold text-text">Document</h3>
                <div className="glass overflow-hidden rounded-2xl p-3">
                  <PrivateKycDocument
                    path={selectedKYC.documentImage}
                    alt="KYC document"
                    className="mx-auto max-h-[420px] w-auto max-w-full rounded-xl border border-border"
                  />
                </div>
              </section>

              {selectedKYC.status !== 'pending' && (
                <section aria-labelledby="kyc-remarks-heading" className="space-y-2">
                  <h3 id="kyc-remarks-heading" className="font-display text-base font-semibold text-text">Admin remarks</h3>
                  <p className="rounded-xl bg-surface-muted p-4 text-sm text-text">{selectedKYC.remarks || 'No remarks provided'}</p>
                </section>
              )}
            </div>
          )}
        </Modal>

        {/* Rejection reason */}
        <Modal
          open={showRejectModal}
          onClose={() => {
            if (actionLoading) return;
            setShowRejectModal(false);
            setPendingActionKYC(null);
            setRejectionReason('');
          }}
          title="Reject this KYC submission?"
          description="The reason is shown to the customer."
          size="sm"
          rootClassName="dark"
          footer={(
            <>
              <Button
                variant="secondary"
                onClick={() => { setShowRejectModal(false); setPendingActionKYC(null); setRejectionReason(''); }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleRejectConfirm} disabled={!rejectionReason.trim()} loading={actionLoading}>
                Confirm Rejection
              </Button>
            </>
          )}
        >
          <FormField id="kyc-reject-reason" label="Reason" required>
            <textarea
              {...fieldAria('kyc-reject-reason')}
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className={`${inputClass} resize-none`}
            />
          </FormField>
        </Modal>
      </div>
    </div>
  );
};

export default AdminKYCManager;
