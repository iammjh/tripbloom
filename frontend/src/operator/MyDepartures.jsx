import { LuBus, LuCalendar, LuCircleAlert, LuCircleCheck, LuClock, LuFilter, LuSearch, LuUsers } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';

import DepartureDetailPage from './DepartureDetailPage';

const MyDepartures = () => {
  const operatorId = localStorage.getItem('userId');
  const [departures, setDepartures] = useState([]);
  const [filteredDepartures, setFilteredDepartures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    fetchDepartures();
  }, [operatorId]);

  useEffect(() => {
    applyFilters();
  }, [departures, searchTerm, statusFilter, dateRange]);

  const fetchDepartures = async () => {
    try {
      const res = await fetch(`/api/operator/${operatorId}/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDepartures(data.groupDepartures || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching departures:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...departures];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(dep => 
        dep.packageId?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dep.packageId?.destination?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'SCHEDULED') {
        filtered = filtered.filter(dep => dep.status === 'OPEN' && new Date(dep.startDate) > new Date());
      } else if (statusFilter === 'IN_PROGRESS') {
        const now = new Date();
        filtered = filtered.filter(dep => {
          const start = new Date(dep.startDate);
          const end = new Date(dep.endDate);
          return start <= now && now <= end;
        });
      } else if (statusFilter === 'COMPLETED') {
        filtered = filtered.filter(dep => new Date(dep.endDate) < new Date());
      } else {
        filtered = filtered.filter(dep => dep.status === statusFilter);
      }
    }

    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(dep => new Date(dep.startDate) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      filtered = filtered.filter(dep => new Date(dep.endDate) <= new Date(dateRange.end));
    }

    setFilteredDepartures(filtered);
  };

  const getStatusInfo = (dep) => {
    const now = new Date();
    const start = new Date(dep.startDate);
    const end = new Date(dep.endDate);

    if (dep.status === 'CANCELLED') {
      return { label: 'CANCELLED', color: 'red', icon: LuCircleAlert };
    }
    if (start <= now && now <= end) {
      return { label: 'IN PROGRESS', color: 'green', icon: LuClock };
    }
    if (end < now) {
      return { label: 'COMPLETED', color: 'gray', icon: LuCircleCheck };
    }
    if (dep.bookedSeats >= dep.totalSeats) {
      return { label: 'FULL', color: 'purple', icon: LuUsers };
    }
    if (dep.status === 'OPEN') {
      return { label: 'SCHEDULED', color: 'blue', icon: LuCalendar };
    }
    return { label: dep.status, color: 'gray', icon: LuCalendar };
  };

  const hasWarning = (dep) => {
    const warnings = [];
    
    // Check if overbooking
    if (dep.bookedSeats > dep.totalSeats) {
      warnings.push('OVERBOOKED');
    }
    
    // Within 24 hours of departure with no itinerary days recorded yet
    const hoursUntil = (new Date(dep.startDate) - new Date()) / (1000 * 60 * 60);
    const hasItinerary = Array.isArray(dep.itinerary) && dep.itinerary.some(day => Array.isArray(day.stops) && day.stops.length > 0);
    if (hoursUntil > 0 && hoursUntil < 24 && !hasItinerary) {
      warnings.push('ITINERARY PENDING');
    }
    
    // Check if multi-operator
    if (dep.operators && dep.operators.length > 1) {
      warnings.push('CO-GUIDE');
    }
    
    return warnings;
  };

  const getTourType = (dep) => {
    if (!dep.packageId) return 'Unknown';
    const duration = Math.ceil((new Date(dep.endDate) - new Date(dep.startDate)) / (1000 * 60 * 60 * 24));
    return duration <= 1 ? 'Day Tour' : `${duration}-Day Tour`;
  };

  if (selectedDeparture) {
    return (
      <DepartureDetailPage 
        departure={selectedDeparture} 
        onBack={() => setSelectedDeparture(null)} 
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading departures...</p>
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
            <LuBus aria-hidden="true" className="mr-3 text-orange-600" />
            My Departures
          </h1>
          <span className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full font-semibold text-lg">
            {filteredDepartures.length} total
          </span>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <LuSearch aria-hidden="true" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tours..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="ALL">All Status</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Date From */}
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Start Date"
          />

          {/* Date To */}
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="End Date"
          />
        </div>
      </div>

      {/* Departures Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Tour Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Start Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  End Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Seats
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
              {filteredDepartures.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <LuBus aria-hidden="true" className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 text-lg">No departures found</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                filteredDepartures.map((dep, idx) => {
                  const statusInfo = getStatusInfo(dep);
                  const warnings = hasWarning(dep);
                  const fillPercent = (dep.bookedSeats / dep.totalSeats) * 100;
                  
                  return (
                    <tr 
                      key={idx} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        warnings.includes('OVERBOOKED') ? 'bg-red-50 dark:bg-red-900/20' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {dep.packageId?.title || 'Untitled Tour'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {dep.packageId?.destination || 'No destination'}
                        </div>
                        {warnings.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {warnings.map((warn, i) => (
                              <span 
                                key={i}
                                className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                  warn === 'OVERBOOKED' ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' :
                                  warn === 'ITINERARY PENDING' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                                  'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                                }`}
                              >
                                {warn}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Show 'You are in a tour' if current operator is assigned and tour is active */}
                        {dep.operators && dep.operators.some(op => (op.operatorId?._id || op.operatorId)?.toString() === operatorId) &&
                          (new Date(dep.startDate) <= new Date() && new Date() <= new Date(dep.endDate)) && (
                          <div className="mt-2 inline-block px-3 py-1 rounded-full bg-green-600 text-white text-sm font-semibold">
                            You are in a tour
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {getTourType(dep)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div>{new Date(dep.startDate).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(dep.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div>{new Date(dep.endDate).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(dep.endDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 max-w-[120px]">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {dep.bookedSeats}/{dep.totalSeats}
                              </span>
                              <span className="text-gray-500">{fillPercent.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full ${
                                  warnings.includes('OVERBOOKED') ? 'bg-red-500' :
                                  fillPercent >= 90 ? 'bg-green-500' :
                                  fillPercent >= 50 ? 'bg-blue-500' :
                                  'bg-orange-500'
                                }`}
                                style={{ width: `${Math.min(fillPercent, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-${statusInfo.color}-100 dark:bg-${statusInfo.color}-900/30 text-${statusInfo.color}-800 dark:text-${statusInfo.color}-300`}>
                          <statusInfo.icon className="mr-1" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setSelectedDeparture(dep)}
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
    </div>
  );
};

export default MyDepartures;
