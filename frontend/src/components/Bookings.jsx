import { LuBanknote, LuCircleX, LuClock, LuTriangleAlert } from 'react-icons/lu';
import { ChatIcon, CheckIcon, CloseIcon } from './ui/icons.js';
import { userMessage } from '../utils/errorMessage.js';
import { notify } from '../utils/notifyStore.js';
import { paymentTotals } from '../utils/paymentAccounting';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BookingDetailModal from './BookingDetailModal';
import OperatorChatModal from './OperatorChatModal';
import { useAuth } from '../context/AuthContext';
import ReviewModal from './ReviewModal';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { bookingLabel } from '../utils/bookingCode.js';


const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [chatBooking, setChatBooking] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTargetBooking, setReviewTargetBooking] = useState(null);
  const [reviewedPackages, setReviewedPackages] = useState(new Set());
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      const auth = localStorage.getItem('userId');
      const userId = (user && user.id) ? user.id : auth;
      if (!userId) {
        setBookings([]);
        setLoading(false);
        setError('Please log in to view your bookings.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/bookings?customerId=${userId}`);
        if (!res.ok) {
          const text = await res.text();
          console.error('Bookings fetch error', res.status, text);
          setError(`HTTP ${res.status}`);
          setBookings([]);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (data && data.success && data.bookings) setBookings(data.bookings);
        else if (Array.isArray(data)) setBookings(data);
        else setError(data?.message || 'Failed to load bookings');
      } catch (err) {
        console.error('Bookings fetch error', err);
        setError('Failed to load bookings');
        setBookings([]);
      }
      setLoading(false);
    };
    load();
  }, []);

  // When bookings load/change, detect which packages are already reviewed
  useEffect(() => {
    const loadReviewed = async () => {
      const userId = (user && user.id) || localStorage.getItem('userId');
      if (!userId || bookings.length === 0) return;
      const uniquePkgIds = Array.from(new Set(bookings.map(b => (b.packageId?._id || b.packageId || b.package?._id || b.package)))).filter(Boolean);
      const reviewed = new Set();
      await Promise.all(uniquePkgIds.map(async (pkgId) => {
        try {
          const res = await fetch(`/api/customers/${userId}/packages/${pkgId}/review`);
          if (!res.ok) return;
          const data = await res.json();
          if (data && data.success && data.review) reviewed.add(pkgId.toString());
        } catch (err) { /* ignore */ }
      }));
      setReviewedPackages(new Set(Array.from(reviewed)));
    };
    loadReviewed();
  }, [bookings, user]);

  const checkPaymentStatus = (booking) => {
    const totalPaid = paymentTotals(booking).gross;
    const totalAmount = booking.finalAmount ?? booking.totalAmount ?? 0;
    const isPaid = totalPaid >= totalAmount;
    const startDate = booking.startDate ? new Date(booking.startDate) : null;
    const now = new Date();
    const daysUntilStart = startDate ? Math.ceil((startDate - now) / (1000 * 60 * 60 * 24)) : null;
    
    return { totalPaid, totalAmount, isPaid, daysUntilStart, startDate };
  };

  // Separate bookings into three categories
  const categorizeBookings = () => {
    const paymentDue = [];
    const completed = [];
    const cancelled = [];

    bookings.forEach(b => {
      // Both CANCELLED and REFUNDED bookings go to cancelled section
      if (b.status === 'CANCELLED' || b.status === 'REFUNDED') {
        cancelled.push(b);
      } else {
        const paymentInfo = checkPaymentStatus(b);
        if (paymentInfo.isPaid || b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
          completed.push(b);
        } else {
          paymentDue.push(b);
        }
      }
    });

    return { paymentDue, completed, cancelled };
  };

  // Marks a confirmed booking as completed, then offers the review.
  const endTour = async (b) => {
    try {
      const res = await fetch(`/api/bookings/${b._id || b.id}/complete`, { method: 'POST' });
      if (!res.ok) {
        const txt = await res.text();
        notify.error(userMessage(txt, 'The tour could not be marked as completed. Please try again.'));
        return;
      }
      const data = await res.json();
      const updated = data.booking || data;
      setBookings(prev => prev.map(x => (x._id === updated._id ? updated : x)));
      try {
        const detail = {
          ...updated,
          _id: (updated._id && typeof updated._id.toString === 'function') ? updated._id.toString() : (updated._id || updated.id)
        };
        window.dispatchEvent(new CustomEvent('bookingUpdated', { detail }));
      } catch (e) { /* ignore */ }
      notify.message('Tour marked as completed. You can now write a review.');
    } catch (err) {
      console.error('End tour error', err);
      notify.message('Failed to end tour, please try again later.');
    }
  };

  const renderBookingCard = (b) => {
    const paymentInfo = checkPaymentStatus(b);
    const isCancelledOrRefunded = b.status === 'CANCELLED' || b.status === 'REFUNDED';
    const showWarning = !isCancelledOrRefunded && !paymentInfo.isPaid && paymentInfo.daysUntilStart !== null && paymentInfo.daysUntilStart <= 7 && paymentInfo.daysUntilStart >= 0;
    const isCancelledDueToNonPayment = isCancelledOrRefunded && b.cancellation?.reason?.includes('payment');
    // Only show refund info if payment was made
    const hasPayments = paymentInfo.totalPaid > 0;
    const hasRefund = isCancelledOrRefunded && hasPayments && b.cancellation?.refundAmount > 0;
    const isRefundProcessed = b.status === 'REFUNDED' || b.cancellation?.refundProcessed;
    const currency = b.currency || 'BDT';
    const pkgId = b.packageId?._id || b.packageId || (b.package?._id || b.package);
    const bookingMarked = b._reviewed || b.review || (b.reviews && b.reviews.length > 0) || b.hasReview || b.reviewId;
    const alreadyReviewed = bookingMarked || (pkgId && reviewedPackages && reviewedPackages.has(pkgId.toString()));

    return (
      <article key={b._id || b.id} data-booking-details-id={b._id || b.id} className={`glass rounded-2xl p-5 ${showWarning ? 'ring-2 ring-danger/60' : ''}`}>
        {showWarning && (
          <Notice tone="danger" icon={LuTriangleAlert} title="Payment required">
            <p>
              {paymentInfo.daysUntilStart === 0
                ? 'Tour starts today! Complete payment immediately or booking will be cancelled.'
                : `Tour starts in ${paymentInfo.daysUntilStart} day${paymentInfo.daysUntilStart > 1 ? 's' : ''}. Complete payment to confirm your spot.`}
            </p>
            <p className="mt-1 text-xs">Unpaid: {currency} {paymentInfo.totalAmount - paymentInfo.totalPaid}</p>
          </Notice>
        )}
        {isCancelledDueToNonPayment && (
          <Notice tone="danger" icon={LuCircleX} title="Booking cancelled">
            <p>{b.cancellation?.reason || 'Cancelled due to non-payment'}</p>
            <p className="mt-1 text-xs">No refund applicable (payment not completed)</p>
          </Notice>
        )}
        {!isCancelledDueToNonPayment && isCancelledOrRefunded && !hasPayments && (
          <Notice tone="neutral" icon={CloseIcon} title="Booking cancelled">
            <p>{b.cancellation?.reason || 'Booking was cancelled'}</p>
            <p className="mt-1 text-xs">No refund applicable (no payment made)</p>
          </Notice>
        )}
        {hasRefund && (
          <Notice
            tone={isRefundProcessed ? 'success' : 'warning'}
            icon={isRefundProcessed ? LuBanknote : LuClock}
            title={isRefundProcessed ? 'Refund processed' : 'Refund pending'}
          >
            <p>
              {isRefundProcessed
                ? `${currency} ${b.cancellation.refundAmount} has been refunded to your account.`
                : `${currency} ${b.cancellation.refundAmount} will be refunded soon.`}
            </p>
            {isRefundProcessed && b.cancellation.refundProcessedAt && (
              <p className="mt-1 text-xs">Processed on: {new Date(b.cancellation.refundProcessedAt).toLocaleDateString()}</p>
            )}
          </Notice>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-brand">{bookingLabel(b)}</p>
            <h4 className="font-display text-lg font-semibold text-text">{b.packageId?.title || b.package?.title || b.packageTitle || 'Package'}</h4>
            <p className="mt-1 text-sm text-text-muted">
              {b.startDate ? new Date(b.startDate).toLocaleDateString() : 'TBD'} → {b.endDate ? new Date(b.endDate).toLocaleDateString() : 'TBD'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-lg font-bold text-brand">
              {currency} {Number(b.finalAmount ?? b.totalAmount ?? b.amount ?? 0).toLocaleString()}
            </p>
            <div className="mt-1 flex justify-end"><Badge value={b.status || 'PENDING'} /></div>
            {b.payments && b.payments.length > 0 && (
              <p className={`mt-1 text-xs ${paymentInfo.isPaid ? 'font-semibold text-success' : 'text-text-muted'}`}>
                Paid: {currency} {paymentInfo.totalPaid}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setSelected(b)}>View Details</Button>
          {paymentInfo.isPaid && b.assignedOperator && (
            <Button size="sm" variant="secondary" icon={ChatIcon} onClick={() => setChatBooking(b)}>Chat</Button>
          )}
          {paymentInfo.isPaid && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') && (
            <Button size="sm" variant="secondary" onClick={() => endTour(b)}>End tour</Button>
          )}
          {b.status === 'COMPLETED' && (alreadyReviewed ? (
            <Button size="sm" variant="secondary" onClick={() => navigate('/customer/reviews')}>View review</Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => { setReviewTargetBooking(b); setReviewModalOpen(true); }}>Write review</Button>
          ))}
        </div>
      </article>
    );
  };

  const groups = categorizeBookings();

  return (
    <section aria-labelledby="bookings-heading" className="space-y-6">
      <h2 id="bookings-heading" className="font-display text-2xl font-bold text-text">My bookings</h2>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2" aria-hidden="true">
          {[0, 1].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
        </div>
      )}
      {!loading && error && (
        <ErrorState
          title="Your bookings could not be loaded"
          message={error === 'Please log in to view your bookings.' ? error : 'Please refresh the page. If it keeps happening, contact support.'}
        />
      )}
      {!loading && !error && bookings.length === 0 && (
        <EmptyState
          title="No bookings yet"
          description="When you book a tour, it appears here."
          action={<Button variant="secondary" onClick={() => navigate('/browse-packages')}>Browse tours</Button>}
        />
      )}
      {!loading && !error && bookings.length > 0 && (
        <div className="space-y-8">
          {groups.paymentDue.length > 0 && (
            <BookingGroup id="payment-due-heading" title="Payment due" tone="danger" icon={LuTriangleAlert} items={groups.paymentDue} render={renderBookingCard} />
          )}
          {groups.completed.length > 0 && (
            <BookingGroup id="completed-heading" title="Confirmed & completed" tone="success" icon={CheckIcon} items={groups.completed} render={renderBookingCard} />
          )}
          {groups.cancelled.length > 0 && (
            <BookingGroup id="cancelled-heading" title="Cancelled" tone="neutral" icon={CloseIcon} items={groups.cancelled} render={renderBookingCard} />
          )}
        </div>
      )}

      {selected && (
        <BookingDetailModal booking={selected} onClose={() => setSelected(null)} onUpdate={(updated) => {
          const merged = { ...selected, ...updated, packageId: typeof updated.packageId === 'string' ? selected.packageId : updated.packageId };
          setBookings(previous => previous.map(booking => booking._id === updated._id ? merged : booking));
          setSelected(merged);
          window.dispatchEvent(new CustomEvent('bookingUpdated', { detail: merged }));
        }} />
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
            // mark the booking locally so UI updates immediately
            setBookings(prev => prev.map(x => (x._id === (booking._id || booking.id) ? ({ ...x, _reviewed: true }) : x)));
          }}
        />
      )}
    </section>
  );
};

export default Bookings;

const NOTICE_TONE = {
  danger: { box: 'border-danger/40 bg-danger/10', icon: 'text-danger' },
  success: { box: 'border-success/40 bg-success/10', icon: 'text-success' },
  warning: { box: 'border-warning/40 bg-warning/10', icon: 'text-warning' },
  neutral: { box: 'border-border bg-surface-muted', icon: 'text-text-muted' },
};

// Coloured message inside a booking card: payment, cancellation and refund.
function Notice({ tone, icon: Icon, title, children }) {
  const style = NOTICE_TONE[tone];
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-xl border p-3 ${style.box}`}>
      <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 flex-none ${style.icon}`} />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-text">{title}</p>
        <div className="mt-0.5 text-text-muted">{children}</div>
      </div>
    </div>
  );
}

const GROUP_TONE = { danger: 'text-danger', success: 'text-success', neutral: 'text-text-muted' };

// A titled group of booking cards, for example "Payment due".
function BookingGroup({ id, title, tone, icon: Icon, items, render }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h3 id={id} className={`flex items-center gap-2 font-display text-lg font-semibold ${GROUP_TONE[tone]}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
        {title} ({items.length})
      </h3>
      <div className="grid gap-4 md:grid-cols-2">{items.map(render)}</div>
    </section>
  );
}
