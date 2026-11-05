import { LuBanknote, LuCalendar, LuTriangleAlert } from 'react-icons/lu';
import { CheckIcon } from './ui/icons.js';
import { confirmAction } from '../utils/confirmStore.js';
import { notify } from '../utils/notifyStore.js';
import { bookingLabel } from '../utils/bookingCode.js';
import { paymentTotals } from '../utils/paymentAccounting';
import React, { useState, useEffect } from 'react';
import PaymentForm from './PaymentForm';
import Invoice from './Invoice';


const BookingDetailModal = ({ booking, onClose, onUpdate }) => {
  const [showPayment, setShowPayment] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelOptions, setShowCancelOptions] = useState(false);
  const [requestingDateChange, setRequestingDateChange] = useState(false);

  // Prevent background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handlePaymentSuccess = (res) => {
    if (res && res.success && res.booking) {
      onUpdate(res.booking);
      setShowPayment(false);
    } else {
      // If backend returned an error, surface it via alert for now
      notify.message(res?.message || 'Payment failed');
    }
  };

  const handleCancelTour = async () => {
    // Calculate refund based on policy
    const calculateRefundAmount = () => {
      const now = new Date();
      const startDate = new Date(booking.startDate);
      const totalPaid = (booking.payments || [])
        .filter(p => p.status === 'SUCCESS' && p.method !== 'REFUND')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      if (now >= startDate) return 0;

      const daysUntilStart = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
      
      let refundPercentage;
      let policy;
      if (daysUntilStart > 30) {
        refundPercentage = 1.0;
        policy = '100% refund (more than 30 days before tour)';
      } else if (daysUntilStart >= 15) {
        refundPercentage = 0.75;
        policy = '75% refund (15-30 days before tour)';
      } else if (daysUntilStart >= 7) {
        refundPercentage = 0.50;
        policy = '50% refund (7-14 days before tour)';
      } else if (daysUntilStart >= 3) {
        refundPercentage = 0.25;
        policy = '25% refund (3-6 days before tour)';
      } else {
        refundPercentage = 0.10;
        policy = '10% refund (less than 3 days before tour)';
      }

      return {
        amount: Math.round(totalPaid * refundPercentage),
        percentage: refundPercentage * 100,
        policy,
        totalPaid
      };
    };

    const refundInfo = calculateRefundAmount();
    
    const confirmMessage = refundInfo.totalPaid > 0 
      ? `Are you sure you want to cancel this tour?\n\nRefund Policy: ${refundInfo.policy}\n\nYou paid: ${booking.currency || 'BDT'} ${refundInfo.totalPaid}\nYou will receive: ${booking.currency || 'BDT'} ${refundInfo.amount} (${refundInfo.percentage}%)\n\nThis action cannot be undone.`
      : 'Are you sure you want to cancel this tour? This action cannot be undone.';
    
    const confirmCancel = await confirmAction({ message: confirmMessage });
    if (!confirmCancel) return;

    const reason = prompt('Please provide a reason for cancellation (optional):') || 'Customer requested cancellation';
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
      notify.message('User not logged in');
      return;
    }

    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${booking._id || booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason })
      });

      const data = await res.json();
      
      if (data.success) {
        const successMessage = refundInfo.amount > 0 
          ? `Booking cancelled successfully!\n\nRefund amount: ${booking.currency || 'BDT'} ${refundInfo.amount}\nAn administrator will arrange and record the manual refund.`
          : 'Booking cancelled successfully!';
        notify.message(successMessage);
        if (data.booking) {
          onUpdate(data.booking);
        }
        onClose();
      } else {
        notify.message(data.message || 'Failed to cancel booking');
      }
    } catch (err) {
      console.error('Cancel error:', err);
      notify.message('Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const handleDateChangeRequest = async () => {
    const newDate = prompt('Please enter your preferred new start date (YYYY-MM-DD):');
    if (!newDate) return;

    const reason = prompt('Please provide a reason for date change request:') || 'Customer requested date change';
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
      notify.message('User not logged in');
      return;
    }

    setRequestingDateChange(true);
    try {
      const res = await fetch(`/api/bookings/${booking._id || booking.id}/request-date-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          requestedDate: newDate, 
          reason,
          currentStartDate: booking.startDate
        })
      });

      const data = await res.json();
      
      if (data.success) {
        notify.message('Date change request submitted successfully!\n\nYour request will be reviewed by our team and you will be notified within 24-48 hours.');
        if (data.booking) {
          onUpdate(data.booking);
        }
        setShowCancelOptions(false);
      } else {
        notify.message(data.message || 'Failed to submit date change request');
      }
    } catch (err) {
      console.error('Date change request error:', err);
      notify.message('Failed to submit request. Please try again.');
    } finally {
      setRequestingDateChange(false);
    }
  };

  const handleCancelWithRefund = async () => {
    setShowCancelOptions(false);
    await handleCancelTour();
  };

  const paidAmount = paymentTotals(booking).gross;
  const totalAmount = booking.finalAmount ?? booking.totalAmount ?? booking.amount ?? 0;
  const isFullyPaid = paidAmount >= totalAmount && totalAmount > 0;
  const bookingConfirmed = (booking.status || '').toString().toUpperCase() === 'CONFIRMED' || (booking.status || '').toString().toUpperCase() === 'COMPLETED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">Booking Details</h3>
            <p className="font-mono text-sm text-gray-600 dark:text-gray-300">{bookingLabel(booking)}</p>
          </div>
          <button onClick={onClose} className="text-gray-600">Close</button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Package</p>
            <p className="font-semibold">{booking.packageId?.title || booking.package?.title || booking.packageTitle || '—'}</p>

            <p className="mt-3 text-sm text-gray-500">Dates</p>
            <p className="font-semibold">{booking.startDate} → {booking.endDate}</p>

            <p className="mt-3 text-sm text-gray-500">Travelers</p>
            <p className="font-semibold">{booking.numTravelers || booking.travelers?.length || '-'}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Amount</p>
            <p className="font-semibold">{booking.currency || '$'}{booking.totalAmount || booking.amount || 0}</p>

            <p className="mt-3 text-sm text-gray-500">Booking status</p>
            <p className="font-semibold">{booking.status || 'PENDING'}</p>

            {booking.status === 'CANCELLED' && booking.cancellation && (
              <div className="mt-3">
                <p className="text-sm text-gray-500">Cancellation Details</p>
                <p className="text-sm text-gray-700">
                  {booking.cancellation.reason || 'No reason provided'}
                </p>
                {booking.cancellation.refundAmount > 0 && (
                  <p className="text-sm font-semibold text-green-600 mt-1">
                    Refund: {booking.currency || 'BDT'} {booking.cancellation.refundAmount}
                  </p>
                )}
                {booking.cancellation.refundAmount === 0 && (
                  <p className="text-sm text-gray-600 mt-1">No refund (tour already started or policy applied)</p>
                )}
              </div>
            )}

            {booking.status !== 'CANCELLED' && (
              <div className="mt-3">
                <p className="text-sm text-gray-500">Payment status</p>
                <p className="font-semibold">
                  {(() => {
                    const paid = (booking.payments || []).filter(p => p.status === 'SUCCESS' && p.method !== 'REFUND').reduce((s, p) => s + (p.amount || 0), 0);
                    const total = booking.finalAmount ?? booking.totalAmount ?? booking.amount ?? 0;
                    if (paid <= 0) return `Not paid (${booking.currency || ''}${0} of ${booking.currency || ''}${total})`;
                    if (paid < total) return `Partially paid (${booking.currency || ''}${paid} of ${booking.currency || ''}${total})`;
                    return `Paid in full (${booking.currency || ''}${paid})`;
                  })()}
                </p>
              </div>
            )}
          </div>
        </div>

        {booking.customizations && (
          <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
            <p className="font-semibold">Your preferences</p>
            <p className="mt-2 whitespace-pre-wrap">{booking.customizations}</p>
          </div>
        )}

        <div className="mt-6 flex space-x-3">
          {booking.status !== 'CANCELLED' && booking.status !== 'REFUNDED' && (
            <button 
              onClick={() => setShowInvoice(true)} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View Invoice
            </button>
          )}
          {booking.status !== 'CANCELLED' && booking.status !== 'REFUNDED' && !isFullyPaid && booking.status !== 'COMPLETED' && (
            <button onClick={() => setShowPayment(true)} className="px-4 py-2 bg-primary text-white rounded-lg">Add Payment</button>
          )}
          {isFullyPaid && booking.status !== 'CANCELLED' && booking.status !== 'REFUNDED' && (
            <div className="px-4 py-2 rounded-lg bg-green-50 text-green-700 font-semibold">Paid in full</div>
          )}
          {bookingConfirmed && !isFullyPaid && booking.status !== 'CANCELLED' && booking.status !== 'REFUNDED' && (
            <div className="px-4 py-2 rounded-lg bg-yellow-50 text-yellow-700 font-semibold">Booking {booking.status}</div>
          )}
          {(booking.status === 'CANCELLED' || booking.status === 'REFUNDED') && (
            <div className="px-4 py-2 rounded-lg bg-red-50 text-red-700 font-semibold">
              {booking.status === 'REFUNDED' ? 'Booking Cancelled - Refunded' : 'Booking Cancelled'}
            </div>
          )}
          {booking.status !== 'CANCELLED' && booking.status !== 'REFUNDED' && booking.status !== 'COMPLETED' && (
            <button 
              onClick={() => setShowCancelOptions(true)} 
              disabled={cancelling}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Cancel Booking
            </button>
          )}
        </div>

        {booking.payments && booking.payments.length > 0 && (
          <div className="mt-4 bg-gray-50 dark:bg-gray-900 p-4 rounded">
            <h4 className="font-semibold">Payments</h4>
            {paymentTotals(booking).pending > 0 && <p role="status" className="text-amber-700">Payment submitted — awaiting administrator verification.</p>}
            <ul className="text-sm text-gray-600 mt-2">
              {booking.payments.map((p, idx) => (
                <li key={idx} className="mb-1">{p.amount} {booking.currency || ''} — {p.method} — <span className="font-semibold">{p.status}</span></li>
              ))}
            </ul>
          </div>
        )}

        {showPayment && (
          <div className="mt-6">
            <PaymentForm booking={booking} onSuccess={handlePaymentSuccess} onCancel={() => setShowPayment(false)} />
          </div>
        )}

        <Invoice isOpen={showInvoice} onClose={() => setShowInvoice(false)} booking={booking} />
      </div>

      {/* Cancellation Options Modal */}
      {showCancelOptions && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Cancellation Options</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              We understand plans can change. Please choose how you'd like to proceed:
            </p>

            <div className="space-y-4">
              {/* Option 1: Cancel with Refund */}
              <button
                onClick={handleCancelWithRefund}
                disabled={cancelling}
                className="w-full p-4 border-2 border-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 text-red-500 text-2xl mr-3">
                    <LuBanknote aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                      {cancelling ? 'Processing...' : 'Cancel with Refund'}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Cancel your booking and receive a refund based on our cancellation policy.
                      Refund amount depends on how far in advance you cancel.
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-semibold flex items-center gap-1.5">
                      <LuTriangleAlert aria-hidden="true" className="text-red-500" /> This action cannot be undone
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 2: Request Date Change - Only available for PRIVATE and CUSTOM bookings */}
              {booking.bookingType !== 'GROUP' && (
                <button
                  onClick={handleDateChangeRequest}
                  disabled={requestingDateChange}
                  className="w-full p-4 border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 text-blue-500 text-2xl mr-3">
                      <LuCalendar aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                        {requestingDateChange ? 'Submitting...' : 'Request Date Change'}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Keep your booking and request to change your travel dates.
                        Subject to availability and approval.
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-semibold flex items-center gap-1">
                        <CheckIcon aria-hidden="true" className="inline h-4 w-4 align-[-2px]" /> No cancellation fees
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Info message for GROUP bookings */}
              {booking.bookingType === 'GROUP' && (
                <div className="w-full p-4 border-2 border-gray-300 bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 rounded-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 text-gray-400 text-2xl mr-3">ℹ️</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Group Tour - Fixed Schedule
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Group tours have fixed departure dates. To change dates, you would need to cancel this booking and book a different departure.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setShowCancelOptions(false)}
              className="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingDetailModal;
