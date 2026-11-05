import { LuCircleCheck, LuCircleX, LuMapPin, LuPencil, LuSearch, LuStar, LuTrash2 } from 'react-icons/lu';
import { NoteIcon } from './ui/icons.js';
import ReviewModal from './ReviewModal';
import { confirmAction } from '../utils/confirmStore.js';
import { notify } from '../utils/notifyStore.js';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CustomerPageFrame from './customer/CustomerPageFrame.jsx';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import FormField, { inputClass } from './ui/FormField.jsx';
import Skeleton from './ui/Skeleton.jsx';


const MyReviews = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'PENDING', 'APPROVED', 'REJECTED'
  const [customerId, setCustomerId] = useState('');
  // The review being edited (pending or rejected). Saving it updates the list.
  const [editingReview, setEditingReview] = useState(null);

  useEffect(() => {
    // Get customer ID from localStorage or use a test ID
    const userId = localStorage.getItem('userId') || '';
    setCustomerId(userId);
  }, []);

  useEffect(() => {
    if (customerId) {
      fetchReviews();
    }
  }, [customerId, statusFilter]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      let url = `/api/reviews?customerId=${customerId}`;
      
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }

      const response = await axios.get(url);
      
      if (response.data.success) {
        setReviews(response.data.reviews);
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reviewId) => {
    if (!(await confirmAction({ message: 'Are you sure you want to delete this review? This action cannot be undone.', danger: true }))) {
      return;
    }

    try {
      const response = await axios.delete(`/api/reviews/${reviewId}`, {
        data: { customerId }
      });

      if (response.data.success || response.data.message) {
        notify.message('Review deleted successfully');
        fetchReviews();
      }
    } catch (error) {
      notify.message(error.response?.data?.message || 'Failed to delete review. You can only delete pending reviews.');
    }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const filteredReviews = reviews.filter(review => {
    const term = searchTerm.toLowerCase();
    return review.packageId?.title?.toLowerCase().includes(term) ||
      review.packageId?.destination?.toLowerCase().includes(term) ||
      review.comment?.toLowerCase().includes(term);
  });

  const approvedCount = reviews.filter(r => r.status === 'APPROVED').length;
  const pendingCount = reviews.filter(r => r.status === 'PENDING').length;
  const averageRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const stats = [
    { label: 'Total reviews', value: reviews.length },
    { label: 'Approved', value: approvedCount },
    { label: 'Pending', value: pendingCount },
    { label: 'Average rating', value: averageRating ?? '—' },
  ];

  return (
    <CustomerPageFrame
      active="reviews"
      eyebrow="Your reviews"
      title="My reviews"
      description="The reviews you have written for tour packages. Approved reviews are visible to other travellers."
    >
      {!customerId && (
        <EmptyState title="Log in to see your reviews" description="Your reviews appear here after you sign in." />
      )}

      {customerId && (
        <>
          <section aria-label="Review summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map(({ label, value }) => (
              <div key={label} className="glass rounded-2xl p-5">
                <p className="text-sm text-text-muted">{label}</p>
                <p className="mt-1 font-display text-3xl font-bold text-text">{value}</p>
              </div>
            ))}
          </section>

          <form onSubmit={(e) => e.preventDefault()} aria-label="Filter reviews" className="glass flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-start">
            <div className="relative flex-1">
              <LuSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                aria-label="Search reviews"
                placeholder="Search reviews by package or comment"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${inputClass} pl-10`}
              />
            </div>
            <FormField id="review-status" label="Status" className="md:w-56">
              <select id="review-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
                <option value="all">All status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </FormField>
          </form>

          {loading && (
            <div className="space-y-4" aria-hidden="true">
              {[0, 1].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
            </div>
          )}

          {!loading && filteredReviews.length === 0 && (
            <EmptyState
              icon={LuStar}
              title="No reviews found"
              description={searchTerm || statusFilter !== 'all'
                ? 'Try a different search or status.'
                : 'Review a completed trip to help other travellers. Reviews appear here once you write them.'}
              action={!searchTerm && statusFilter === 'all' ? <Button variant="secondary" onClick={() => navigate('/customer/history')}>Go to history</Button> : null}
            />
          )}

          {!loading && filteredReviews.length > 0 && (
            <div className="space-y-4">
              {filteredReviews.map((review) => (
                <article key={review._id} className="glass rounded-2xl p-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-semibold text-text">{review.packageId?.title || 'Package'}</h3>
                      <p className="mt-1 flex items-center gap-2 text-sm text-text-muted">
                        <LuMapPin aria-hidden="true" className="h-4 w-4 flex-none" />
                        {review.packageId?.destination || 'Unknown destination'}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <Badge value={review.status || 'PENDING'} />
                      {review.createdAt && <span className="text-xs text-text-muted">{formatDate(review.createdAt)}</span>}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className="flex" aria-label={`Rated ${review.rating || 0} out of 5`}>
                      {[0, 1, 2, 3, 4].map((index) => (
                        <LuStar key={index} aria-hidden="true" className={`h-4 w-4 ${index < (review.rating || 0) ? 'fill-current text-warning' : 'text-border'}`} />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-text">{review.rating || 0} / 5</span>
                    {review.verified && <Badge tone="brand">Verified purchase</Badge>}
                  </div>

                  {review.comment && (
                    <p className="mt-4 rounded-xl bg-surface-muted p-4 leading-relaxed text-text">{review.comment}</p>
                  )}

                  {review.status === 'REJECTED' && review.moderatorNote && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4">
                      <LuCircleX aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-danger" />
                      <div className="text-sm">
                        <p className="font-semibold text-text">Rejection reason</p>
                        <p className="mt-1 text-text-muted">{review.moderatorNote}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                    {review.status === 'PENDING' && (
                      <>
                        <Button variant="secondary" size="sm" icon={LuPencil} onClick={() => setEditingReview(review)}>Edit review</Button>
                        <Button variant="danger" size="sm" icon={LuTrash2} onClick={() => handleDelete(review._id)}>Delete</Button>
                      </>
                    )}
                    {review.status === 'REJECTED' && (
                      <Button size="sm" icon={LuPencil} onClick={() => setEditingReview(review)}>Edit and resubmit</Button>
                    )}
                    {review.status === 'APPROVED' && (
                      <p className="flex items-center gap-2 text-sm text-text-muted">
                        <LuCircleCheck aria-hidden="true" className="h-4 w-4 text-success" />
                        This review is visible to other travellers.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <section aria-labelledby="guidelines-heading" className="glass rounded-2xl p-6">
            <h3 id="guidelines-heading" className="flex items-center gap-2 font-display text-lg font-semibold text-text">
              <NoteIcon aria-hidden="true" className="h-4 w-4 text-brand" />
              Review guidelines
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-text-muted">
              <li>You can only review tours you have completed.</li>
              <li>Reviews need admin approval before they are published.</li>
              <li>You can write one review per tour. A rejected review is edited and resubmitted, not replaced.</li>
              <li>You can edit or delete a pending review.</li>
              <li>After a rejection, edit the review to address the reason and resubmit it for moderation.</li>
              <li>Once approved, reviews cannot be edited or deleted.</li>
              <li>Be honest and constructive in your feedback.</li>
            </ul>
          </section>
        </>
      )}

      {/* Mounted only while a review is open, so its fields start from that review's values. */}
      {editingReview && (
        <ReviewModal
          key={editingReview._id}
          isOpen
          review={editingReview}
          onClose={() => setEditingReview(null)}
          onSubmitted={() => { setEditingReview(null); fetchReviews(); }}
        />
      )}
    </CustomerPageFrame>
  );
};

export default MyReviews;
