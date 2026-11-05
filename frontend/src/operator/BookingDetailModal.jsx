import { LuCalendar, LuDollarSign, LuMail, LuMap, LuPhone, LuSave, LuTriangleAlert, LuUser, LuUsers, LuX } from 'react-icons/lu';
import { notify } from '../utils/notifyStore.js';
import { paymentTotals } from '../utils/paymentAccounting';
import React, { useState } from 'react';

import { saveOperatorNotes } from '../api/bookingOperations';

const BookingDetailModal = ({ booking, onClose, onUpdateNotes }) => {
  const [operatorNotes, setOperatorNotes] = useState(booking.operatorNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const getTotalPaid = () => {
    return (booking.payments || [])
      .filter(p => p.status === 'SUCCESS' && p.method !== 'REFUND')
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const remaining = paymentTotals(booking).remaining;

  const handleSaveNotes = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      const saved = await saveOperatorNotes(booking._id, operatorNotes);
      setOperatorNotes(saved.operatorNotes);
      onUpdateNotes(saved.operatorNotes);
      notify.message('Notes saved successfully!');
    } catch (error) {
      setSaveError(error.message || 'Could not save notes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const wasCancelledAfterStart = booking.cancellation?.isCancelled && 
    new Date(booking.cancellation.cancelledAt) > new Date(booking.startDate);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">Booking Details</h2>
              <p className="text-orange-100">ID: {booking._id}</p>
            </div>
            <button 
              aria-label="Close" 
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <LuX aria-hidden="true" className="text-2xl" />
            </button>
          </div>
        </div>

        {/* Warning if cancelled after start */}
        {wasCancelledAfterStart && (
          <div className="mx-6 mt-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded">
            <div className="flex items-start">
              <LuTriangleAlert aria-hidden="true" className="text-red-600 mt-1 mr-3" />
              <div>
                <h4 className="font-bold text-red-800 dark:text-red-300">Booking Cancelled After Tour Start</h4>
                <p className="text-sm text-red-700 dark:text-red-400">
                  This booking was cancelled after the tour started. No modifications allowed.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Customer Details */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <LuUser aria-hidden="true" className="mr-3 text-orange-600" />
              Customer Information
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                // Resolve customer display values from possible shapes
                const cust = booking.customerId || booking.customer || {};
                const customerName = cust?.fullName || cust?.name || booking.customerName || (typeof cust === 'string' ? cust : null) || 'Customer';
                const customerEmail = cust?.email || booking.customerEmail || '';
                const customerPhone = cust?.phone || booking.customerPhone || '';

                return (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Name</label>
                      <p className="text-gray-900 dark:text-white font-semibold">{customerName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Email</label>
                      <p className="text-gray-900 dark:text-white">{customerEmail}</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Phone</label>
                      <p className="text-gray-900 dark:text-white">{customerPhone}</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Booking Type</label>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        booking.bookingType === 'GROUP'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                      }`}>
                        {booking.bookingType}
                      </span>
                    </div>
                  </>
                );
              })()}
              
            </div>
          </div>

          {/* Package & Dates */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <LuMap aria-hidden="true" className="mr-3 text-orange-600" />
              Package & Travel Details
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Package</label>
                <p className="text-gray-900 dark:text-white font-semibold">{booking.packageId?.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{booking.packageId?.destination}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Tour Dates</label>
                <p className="text-gray-900 dark:text-white">
                  {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                </p>
              </div>
              {booking.bookingType === 'GROUP' && booking.groupDepartureId && (
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Group Departure</label>
                  <button className="mt-1 text-orange-600 hover:text-orange-700 font-semibold">
                    View Departure Details →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Travelers List */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <LuUsers aria-hidden="true" className="mr-3 text-orange-600" />
              Travelers ({booking.numTravelers})
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-gray-600">
                    <th className="text-left py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Age</th>
                    <th className="text-left py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.travelers?.map((traveler, idx) => (
                    <tr key={idx} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                      <td className="py-2 text-gray-900 dark:text-white">{traveler.fullName}</td>
                      <td className="py-2 text-gray-900 dark:text-white">{traveler.age}</td>
                      <td className="py-2 text-gray-900 dark:text-white">{traveler.phone || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summary (Read-only) */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <LuDollarSign aria-hidden="true" className="mr-3 text-orange-600" />
              Payment Summary (Read-only)
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Total Amount</label>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">৳{booking.totalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Total Paid</label>
                  <p className="text-2xl font-bold text-green-600">৳{getTotalPaid().toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Remaining</label>
                  <p className={`text-2xl font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ৳{remaining.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Payment History */}
              {booking.payments && booking.payments.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Payment History</h4>
                  <div className="space-y-2">
                    {booking.payments.map((payment, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg">
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-white">৳{payment.amount.toLocaleString()}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">via {payment.method}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {payment.paidAt && (
                            <span className="text-xs text-gray-500">{new Date(payment.paidAt).toLocaleDateString()}</span>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            payment.status === 'SUCCESS' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            payment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  ℹ️ <strong>Note:</strong> You cannot change price or payment status. Contact admin for payment modifications.
                </p>
              </div>
            </div>
          </div>

          {booking.customizations && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Customer preferences</h3>
              <p className="mt-2 whitespace-pre-wrap text-gray-700 dark:text-gray-300">{booking.customizations}</p>
            </div>
          )}

          {/* Operator Notes */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <LuSave aria-hidden="true" className="mr-3 text-orange-600" />
              Operator Notes
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <textarea
                value={operatorNotes}
                onChange={(e) => setOperatorNotes(e.target.value)}
                placeholder="Add notes about this booking (e.g., special requests, dietary requirements, etc.)"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                rows="4"
                maxLength={5000}
                disabled={wasCancelledAfterStart}
              />
              {saveError && <p role="alert" className="mt-2 text-sm text-red-600">{saveError}</p>}
              <div className="mt-3 flex justify-between items-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Example: "Customer requested vegetarian meals for all travelers"
                </p>
                <button 
                  onClick={handleSaveNotes}
                  disabled={isSaving || wasCancelledAfterStart}
                  className="flex items-center px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LuSave aria-hidden="true" className="mr-2" />
                  {isSaving ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>

          {/* Status & Metadata */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Booking Status</h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Current Status</label>
                <p className={`inline-block px-4 py-2 mt-1 rounded-full font-semibold ${
                  booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                  booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                  booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {booking.status}
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Booked On</label>
                <p className="text-gray-900 dark:text-white">{new Date(booking.createdAt).toLocaleString()}</p>
              </div>
              {booking.cancellation?.isCancelled && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Cancellation Reason</label>
                    <p className="text-gray-900 dark:text-white">{booking.cancellation.reason || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Refund Amount</label>
                    <p className="text-gray-900 dark:text-white">৳{booking.cancellation.refundAmount?.toLocaleString() || 0}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-100 dark:bg-gray-900 p-6 rounded-b-2xl flex justify-end gap-3">
          <button 
            aria-label="Close" 
            onClick={onClose}
            className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailModal;
