import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import FormField, { fieldAria, inputClass } from './ui/FormField.jsx';
import { userMessage } from '../utils/errorMessage.js';
import { notify } from '../utils/notifyStore.js';

const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 1000;
const RATING_LABELS = { 5: '5 - Excellent', 4: '4 - Very good', 3: '3 - Good', 2: '2 - Fair', 1: '1 - Poor' };

// True when the trip has ended, so a review can be written for it.
function isBookingCompleted(b) {
  if (!b) return false;
  const status = (b.status || (b.booking && b.booking.status) || '').toString().toUpperCase();
  if (status === 'COMPLETED') return true;
  if (b.isOngoing === false) return true;
  const endDate = b.endDate || (b.booking && b.booking.endDate) || b.endedAt || (b.booking && b.booking.endedAt);
  if (endDate) {
    const d = new Date(endDate);
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) return true;
  }
  return false;
}

// Writes a review for a completed trip, or edits an existing one.
// A rejected review is edited and resubmitted: saving sends it back to moderation.
const ReviewModal = ({ isOpen, booking, review, onClose, onSubmitted }) => {
  const { user } = useAuth();
  const editing = Boolean(review);
  const isRejected = editing && review.status === 'REJECTED';
  const packageTitle = (editing && review.packageId?.title) || booking?.packageId?.title || booking?.package?.title || 'Package';
  const completed = editing || isBookingCompleted(booking);

  const [rating, setRating] = useState(String(review?.rating || 5));
  const [comment, setComment] = useState(review?.comment || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen || (!booking && !review)) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const numericRating = Number(rating);
    const text = comment.trim();
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      setError('Choose a rating from 1 to 5.');
      return;
    }
    if (text.length < MIN_COMMENT_LENGTH || text.length > MAX_COMMENT_LENGTH) {
      setError(`Write between ${MIN_COMMENT_LENGTH} and ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/reviews/${review._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: numericRating, comment: text }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          notify.message(data.message || 'Your review was saved.');
          if (onSubmitted) onSubmitted(data.review);
          if (onClose) onClose();
        } else {
          setError(userMessage(data, 'We could not save your review. Please try again.'));
        }
        return;
      }

      const userId = (user && user.id) || localStorage.getItem('userId');
      const pkgId = booking.packageId?._id || booking.packageId || (booking.package?._id || booking.package);
      if (!userId) { notify.message('Please log in to submit a review.'); return; }
      if (!pkgId) { notify.message('Package information is missing for this booking.'); return; }
      if (!isBookingCompleted(booking)) {
        setError('You can only review after the trip has ended.');
        return;
      }

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: userId, packageId: pkgId, bookingId: booking._id || booking.id, rating: numericRating, comment: text }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify.message('Thanks. Your review was submitted and is pending moderation.');
        if (onSubmitted) onSubmitted(booking);
        if (onClose) onClose();
      } else {
        const msg = data && data.message ? String(data.message) : '';
        // The customer already has a review for this tour: treat it as done so the list updates.
        if (msg.toLowerCase().includes('already reviewed')) {
          notify.message(msg);
          if (onSubmitted) onSubmitted(booking);
          if (onClose) onClose();
          return;
        }
        setError(userMessage(data, 'We could not submit your review. Please try again.'));
      }
    } catch (err) {
      console.error('Review submit error', err);
      setError('We could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remaining = comment.trim().length;
  const commentHint = `${MIN_COMMENT_LENGTH} to ${MAX_COMMENT_LENGTH} characters. You have written ${remaining}.`;
  const submitLabel = isRejected ? 'Resubmit for review' : editing ? 'Save changes' : 'Submit review';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isRejected ? 'Edit and resubmit your review' : editing ? 'Edit your review' : 'Write a review'}
      description={packageTitle}
      size="md"
      rootClassName="dark"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="review-form" loading={saving} disabled={!completed}>{submitLabel}</Button>
        </>
      }
    >
      <form id="review-form" onSubmit={submit} className="space-y-5" noValidate>
        {isRejected && review.moderatorNote && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
            <p className="font-semibold text-text">Why it was rejected</p>
            <p className="mt-1 text-text-muted">{review.moderatorNote}</p>
          </div>
        )}

        {!completed && (
          <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
            You can review this trip after it has ended.
          </p>
        )}

        <FormField id="review-rating" label="Rating" required>
          <select id="review-rating" value={rating} onChange={(e) => setRating(e.target.value)} className={inputClass}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{RATING_LABELS[n]}</option>)}
          </select>
        </FormField>

        <FormField id="review-comment" label="Your review" required>
          <textarea
            {...fieldAria('review-comment', { hint: commentHint })}
            aria-invalid={error ? true : undefined}
            rows={5}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={`${inputClass} resize-none`}
          />
          <p id="review-comment-hint" className={`text-xs ${error ? 'text-danger' : 'text-text-muted'}`}>{error || commentHint}</p>
        </FormField>
      </form>
    </Modal>
  );
};

export default ReviewModal;
