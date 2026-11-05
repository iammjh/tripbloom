import { LuBook, LuCalendar, LuCircleCheck, LuCircleX, LuClock, LuDollarSign, LuFilter, LuSearch, LuUsers } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';

import BookingDetailModal from './BookingDetailModal';

const MyBookings = () => {
  const operatorId = localStorage.getItem('userId');
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    fetchBookings();
  }, [operatorId]);

  useEffect(() => {
    applyFilters();
  }, [bookings, searchTerm, typeFilter, statusFilter, dateRange]);

  const fetchBookings = async () => {
    try {
      // First get operator's departures
      const deptRes = await fetch(`/api/operator/${operatorId}/dashboard`);
      if (!deptRes.ok) throw new Error('Failed to fetch departures');
      const deptData = await deptRes.json();
      // Fetch bookings from backend and filter to operator's departures or assignedOperator
      const bookingsRes = await fetch('/api/bookings');
      if (!bookingsRes.ok) throw new Error('Failed to fetch bookings');
      const bookingsData = await bookingsRes.json();
      const allBookings = bookingsData.bookings || [];

      const departureIds = (deptData.groupDepartures || []).map(d => d._id?.toString());

      // Filter bookings: only group bookings (by bookingType or groupDepartureId) that are for this operator
      const operatorBookings = allBookings.filter(b => {
        const assignedOp = b.assignedOperator?._id || b.assignedOperator;
        const groupId = b.groupDepartureId?._id || b.groupDepartureId;
        const isGroup = (b.bookingType === 'GROUP') || (groupId);
        if (!isGroup) return false;
        const groupMatch = groupId && departureIds.includes(groupId.toString());
        const assignedMatch = assignedOp && assignedOp.toString() === operatorId;
        return groupMatch || assignedMatch;
      });

      // Build package -> bookings map (all bookings) to compute sequence numbers
      const byPackage = {};
      allBookings.forEach(b => {
        const pkgId = b.packageId?._id || b.packageId;
        if (!pkgId) return;
        const key = pkgId.toString();
        byPackage[key] = byPackage[key] || [];
        byPackage[key].push(b);
      });

      // Sort each package list by createdAt ascending so sequence is deterministic
      Object.keys(byPackage).forEach(k => {
        byPackage[k].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });

      // Attach displayId to operator bookings
      const withDisplay = operatorBookings.map(b => {
        const pkg = b.packageId || {};
        const pkgId = pkg._id || pkg;
        const list = pkgId ? byPackage[pkgId.toString()] || [] : [];
        const index = list.findIndex(x => (x._id || x) .toString() === (b._id || b).toString());
        const seq = index >= 0 ? index + 1 : 1;

        // Prefer explicit package code if available
        const pkgCode = pkg.packageCode || pkg.code || pkg.shortCode || pkg.packageIdCode;
        let prefix;
        if (pkgCode) {
          prefix = pkgCode.toString().toUpperCase();
        } else if (pkg.title) {
          const words = pkg.title.split(/\s+/).filter(Boolean);
          const a = (words[0] || '').charAt(0) || 'X';
          const b = (words[1] || words[0] || '').charAt(0) || 'X';
          prefix = (a + b).toUpperCase() + '000';
        } else {
          prefix = 'TB000';
        }

        return { ...b, _displayId: `${prefix}${seq}` };
      });

      setBookings(withDisplay);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...bookings];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(booking => 
        booking._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.customerId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.packageId?.title?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(booking => booking.bookingType === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(booking => booking.status === statusFilter);
    }

    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(booking => new Date(booking.startDate) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      filtered = filtered.filter(booking => new Date(booking.endDate) <= new Date(dateRange.end));
    }

    setFilteredBookings(filtered);
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', icon: LuClock },
      CONFIRMED: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', icon: LuCircleCheck },
      CANCELLED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', icon: LuCircleX },
      COMPLETED: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', icon: LuCircleCheck }
    };
    return badges[status] || badges.PENDING;
  };

  const getTotalPaid = (payments) => {
    return (payments || [])
      .filter(p => p.status === 'SUCCESS' && p.method !== 'REFUND')
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const getPaymentStatus = (booking) => {
    const totalPaid = getTotalPaid(booking.payments);
    const remaining = (booking.finalAmount ?? booking.totalAmount) - totalPaid;
    
    if (remaining <= 0) return { label: 'Fully Paid', color: 'green' };
    if (totalPaid > 0) return { label: 'Partial', color: 'yellow' };
    return { label: 'Pending', color: 'red' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <LuBook aria-hidden="true" className="mr-3 text-orange-600" />
            My Bookings
          </h1>
          <span className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full font-semibold text-lg">
            {filteredBookings.length} bookings
          </span>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <LuSearch aria-hidden="true" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search bookings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="ALL">All Types</option>
            <option value="GROUP">Group</option>
            <option value="PRIVATE">Personal/Private</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </select>

          {/* Date From */}
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />

          {/* Date To */}
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Booking ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Package
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Travelers
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <LuBook aria-hidden="true" className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 text-lg">No bookings found</p>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => {
                  const statusBadge = getStatusBadge(booking.status);
                  const paymentStatus = getPaymentStatus(booking);
                  
                  return (
                    <tr key={booking._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">{booking._displayId || booking._id}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(booking.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {(
                            booking.customerId?.fullName ||
                            booking.customerId?.name ||
                            booking.customerName ||
                            booking.customer?.fullName ||
                            booking.customer ||
                            (typeof booking.customerId === 'string' ? booking.customerId : null)
                          ) || 'Customer'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {booking.customerId?.phone || booking.customer?.phone || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {booking.packageId?.title}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {booking.packageId?.destination}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          booking.bookingType === 'GROUP' 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}>
                          {booking.bookingType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div>{new Date(booking.startDate).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">to</div>
                        <div>{new Date(booking.endDate).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-gray-700 dark:text-gray-300">
                          <LuUsers aria-hidden="true" className="mr-2 text-orange-600" />
                          <span className="font-semibold">{booking.numTravelers}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            ৳{getTotalPaid(booking.payments).toLocaleString()} / ৳{(booking.finalAmount ?? booking.totalAmount).toLocaleString()}
                          </div>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-${paymentStatus.color}-100 text-${paymentStatus.color}-800 dark:bg-${paymentStatus.color}-900/30 dark:text-${paymentStatus.color}-300`}>
                            {paymentStatus.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.bg} ${statusBadge.text}`}>
                          <statusBadge.icon className="mr-1" />
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setSelectedBooking(booking)}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-sm transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal 
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdateNotes={(notes) => {
            setBookings(bookings.map(b => 
              b._id === selectedBooking._id ? { ...b, operatorNotes: notes } : b
            ));
          }}
        />
      )}
    </div>
  );
};

export default MyBookings;
