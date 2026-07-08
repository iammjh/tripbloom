import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FaList, FaExclamationTriangle, FaEye, FaEdit, FaTrash, FaPlus,
  FaCalendarAlt, FaUsers, FaUserTie, FaMapMarkerAlt, FaFilter,
  FaSearch, FaClock, FaCheckCircle, FaTimesCircle, FaTh, FaTable
} from 'react-icons/fa';

const GroupDeparturesList = ({ onViewDetails, onCreateDeparture, onEditDeparture, onDeleteDeparture }) => {
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ status: '', packageId: '' });
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDepartures();
  }, [filter]);

  const fetchDepartures = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/group-departures', { params: filter });
      // Sort departures by upcoming close event date (startDate ascending)
      const sortedDepartures = (res.data.departures || []).sort((a, b) => {
        return new Date(a.startDate) - new Date(b.startDate);
      });
      setDepartures(sortedDepartures);
    } catch (err) {
      console.error('Failed to fetch departures:', err);
    }
    setLoading(false);
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

  const getCapacityBarColor = (bookedSeats, totalSeats) => {
    const percentage = (bookedSeats / totalSeats) * 100;
    if (bookedSeats > totalSeats) return 'bg-red-500'; // Overbooking
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const isStartingSoon = (startDate) => {
    const start = new Date(startDate);
    const now = new Date();
    const hoursUntilStart = (start - now) / (1000 * 60 * 60);
    return hoursUntilStart < 24 && hoursUntilStart > 0;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getDaysUntilStart = (startDate) => {
    const start = new Date(startDate);
    const now = new Date();
    const days = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    return days;
  };

  const filteredDepartures = departures.filter(dep => {
    const matchesSearch = !searchTerm || 
      dep.packageId?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 border border-gray-700 dark:border-gray-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold text-white dark:text-white flex items-center">
            <FaCalendarAlt className="mr-3 text-blue-400 dark:text-blue-400" />
            Group Departures
          </h2>
          <p className="text-gray-400 dark:text-gray-400 mt-1">
            Manage upcoming tour group departures
          </p>
        </div>
        <button 
          onClick={() => onCreateDeparture && onCreateDeparture()}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all font-semibold"
        >
          <FaPlus />
          <span>Create New Departure</span>
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by package name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="OPEN">Open</option>
          <option value="FULL">Full</option>
          <option value="CLOSED">Closed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'cards'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
            title="Card View"
          >
            <FaTh />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
            title="Table View"
          >
            <FaTable />
          </button>
        </div>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepartures.map((departure) => {
            const hasNoOperator = isStartingSoon(departure.startDate) && (!departure.operators || departure.operators.length === 0);
            const isOverbooked = departure.bookedSeats > departure.totalSeats;
            const daysUntilStart = getDaysUntilStart(departure.startDate);
            const capacityPercentage = (departure.bookedSeats / departure.totalSeats) * 100;
            
            return (
              <div
                key={departure._id}
                className={`bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1 border ${
                  hasNoOperator 
                    ? 'border-orange-300 dark:border-orange-700' 
                    : 'border-gray-200 dark:border-gray-600'
                } overflow-hidden`}
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">
                        {departure.packageId?.title || 'Package Name'}
                      </h3>
                      <div className="flex items-center text-blue-100 text-sm">
                        <FaMapMarkerAlt className="mr-1" />
                        <span>{departure.packageId?.destinations?.[0]?.name || 'Destination'}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(departure.status)} bg-white`}>
                      {departure.status}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-4">
                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">Start Date</div>
                      <div className="flex items-center text-gray-900 dark:text-white font-bold">
                        <FaCalendarAlt className="mr-2 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm">{formatDate(departure.startDate)}</span>
                      </div>
                      {daysUntilStart >= 0 && daysUntilStart <= 7 && (
                        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center">
                          <FaClock className="mr-1" />
                          {daysUntilStart === 0 ? 'Today!' : `${daysUntilStart} days`}
                        </div>
                      )}
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                      <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-1">End Date</div>
                      <div className="flex items-center text-gray-900 dark:text-white font-bold">
                        <FaCalendarAlt className="mr-2 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm">{formatDate(departure.endDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Capacity */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                        <FaUsers className="mr-2 text-green-600 dark:text-green-400" />
                        Capacity
                      </div>
                      <span className={`text-sm font-bold ${isOverbooked ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                        {departure.bookedSeats}/{departure.totalSeats}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getCapacityBarColor(departure.bookedSeats, departure.totalSeats)} transition-all rounded-full`}
                        style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {capacityPercentage.toFixed(0)}% filled
                      </span>
                      {isOverbooked && (
                        <span className="text-xs text-red-600 font-semibold flex items-center">
                          <FaExclamationTriangle className="mr-1" />
                          Overbooked!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Operators */}
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                    <div className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      <FaUserTie className="mr-2 text-orange-600 dark:text-orange-400" />
                      Assigned Operators
                    </div>
                    {departure.operators && departure.operators.length > 0 ? (
                      <div className="space-y-1">
                        {departure.operators.slice(0, 2).map((op, idx) => (
                          <div key={idx} className="text-sm text-gray-900 dark:text-white flex items-center">
                            <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2">
                              {op.operatorId?.fullName?.charAt(0) || 'O'}
                            </div>
                            {op.operatorId?.fullName || 'Operator'}
                          </div>
                        ))}
                        {departure.operators.length > 2 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 ml-8">
                            +{departure.operators.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`text-sm flex items-center ${hasNoOperator ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                        <FaExclamationTriangle className="mr-2" />
                        No operator assigned
                      </div>
                    )}
                  </div>

                  {/* Warnings */}
                  {(hasNoOperator || isOverbooked) && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <div className="flex items-start text-red-700 dark:text-red-400">
                        <FaExclamationTriangle className="mr-2 mt-0.5" />
                        <div className="text-xs">
                          {hasNoOperator && <div>Departure starts soon without operator!</div>}
                          {isOverbooked && <div>Departure is overbooked!</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer - Actions */}
                <div className="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-4">
                  <div className="flex items-center justify-between space-x-2">
                    <button
                      onClick={() => onViewDetails && onViewDetails(departure)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                    >
                      <FaEye />
                      <span>View</span>
                    </button>
                    <button 
                      onClick={() => onEditDeparture && onEditDeparture(departure)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Edit Departure"
                    >
                      <FaEdit />
                    </button>
                    <button 
                      onClick={() => onDeleteDeparture && onDeleteDeparture(departure)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      title="Delete Departure"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Package</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Start Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">End Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Capacity</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Operators</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartures.map((departure) => {
                const hasNoOperator = isStartingSoon(departure.startDate) && (!departure.operators || departure.operators.length === 0);
                const isOverbooked = departure.bookedSeats > departure.totalSeats;
                
                return (
                  <tr
                    key={departure._id}
                    className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      hasNoOperator ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {departure.packageId?.title || 'N/A'}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                      {formatDate(departure.startDate)}
                    </td>
                    <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                      {formatDate(departure.endDate)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getCapacityBarColor(departure.bookedSeats, departure.totalSeats)} transition-all`}
                              style={{ width: `${Math.min((departure.bookedSeats / departure.totalSeats) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <span className={`text-sm font-semibold ${isOverbooked ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                            {departure.bookedSeats}/{departure.totalSeats}
                          </span>
                        </div>
                        {isOverbooked && (
                          <div className="flex items-center text-xs text-red-600">
                            <FaExclamationTriangle className="mr-1" />
                            Overbooked
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(departure.status)}`}>
                        {departure.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        {departure.operators && departure.operators.length > 0 ? (
                          <div className="flex flex-col space-y-1">
                            {departure.operators.slice(0, 2).map((op, idx) => (
                              <div key={idx} className="text-gray-700 dark:text-gray-300">
                                {op.operatorId?.fullName || 'Operator'}
                              </div>
                            ))}
                            {departure.operators.length > 2 && (
                              <div className="text-gray-500 text-xs">+{departure.operators.length - 2} more</div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center text-orange-600">
                            {hasNoOperator && <FaExclamationTriangle className="mr-1" />}
                            No operator
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => onViewDetails && onViewDetails(departure)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="View Details"
                        >
                          <FaEye />
                        </button>
                        <button
                          onClick={() => onEditDeparture && onEditDeparture(departure)}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => onDeleteDeparture && onDeleteDeparture(departure)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {filteredDepartures.length === 0 && !loading && (
        <div className="text-center py-16">
          <FaCalendarAlt className="mx-auto text-6xl text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
            No Departures Found
          </h3>
          <p className="text-gray-500 dark:text-gray-500 mb-6">
            {searchTerm || filter.status 
              ? 'Try adjusting your filters'
              : 'Create your first group departure to get started'}
          </p>
          <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg transition-all font-semibold">
            <FaPlus className="inline mr-2" />
            Create First Departure
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-primary font-semibold">Loading...</div>
      )}
    </div>
  );
};

export default GroupDeparturesList;
