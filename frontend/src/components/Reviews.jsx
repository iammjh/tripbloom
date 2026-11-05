import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toDisplayReviews } from '../utils/reviewPresentation';
import Button from './ui/Button.jsx';
import Modal from './ui/Modal.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { LuQuote, LuStar, LuMessageSquareQuote } from 'react-icons/lu';

// Approved reviews only. Nothing is invented: when there are none, the section says so.
function Stars({ rating }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map(index => (
        <LuStar key={index} aria-hidden="true" className={`h-4 w-4 ${index < rating ? 'fill-warning text-warning' : 'text-border'}`} />
      ))}
    </div>
  );
}

function Avatar({ name, src }) {
  if (src) return <img src={src} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />;
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
  return (
    <span aria-hidden="true" className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
      {initials || '?'}
    </span>
  );
}

function ReviewCard({ review }) {
  return (
    <article className="flex h-full flex-col rounded-2xl glass p-6 shadow-sm transition-shadow hover:shadow-md">
      <LuQuote aria-hidden="true" className="mb-3 h-7 w-7 text-brand/40" />
      <blockquote className="flex-1 text-sm leading-relaxed text-text">{review.comment || 'No comment left.'}</blockquote>
      <footer className="mt-5 flex items-center gap-3 border-t border-border pt-4">
        <Avatar name={review.name} src={review.avatar} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{review.name}</p>
          <Stars rating={review.rating} />
        </div>
      </footer>
    </article>
  );
}

function ReviewSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <Skeleton className="h-4 w-full" lines={3} />
      <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [allOpen, setAllOpen] = useState(false);
  const [allReviews, setAllReviews] = useState([]);
  const [allStatus, setAllStatus] = useState('idle');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await axios.get('/api/reviews', { params: { status: 'APPROVED' } });
      setReviews(toDisplayReviews(response.data));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAll = async () => {
    setAllOpen(true);
    setAllStatus('loading');
    try {
      const response = await axios.get('/api/reviews', { params: { status: 'APPROVED' } });
      setAllReviews(toDisplayReviews(response.data));
      setAllStatus('ready');
    } catch {
      setAllStatus('error');
    }
  };

  let body;
  if (status === 'loading') {
    body = <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <ReviewSkeleton key={i} />)}</div>;
  } else if (status === 'error') {
    body = <ErrorState title="Reviews could not be loaded" message="Please try again in a moment." onRetry={load} />;
  } else if (reviews.length === 0) {
    body = (
      <EmptyState
        icon={LuMessageSquareQuote}
        title="No published reviews yet"
        description="Traveller reviews appear here once they have been checked and approved."
      />
    );
  } else {
    body = (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reviews.slice(0, 6).map(review => <ReviewCard key={review.id} review={review} />)}
      </div>
    );
  }

  return (
    <section aria-labelledby="reviews-heading" className="mesh-bg py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">Reviews</p>
          <h2 id="reviews-heading" className="mt-2 font-display text-3xl font-bold text-text sm:text-4xl">What travellers say</h2>
          <p className="mt-3 text-base text-text-muted">Honest feedback from people who booked with TripBloom.</p>
        </header>

        {body}

        {status === 'ready' && reviews.length > 0 && (
          <div className="mt-10 text-center">
            <Button variant="secondary" onClick={openAll}>View all reviews</Button>
          </div>
        )}
      </div>

      <Modal open={allOpen} onClose={() => setAllOpen(false)} title="All reviews" description="Approved reviews from travellers" size="xl">
        {allStatus === 'loading' && <Skeleton className="h-24 w-full" lines={3} />}
        {allStatus === 'error' && <ErrorState title="Reviews could not be loaded" onRetry={openAll} />}
        {allStatus === 'ready' && allReviews.length === 0 && (
          <EmptyState icon={LuMessageSquareQuote} title="No published reviews yet" description="Approved reviews will be listed here." />
        )}
        {allStatus === 'ready' && allReviews.length > 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {allReviews.map(review => <ReviewCard key={review.id} review={review} />)}
          </div>
        )}
      </Modal>
    </section>
  );
};

export default Reviews;
