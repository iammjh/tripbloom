import { LuCheck, LuCircleCheck, LuCircleX, LuClock, LuEye, LuFilter, LuFlag, LuSearch, LuStar, LuX } from 'react-icons/lu';
import { CheckIcon } from './ui/icons.js';
import { userMessage } from '../utils/errorMessage.js';
import { confirmAction } from '../utils/confirmStore.js';
import { notify } from '../utils/notifyStore.js';
import StarRating from './ui/StarRating.jsx';
import { notifyAdminDataChanged } from '../utils/adminEvents.js';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

import ReviewDetailModal from './ReviewDetailModal';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import FormField, { inputClass } from './ui/FormField.jsx';
import { useSearchParams } from 'react-router-dom';

const ReviewsModerationList = () => {
  const [reviews, setReviews] = useState([]);
  const [allReviews, setAllReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [selectedReview, setSelectedReview] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchParams] = useSearchParams();
  const deepReviewId = searchParams.get('reviewId');

  useEffect(() => {
    fetchReviews();
  }, [statusFilter, ratingFilter]);

  useEffect(() => {
    // If a reviewId was provided via query param, try to open it after reviews load
    if (deepReviewId) {
      // If we already have it in the list, open it; otherwise fetch the single review
      const found = reviews.find(r => r._id === deepReviewId);
      if (found) {
        setSelectedReview(found);
        setShowDetailModal(true);
      } else {
        (async () => {
          try {
            const resp = await axios.get(`/api/reviews/${deepReviewId}`);
            if (resp.data && resp.data.review) {
              setSelectedReview(resp.data.review);
              setShowDetailModal(true);
            }
          } catch (err) {
            console.debug('Failed to fetch deep-linked review', deepReviewId, err?.message || err);
          }
        })();
      }
    }
  }, [deepReviewId, reviews]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      let url = '/api/reviews';
      const params = [];
      
      if (statusFilter !== 'all') {
        params.push(`status=${statusFilter}`);
      }
      
      if (ratingFilter !== 'all') {
        if (ratingFilter === 'low') {
          params.push('maxRating=2');
        } else if (ratingFilter === 'high') {
          params.push('minRating=4');
        }
      }

      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      const response = await axios.get(url);
      
      if (response.data.success) {
        setReviews(response.data.reviews);
      }
      // Also fetch all reviews (no filters) to compute global stats/averages
      try {
        const allRes = await axios.get('/api/reviews');
        if (allRes.data && allRes.data.reviews) {
          setAllReviews(allRes.data.reviews);
        }
      } catch (err) {
        console.debug('Failed to fetch all reviews for stats', err?.message || err);
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (reviewId, status, note = '') => {
    try {
      const response = await axios.patch(
        `/api/reviews/${reviewId}/moderate`,
        { status, moderatorNote: note }
      );

      if (response.data.success) {
        fetchReviews();
        notify.message(`Review ${status.toLowerCase()} successfully!`);
        notifyAdminDataChanged();
      }
    } catch (error) {
      notify.error(userMessage(error, 'The review could not be updated. Please try again.'));
    }
  };

  const handleApprove = async (reviewId) => {
    if (await confirmAction({ message: 'Are you sure you want to approve this review?' })) {
      handleModerate(reviewId, 'APPROVED');
    }
  };

  const handleReject = (reviewId) => {
    setRejectReason('');
    setRejecting(reviewId);
  };

  const confirmReject = () => {
    const reviewId = rejecting;
    if (!reviewId) return;
    setRejecting(null);
    handleModerate(reviewId, 'REJECTED', rejectReason.trim() || 'Does not meet guidelines');
  };

  const handleViewDetails = (review) => {
    setSelectedReview(review);
    setShowDetailModal(true);
  };

  // Filled stars follow the rating (a 4-star review fills four stars).
  const renderStars = (rating) => <StarRating value={rating} />;

  const getStatusBadge = (status) => {
    const config = {
      PENDING: { bg: 'bg-warning/10', text: 'text-warning', icon: LuClock },
      APPROVED: { bg: 'bg-success/10', text: 'text-success', icon: LuCircleCheck },
      REJECTED: { bg: 'bg-danger/10', text: 'text-danger', icon: LuCircleX }
    };

    const { bg, text, icon: Icon } = config[status] || config.PENDING;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
        <Icon className="mr-1" />
        {status}
      </span>
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = 
      review.customerId?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.packageId?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.comment?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="bg-surface rounded-2xl shadow-lg p-6 border border-border">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-text flex items-center">
          <LuStar aria-hidden="true" className="mr-3 text-warning" />
          Review Moderation
        </h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-warning/10 to-warning/5 rounded-xl p-4">
          <div className="text-sm text-warning font-semibold mb-1">Pending</div>
          <div className="text-3xl font-bold text-warning">
            {allReviews.filter(r => r.status === 'PENDING').length}
          </div>
        </div>
        <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-xl p-4">
          <div className="text-sm text-success font-semibold mb-1">Approved</div>
          <div className="text-3xl font-bold text-success">
            {allReviews.filter(r => r.status === 'APPROVED').length}
          </div>
        </div>
        <div className="bg-gradient-to-br from-danger/10 to-danger/5 rounded-xl p-4">
          <div className="text-sm text-danger font-semibold mb-1">Rejected</div>
          <div className="text-3xl font-bold text-danger">
            {allReviews.filter(r => r.status === 'REJECTED').length}
          </div>
        </div>
        <div className="bg-gradient-to-br from-info/10 to-info/5 rounded-xl p-4">
          <div className="text-sm text-info font-semibold mb-1">Avg Rating</div>
          <div className="text-3xl font-bold text-info">
            {allReviews.length > 0 ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1) : '0.0'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-muted rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <LuSearch aria-hidden="true" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-surface text-text"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
          >
            <option value="all">All Ratings</option>
            <option value="high">High (4–5 stars)</option>
            <option value="low">Low (1–2 stars)</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
          <p className="mt-4 text-text-muted">Loading reviews...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <LuStar aria-hidden="true" className="mx-auto text-6xl mb-4 opacity-20" />
          <p>No reviews found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <div
              key={review._id}
              className="bg-surface-muted rounded-xl p-4 border border-border hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-text">
                      {review.packageId?.title || 'Unknown Package'}
                    </h3>
                    {getStatusBadge(review.status)}
                    {review.verified && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-info/10 text-info">
                        <CheckIcon aria-hidden="true" className="inline h-4 w-4 align-[-2px]" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted">
                    By {review.customerId?.fullName || 'Anonymous'} • {formatDate(review.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {renderStars(review.rating)}
                  <span className="ml-2 font-bold text-text">{review.rating}.0</span>
                </div>
              </div>

              <p className="text-text mb-4 line-clamp-2">
                {review.comment}
              </p>

              {review.moderatorNote && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mb-4">
                  <p className="text-sm text-danger">
                    <strong>Moderator Note:</strong> {review.moderatorNote}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewDetails(review)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand hover:opacity-90 text-white rounded-lg transition-colors text-sm"
                >
                  <LuEye aria-hidden="true" />
                  View Details
                </button>
                {review.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleApprove(review._id)}
                      className="flex items-center gap-2 px-4 py-2 bg-brand hover:opacity-90 text-white rounded-lg transition-colors text-sm"
                    >
                      <LuCheck aria-hidden="true" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(review._id)}
                      className="flex items-center gap-2 px-4 py-2 bg-danger hover:opacity-90 text-white rounded-lg transition-colors text-sm"
                    >
                      <LuX aria-hidden="true" />
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject this review?"
        description="The customer can edit the review and resubmit it for moderation."
        size="md"
        rootClassName="dark"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmReject}>Confirm rejection</Button>
          </>
        )}
      >
        <FormField id="rejection-reason" label="Reason for the customer (optional)">
          <textarea
            id="rejection-reason"
            rows={4}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="For example: please describe the experience without naming staff."
            className={`${inputClass} resize-none`}
          />
        </FormField>
      </Modal>
      {/* Detail Modal */}
      {showDetailModal && selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReview(null);
          }}
          onModerate={(status, note) => {
            handleModerate(selectedReview._id, status, note);
            setShowDetailModal(false);
            setSelectedReview(null);
          }}
        />
      )}
    </div>
  );
};

export default ReviewsModerationList;
