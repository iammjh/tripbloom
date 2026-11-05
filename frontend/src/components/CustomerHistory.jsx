import { LuCalendar, LuMessagesSquare, LuStar } from 'react-icons/lu';
import { CheckIcon, LuggageIcon } from './ui/icons.js';
import { userMessage } from '../utils/errorMessage.js';
import { notify } from '../utils/notifyStore.js';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BookingDetailModal from './BookingDetailModal';
import OperatorChatModal from './OperatorChatModal';
import ReviewModal from './ReviewModal';
import CustomerPageFrame from './customer/CustomerPageFrame.jsx';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import Skeleton from './ui/Skeleton.jsx';


const CustomerHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [chatBooking, setChatBooking] = useState(null);
  const [reviewedPackages, setReviewedPackages] = useState(new Set());
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTargetBooking, setReviewTargetBooking] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      const userId = (user && user.id) || localStorage.getItem('userId');
      if (!userId) {
        setHistory([]);
        setLoading(false);
        setError('Please log in to view your history.');
        return;
      }
      
      setLoading(true);
      try {
        const res = await fetch(`/api/bookings?customerId=${userId}`);
        if (!res.ok) {
          const text = await res.text();
          console.error('History fetch error', res.status, text);
          setError(`HTTP ${res.status}`);
          setHistory([]);
          setLoading(false);
          return;
        }
        const data = await res.json();
        let bookings = [];
        if (data && data.success && data.bookings) bookings = data.bookings;
        else if (Array.isArray(data)) bookings = data;
        else setError(data?.message || 'Failed to load history');

        // Filter for completed/cancelled bookings or past trips
        const now = new Date();
        const pastBookings = bookings.filter(b => {
          const endDate = b.endDate ? new Date(b.endDate) : null;
          return b.status === 'COMPLETED' || 
                 b.status === 'CANCELLED' || 
                 (endDate && endDate < now);
        }).sort((a, b) => new Date(b.endDate || b.createdAt) - new Date(a.endDate || a.createdAt));

        setHistory(pastBookings);
      } catch (err) {
        console.error('History fetch error', err);
        setError('Failed to load history');
        setHistory([]);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // After history loads, check which packages the customer already reviewed
  useEffect(() => {
    const loadReviewed = async () => {
      const userId = (user && user.id) || localStorage.getItem('userId');
      if (!userId || history.length === 0) return;

      const uniquePkgIds = Array.from(new Set(history.map(b => (b.packageId?._id || b.packageId || b.package?._id || b.package)))).filter(Boolean);
      const reviewed = new Set();

      await Promise.all(uniquePkgIds.map(async (pkgId) => {
        try {
          const res = await fetch(`/api/customers/${userId}/packages/${pkgId}/review`);
          if (!res.ok) return;
          const data = await res.json();
          if (data && data.success && data.review) {
            reviewed.add(pkgId.toString());
          }
        } catch (err) {
          // ignore individual failures
        }
      }));

      setReviewedPackages(new Set(Array.from(reviewed)));
    };

    loadReviewed();
  }, [history, user]);

  const formatDate = (date) => {
    try {
      return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const submitReview = async ({ booking, rating, comment }) => {
    if (!booking) return;
    const pkgId = booking.packageId?._id || booking.packageId || (booking.package?._id || booking.package);
    const userId = (user && user.id) || localStorage.getItem('userId');
    if (!userId) return notify.message('Please login to submit a review.');
    if (!pkgId) return notify.message('Package information missing for this booking.');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: userId, packageId: pkgId, bookingId: booking._id || booking.id, rating, comment })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // mark reviewed locally
        setReviewedPackages(prev => {
          const copy = new Set(Array.from(prev));
          copy.add(pkgId.toString());
          return copy;
        });
        setReviewModalOpen(false);
        setReviewTargetBooking(null);
        notify.message('Thanks — your review was submitted and is pending moderation.');
      } else {
        notify.error(userMessage(data, 'We could not submit your review. Please try again.'));
      }
    } catch (err) {
      console.error('Review submit error', err);
      notify.message('Failed to submit review');
    }
  };
  const navigate = useNavigate();

  const paidTotal = (booking) => (booking.payments || [])
    .filter(p => p.status === 'SUCCESS' && p.method !== 'REFUND')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <CustomerPageFrame
      active="history"
      eyebrow="Your travels"
      title="Travel history"
      description="Your past and cancelled trips."
    >
      {loading && (
        <div className="space-y-4" aria-hidden="true">
          {[0, 1].map((i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      )}

      {!loading && error && (
        <ErrorState
          title="Your history could not be loaded"
          message={error === 'Please log in to view your history.' ? error : 'Please refresh the page. If it keeps happening, contact support.'}
        />
      )}

      {!loading && !error && history.length === 0 && (
        <EmptyState
          icon={LuggageIcon}
          title="No travel history yet"
          description="Completed and cancelled trips appear here."
          action={<Button onClick={() => navigate('/browse-packages')}>Browse tours</Button>}
        />
      )}

      {!loading && !error && history.length > 0 && (
        <div className="space-y-4">
          {history.map((booking) => {
            const packageInfo = booking.packageId || {};
            const paid = paidTotal(booking);
            const isPaid = paid >= (booking.totalAmount || 0);
            const currency = booking.currency || 'BDT';
            const pkgId = booking.packageId?._id || booking.packageId || (booking.package?._id || booking.package);
            const alreadyReviewed = Boolean(pkgId && reviewedPackages && reviewedPackages.has(pkgId.toString()));

            return (
              <article key={booking._id || booking.id} className="glass flex flex-col overflow-hidden rounded-2xl md:flex-row">
                <div className="relative h-48 flex-none overflow-hidden bg-surface-muted md:h-auto md:w-64">
                  <HistoryPhoto src={packageInfo.photos?.[0]} alt={packageInfo.title || 'Tour'} />
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-semibold text-text">{packageInfo.title || 'Package'}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                        <span className="inline-flex items-center gap-2">
                          <LuCalendar aria-hidden="true" className="h-4 w-4" />
                          {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                        </span>
                        <span>{booking.numTravelers || 1} traveller{booking.numTravelers > 1 ? 's' : ''}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <Badge value={booking.status || 'PENDING'} />
                      <span className={`text-sm ${isPaid ? 'inline-flex items-center gap-1 font-semibold text-success' : 'text-text-muted'}`}>
                        {isPaid ? <><CheckIcon aria-hidden="true" className="h-3.5 w-3.5" /> Paid</> : 'Partially paid'}
                      </span>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-4 rounded-xl bg-surface-muted p-4 text-sm md:grid-cols-4">
                    <div>
                      <dt className="text-text-muted">Total amount</dt>
                      <dd className="mt-1 font-semibold text-text">{currency} {Number(booking.totalAmount || 0).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">Amount paid</dt>
                      <dd className="mt-1 font-semibold text-success">{currency} {paid.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">Booked on</dt>
                      <dd className="mt-1 font-semibold text-text">{formatDate(booking.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">Booking type</dt>
                      <dd className="mt-1 font-semibold text-text">{booking.bookingType || 'N/A'}</dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setSelected(booking)}>View Details</Button>
                    {isPaid && booking.assignedOperator && (
                      <Button size="sm" variant="secondary" icon={LuMessagesSquare} onClick={() => setChatBooking(booking)}>Chat with operator</Button>
                    )}
                    {booking.status === 'COMPLETED' && (alreadyReviewed ? (
                      <Button size="sm" variant="secondary" icon={LuStar} onClick={() => navigate('/customer/reviews')}>View review</Button>
                    ) : (
                      <Button size="sm" variant="secondary" icon={LuStar} onClick={() => { setReviewTargetBooking(booking); setReviewModalOpen(true); }}>Write review</Button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

        {selected && (
          <BookingDetailModal
            booking={selected}
            onClose={() => setSelected(null)}
            onUpdate={(updated) => {
              setHistory((prev) => prev.map(b => (b._id === updated._id ? updated : b)));
              setSelected(updated);
            }}
          />
        )}
        
        {chatBooking && (
          <OperatorChatModal
            isOpen={true}
            onClose={() => setChatBooking(null)}
            booking={chatBooking}
            operator={chatBooking.assignedOperator}
          />
        )}
        {reviewModalOpen && reviewTargetBooking && (
          <ReviewModal
            isOpen={reviewModalOpen}
            booking={reviewTargetBooking}
            onClose={() => { setReviewModalOpen(false); setReviewTargetBooking(null); }}
            onSubmitted={(booking) => {
              const pkgId = booking.packageId?._id || booking.packageId || (booking.package?._id || booking.package);
              if (pkgId) setReviewedPackages(prev => {
                const copy = new Set(Array.from(prev));
                copy.add(pkgId.toString());
                return copy;
              });
            }}
          />
        )}
    </CustomerPageFrame>
  );
};

export default CustomerHistory;

// Photo for a history card. Shows a branded field when there is no photo or the photo fails to load.
function HistoryPhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-brand-strong via-surface to-info/40" />;
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />;
}
