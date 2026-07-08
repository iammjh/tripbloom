import React, { useEffect, useState } from 'react';
import BookingDetailModal from './BookingDetailModal';
import OperatorChatModal from './OperatorChatModal';
import { useAuth } from '../context/AuthContext';
import ReviewModal from './ReviewModal';
import { FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';

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
    const totalPaid = (booking.payments || []).filter(p => 
      p.status === 'SUCCESS' || p.status === 'COMPLETED' || p.status === 'CONFIRMED'
    ).reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAmount = booking.totalAmount || 0;
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

  const renderBookingCard = (b) => {
    const paymentInfo = checkPaymentStatus(b);
    const isCancelledOrRefunded = b.status === 'CANCELLED' || b.status === 'REFUNDED';
    const showWarning = !isCancelledOrRefunded && !paymentInfo.isPaid && paymentInfo.daysUntilStart !== null && paymentInfo.daysUntilStart <= 7 && paymentInfo.daysUntilStart >= 0;
    const isCancelledDueToNonPayment = isCancelledOrRefunded && b.cancellation?.reason?.includes('payment');
    
    // Only show refund info if payment was made
    const hasPayments = paymentInfo.totalPaid > 0;
    const hasRefund = isCancelledOrRefunded && hasPayments && b.cancellation?.refundAmount > 0;
    const isRefundProcessed = b.status === 'REFUNDED' || b.cancellation?.refundProcessed;
    
    return (
      <div key={b._id || b.id} className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow ${showWarning ? 'border-2 border-red-500' : ''}`}>
        {showWarning && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-3 rounded">
            <div className="flex items-start">
              <FaExclamationTriangle className="text-red-500 text-xl mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800">Payment Required!</p>
                <p className="text-sm text-red-700">
                  {paymentInfo.daysUntilStart === 0 
                    ? 'Tour starts today! Complete payment immediately or booking will be cancelled.'
                    : `Tour starts in ${paymentInfo.daysUntilStart} day${paymentInfo.daysUntilStart > 1 ? 's' : ''}. Complete payment to confirm your spot.`
                  }
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Unpaid: {b.currency || 'BDT'} {paymentInfo.totalAmount - paymentInfo.totalPaid}
                </p>
              </div>
            </div>
          </div>
        )}
        {isCancelledDueToNonPayment && (
          <div className="bg-red-100 border-l-4 border-red-600 p-3 mb-3 rounded">
            <div className="flex items-start">
              <FaTimesCircle className="text-red-600 text-xl mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">Booking Cancelled</p>
                <p className="text-sm text-red-800">{b.cancellation?.reason || 'Cancelled due to non-payment'}</p>
                <p className="text-xs text-red-700 mt-1">No refund applicable (payment not completed)</p>
              </div>
            </div>
          </div>
        )}
        {!isCancelledDueToNonPayment && isCancelledOrRefunded && !hasPayments && (
          <div className="bg-gray-100 border-l-4 border-gray-500 p-3 mb-3 rounded">
            <div className="flex items-start">
              <span className="text-gray-600 text-xl mr-2">✕</span>
              <div>
                <p className="font-semibold text-gray-900">Booking Cancelled</p>
                <p className="text-sm text-gray-700">{b.cancellation?.reason || 'Booking was cancelled'}</p>
                <p className="text-xs text-gray-600 mt-1">No refund applicable (no payment made)</p>
              </div>
            </div>
          </div>
        )}
        {hasRefund && (
          <div className={`${isRefundProcessed ? 'bg-green-50 border-green-500' : 'bg-yellow-50 border-yellow-500'} border-l-4 p-3 mb-3 rounded`}>
            <div className="flex items-start">
              <span className={`${isRefundProcessed ? 'text-green-600' : 'text-yellow-600'} text-xl mr-2`}>
                {isRefundProcessed ? '💰' : '⏳'}
              </span>
              <div>
                <p className={`font-semibold ${isRefundProcessed ? 'text-green-900' : 'text-yellow-900'}`}>
                  {isRefundProcessed ? 'Refund Processed' : 'Refund Pending'}
                </p>
                <p className={`text-sm ${isRefundProcessed ? 'text-green-800' : 'text-yellow-800'}`}>
                  {isRefundProcessed 
                    ? `${b.currency || 'BDT'} ${b.cancellation.refundAmount} has been refunded to your account.`
                    : `${b.currency || 'BDT'} ${b.cancellation.refundAmount} will be refunded soon.`
                  }
                </p>
                {isRefundProcessed && b.cancellation.refundProcessedAt && (
                  <p className="text-xs text-green-700 mt-1">
                    Processed on: {new Date(b.cancellation.refundProcessedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">{b.packageId?.title || b.package?.title || b.packageTitle || 'Package'}</h3>
            <p className="text-sm text-gray-500">{b.startDate ? new Date(b.startDate).toLocaleDateString() : 'TBD'} → {b.endDate ? new Date(b.endDate).toLocaleDateString() : 'TBD'}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-primary">{b.currency || '$'}{b.totalAmount || b.amount || 0}</p>
            <p className={`mt-1 text-sm font-semibold ${
              b.status === 'CONFIRMED' || b.status === 'Confirmed' ? 'text-green-600' : 
              b.status === 'REFUNDED' ? 'text-blue-600' :
              b.status === 'CANCELLED' ? 'text-red-600' : 'text-yellow-600'
            }`}>{b.status || 'Pending'}</p>
            {b.payments && b.payments.length > 0 && (
              <p className={`text-sm ${
                paymentInfo.isPaid ? 'text-green-600 font-semibold' : 'text-gray-500'
              }`}>Paid: {b.currency || 'BDT'} {paymentInfo.totalPaid}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setSelected(b)} className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-green-700 transition-colors">
            View Details
          </button>
          {paymentInfo.isPaid && b.assignedOperator && (
            <button 
              onClick={() => setChatBooking(b)} 
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              💬 Chat
            </button>
          )}
          {(paymentInfo.isPaid && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN')) && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/bookings/${b._id || b.id}/complete`, { method: 'POST' });
                  if (!res.ok) {
                    const txt = await res.text();
                    alert('Failed to end tour: ' + txt);
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
                  alert('Tour marked as completed. You can now write a review.');
                } catch (err) {
                  console.error('End tour error', err);
                  alert('Failed to end tour, please try again later.');
                }
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              End Tour
            </button>
          )}
          {b.status === 'COMPLETED' && (() => {
            const pkgId = b.packageId?._id || b.packageId || (b.package?._id || b.package);
            const bookingMarked = b._reviewed || b.review || (b.reviews && b.reviews.length > 0) || b.hasReview || b.reviewId;
            const already = bookingMarked || (pkgId && reviewedPackages && reviewedPackages.has(pkgId.toString()));
            if (already) {
              return (
                <button onClick={() => window.location.href = '/customer/reviews'} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 transition-colors">View Review</button>
              );
            }
            return (
              <button onClick={() => { setReviewTargetBooking(b); setReviewModalOpen(true); }} className="px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors">Write Review</button>
            );
          })()}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Bookings</h2>
      {loading ? (
        <p>Loading bookings…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <>
          {(() => {
            const { paymentDue, completed, cancelled } = categorizeBookings();
            
            return (
              <>
                {/* Payment Due Section */}
                {paymentDue.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
                      <FaExclamationTriangle className="text-red-500 flex-shrink-0" /> Payment Due ({paymentDue.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {paymentDue.map(renderBookingCard)}
                    </div>
                  </div>
                )}

                {/* Confirmed/Completed Section */}
                {completed.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-green-600 dark:text-green-400 mb-4 flex items-center">
                      <span className="mr-2">✓</span> Confirmed & Completed ({completed.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {completed.map(renderBookingCard)}
                    </div>
                  </div>
                )}

                {/* Cancelled Section */}
                {cancelled.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-gray-500 dark:text-gray-400 mb-4 flex items-center">
                      <span className="mr-2">✕</span> Cancelled ({cancelled.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {cancelled.map(renderBookingCard)}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {selected && (
        <BookingDetailModal booking={selected} onClose={() => setSelected(null)} onUpdate={(updated) => {
          setBookings((prev) => prev.map(p => (p._id === updated._id ? updated : p)));
          setSelected(updated);
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
    </div>
  );
};

export default Bookings;
