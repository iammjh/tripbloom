import React, { useState } from 'react';
import { LuBan, LuCalendarDays, LuCheck, LuMail, LuPackage, LuTriangleAlert, LuUser } from 'react-icons/lu';
import { confirmAction } from '../utils/confirmStore.js';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import FormField, { fieldAria, inputClass } from './ui/FormField.jsx';
import StarRating from './ui/StarRating.jsx';
import { DetailFact, DetailSection, DetailText, formatDetailDate } from './admin/DetailPrimitives.jsx';

const REVIEW_TONE = { APPROVED: 'success', REJECTED: 'danger', PENDING: 'warning' };
const REVIEW_LABEL = { APPROVED: 'Approved', REJECTED: 'Rejected', PENDING: 'Awaiting approval' };

// Review details for moderation. Approve and reject are offered while the review is pending.
const ReviewDetailModal = ({ review, onClose, onModerate }) => {
  const [moderatorNote, setModeratorNote] = useState('');
  if (!review) return null;

  const rating = Number(review.rating) || 0;
  const pending = review.status === 'PENDING';
  const booking = review.bookingId && typeof review.bookingId === 'object' ? review.bookingId : null;
  const packageType = review.packageId?.type === 'GROUP' ? 'Group tour' : review.packageId?.type === 'PERSONAL' ? 'Personal tour' : null;

  const moderate = async (status) => {
    const approving = status === 'APPROVED';
    const confirmed = await confirmAction({
      title: approving ? 'Approve this review?' : 'Reject this review?',
      message: approving
        ? 'The review will appear on the package page.'
        : 'The review will not be shown to customers. The customer can edit it and resubmit.',
      confirmLabel: approving ? 'Confirm approval' : 'Confirm rejection',
      danger: !approving,
    });
    if (confirmed && onModerate) onModerate(status, moderatorNote);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Review details"
      description={`${review.packageId?.title || 'Package'} · ${review.customerId?.fullName || 'Anonymous customer'}`}
      size="xl"
      rootClassName="dark"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {pending && onModerate && (
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" icon={LuBan} onClick={() => moderate('REJECTED')}>Reject review</Button>
              <Button icon={LuCheck} onClick={() => moderate('APPROVED')}>Approve review</Button>
            </div>
          )}
        </>
      )}
    >
      <div className="space-y-6">
        {/* Rating and status */}
        <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-4">
            <StarRating value={rating} size="h-6 w-6" />
            <span className="font-display text-2xl font-semibold text-text">{rating.toFixed(1)}<span className="text-base text-text-muted"> / 5</span></span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={REVIEW_TONE[review.status] || 'neutral'}>{REVIEW_LABEL[review.status] || review.status}</Badge>
            <span className="text-xs text-text-muted">Submitted {formatDetailDate(review.createdAt)}</span>
          </div>
        </div>

        {/* Comment */}
        <DetailSection id="review-comment-heading" title="Comment">
          <DetailText>{review.comment || 'No comment was written with this rating.'}</DetailText>
        </DetailSection>

        {/* Moderator note already recorded */}
        {review.moderatorNote && (
          <p role="note" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
            <LuTriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-warning" />
            <span><span className="font-semibold">Moderator note:</span> {review.moderatorNote}</span>
          </p>
        )}

        {/* Customer, package and booking */}
        <DetailSection id="review-facts-heading" title="Details">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailFact icon={LuUser} label="Customer" value={review.customerId?.fullName || 'Anonymous'} />
            <DetailFact icon={LuMail} label="Email" value={review.customerId?.email || 'Not on file'} />
            <DetailFact icon={LuPackage} label="Package" value={review.packageId?.title || 'Unknown package'} />
            <DetailFact icon={LuPackage} label="Tour type" value={[packageType, review.packageId?.category].filter(Boolean).join(' · ') || 'Not set'} />
            {booking && (
              <DetailFact icon={LuCalendarDays} label="Travel dates" value={`${formatDetailDate(booking.startDate, false)} – ${formatDetailDate(booking.endDate, false)}`} />
            )}
            {booking && <DetailFact icon={LuCheck} label="Booking status" value={booking.status || 'Not recorded'} />}
          </dl>
        </DetailSection>

        {/* Moderation note entry */}
        {pending && onModerate && (
          <DetailSection id="review-moderation-heading" title="Moderation">
            <FormField id="review-moderator-note" label="Note to the record (optional)" hint="Saved with the decision. Visible to administrators only.">
              <textarea
                {...fieldAria('review-moderator-note', { hint: true })}
                rows={3}
                value={moderatorNote}
                onChange={(e) => setModeratorNote(e.target.value)}
                placeholder="For example: the comment names a different package"
                className={`${inputClass} resize-none`}
              />
            </FormField>
          </DetailSection>
        )}

        {!pending && (
          <p className="text-sm text-text-muted">This review has already been {(review.status || '').toLowerCase()}.</p>
        )}
      </div>
    </Modal>
  );
};

export default ReviewDetailModal;
