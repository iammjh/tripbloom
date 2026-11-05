import { LuCalendar, LuCircleCheck, LuCircleX, LuMapPin, LuTriangleAlert, LuUsers, LuX } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';


const DepartureDetailModal = ({ isOpen, onClose, departure }) => {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOption, setCancelOption] = useState('keep'); // 'keep' or 'cancel'
  const [refundAmount, setRefundAmount] = useState(0);
  const [bookings, setBookings] = useState([]);
  const [bookingsError, setBookingsError] = useState(false);

  // Real bookings on this departure (hooks stay above the early return)
  useEffect(() => {
    if (!isOpen || !departure?._id) return;
    axios.get('/api/bookings', { params: { groupDepartureId: departure._id } })
      .then(res => { setBookings(res.data.bookings || []); setBookingsError(false); })
      .catch(() => { setBookings([]); setBookingsError(true); });
  }, [isOpen, departure?._id]);

  if (!isOpen || !departure) return null;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      OPEN: 'text-green-600 bg-green-100 dark:bg-green-900/20',
      FULL: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20',
      CANCELLED: 'text-red-600 bg-red-100 dark:bg-red-900/20',
      CLOSED: 'text-gray-600 bg-gray-100 dark:bg-gray-900/20'
    };
    return colors[status] || 'text-blue-600 bg-blue-100';
  };

  const handleCancelDeparture = async () => {
    try {
      await axios.patch(`/api/admin/group-departures/${departure._id}/status`, {
        status: 'CANCELLED'
      });
      
      if (cancelOption === 'cancel') {
        // TODO: Cancel all bookings and trigger refunds
        console.log('Cancelling all bookings with refund:', refundAmount);
      }
      
      setShowCancelModal(false);
      onClose();
      // Refresh data
    } catch (err) {
      console.error('Failed to cancel departure:', err);
    }
  };

  const totalSeats = departure.totalSeats || 40;
  const bookedSeats = departure.bookedSeats || 0;
  const availableSeats = totalSeats - bookedSeats;

  const modalContent = (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 99999 }}>
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        ></div>
        
        {/* Modal Content */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-scale-in" style={{ zIndex: 99999 }}>
          {/* Close Button */}
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10"
          >
            <LuX aria-hidden="true" size={24} />
          </button>

          {/* Header */}
          <div className="bg-gradient-to-r from-primary via-green-500 to-emerald-500 p-8 text-white">
            <h2 className="text-3xl font-bold mb-2">Departure Details</h2>
            <p className="text-green-50">{departure.packageId?.title || 'Tour Package'}</p>
          </div>

          {/* Content */}
          <div className="p-8 max-h-[70vh] overflow-y-auto">
            {/* Summary Section */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <LuCalendar aria-hidden="true" className="text-primary text-2xl" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Start Date</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{formatDate(departure.startDate)}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <LuCalendar aria-hidden="true" className="text-primary text-2xl" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">End Date</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{formatDate(departure.endDate)}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <LuUsers aria-hidden="true" className="text-primary text-2xl" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Capacity</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{bookedSeats} / {totalSeats} seats</div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Status</div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(departure.status)}`}>
                    {departure.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Seat Map */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Seat Map</h3>
              <div className="grid grid-cols-10 gap-2">
                {[...Array(totalSeats)].map((_, idx) => {
                  const isBooked = idx < bookedSeats;
                  return (
                    <div
                      key={idx}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs font-semibold ${
                        isBooked 
                          ? 'bg-red-500 text-white' 
                          : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      }`}
                    >
                      {idx + 1}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center space-x-6 mt-4 text-sm">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-100 dark:bg-green-900/20 rounded mr-2"></div>
                  <span className="text-gray-700 dark:text-gray-300">Available ({availableSeats})</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                  <span className="text-gray-700 dark:text-gray-300">Booked ({bookedSeats})</span>
                </div>
              </div>
            </div>

            {/* Assigned Operators */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Assigned Operators</h3>
              {departure.operators && departure.operators.length > 0 ? (
                <div className="space-y-3">
                  {departure.operators.map((op, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {op.operatorId?.fullName || 'Operator'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {op.operatorId?.email || 'N/A'}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Assigned {new Date(op.assignedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center p-8 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg text-yellow-700 dark:text-yellow-400">
                  <LuTriangleAlert aria-hidden="true" className="mr-2" />
                  No operators assigned
                </div>
              )}
            </div>

            {/* Bookings */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Bookings</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Seats</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingsError && (
                      <tr><td colSpan={4} className="py-3 px-4 text-sm text-red-600">Bookings could not be loaded.</td></tr>
                    )}
                    {!bookingsError && bookings.length === 0 && (
                      <tr><td colSpan={4} className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">No bookings on this departure yet.</td></tr>
                    )}
                    {bookings.map((booking) => (
                      <tr key={booking._id} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="py-3 px-4 text-gray-900 dark:text-white">{booking.customerId?.fullName || 'Customer'}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{booking.numTravelers}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">BDT {Number(booking.finalAmount || 0).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-4">
              {departure.status !== 'CANCELLED' && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  Cancel Departure
                </button>
              )}
              <button
                aria-label="Close"
                onClick={onClose}
                className="px-6 py-3 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100000 }}>
          <div className="fixed inset-0 bg-black/80" onClick={() => setShowCancelModal(false)}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Cancel Departure</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              What would you like to do with the existing bookings?
            </p>
            
            <div className="space-y-3 mb-6">
              <label className="flex items-center p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  name="cancelOption"
                  value="keep"
                  checked={cancelOption === 'keep'}
                  onChange={(e) => setCancelOption(e.target.value)}
                  className="mr-3"
                />
                <span className="text-gray-900 dark:text-white">Keep bookings as pending</span>
              </label>
              
              <label className="flex items-center p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  name="cancelOption"
                  value="cancel"
                  checked={cancelOption === 'cancel'}
                  onChange={(e) => setCancelOption(e.target.value)}
                  className="mr-3"
                />
                <span className="text-gray-900 dark:text-white">Cancel all bookings & trigger refunds</span>
              </label>
            </div>

            {cancelOption === 'cancel' && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Refund Amount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter refund percentage"
                />
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleCancelDeparture}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Confirm Cancel
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors font-semibold"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default DepartureDetailModal;
