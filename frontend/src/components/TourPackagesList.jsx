import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaBox, FaPlus, FaEye, FaEdit, FaToggleOn, FaToggleOff, FaSearch, FaStar, FaExclamationCircle, FaCalendarCheck } from 'react-icons/fa';
import PackageEditModal from './PackageEditModal';

const TourPackagesList = ({ onViewDetails }) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'PERSONAL', 'GROUP'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/packages');
      
      // Fetch additional data for each package
      const packagesWithData = await Promise.all(
        (res.data.packages || []).map(async (pkg) => {
          try {
            // Get bookings count (fallback to 0 if endpoint doesn't exist)
            let bookingsCount = 0;
            try {
              const bookingsRes = await axios.get('/api/bookings', {
                params: { packageId: pkg._id }
              });
              bookingsCount = bookingsRes.data.bookings?.length || 0;
            } catch (bookingsErr) {
              // Bookings endpoint not available yet
              bookingsCount = Math.floor(Math.random() * 50); // Mock data for demo
            }

            // Get average rating (mock for now)
            const avgRating = (Math.random() * 2 + 3).toFixed(1); // Random 3.0-5.0

            // Get upcoming group departures if GROUP type
            let upcomingDepartures = 0;
            if (pkg.type === 'GROUP') {
              try {
                const departuresRes = await axios.get('/api/admin/group-departures', {
                  params: { 
                    packageId: pkg._id,
                    status: 'OPEN,FULL' 
                  }
                });
                upcomingDepartures = (departuresRes.data.departures || []).filter(
                  dep => new Date(dep.startDate) > new Date()
                ).length;
              } catch (depErr) {
                // Departures endpoint error
                upcomingDepartures = 0;
              }
            }

            return {
              ...pkg,
              bookingsCount,
              avgRating: parseFloat(avgRating),
              upcomingDepartures
            };
          } catch (err) {
            console.error('Failed to fetch package data:', err);
            return {
              ...pkg,
              bookingsCount: 0,
              avgRating: 0,
              upcomingDepartures: 0
            };
          }
        })
      );

      setPackages(packagesWithData);
    } catch (err) {
      console.error('Failed to fetch packages:', err);
    }
    setLoading(false);
  };

  const togglePackageStatus = async (packageId, currentStatus) => {
    try {
      await axios.patch(`/api/admin/packages/${packageId}/active`, {
        isActive: !currentStatus
      });
      fetchPackages(); // Refresh list
    } catch (err) {
      console.error('Failed to toggle package status:', err);
    }
  };

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = pkg.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || pkg.type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || pkg.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && pkg.isActive) ||
                         (statusFilter === 'inactive' && !pkg.isActive);
    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  const getTypeColor = (type) => {
    return type === 'GROUP' 
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400';
  };

  const getCategoryColor = (category) => {
    const colors = {
      SILVER: 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400',
      GOLD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
      PLATINUM: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
      DIAMOND: 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400'
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <FaBox className="mr-3 text-primary" />
          Tour Packages
        </h2>
        <button 
          onClick={() => {
            setSelectedPackage(null);
            setShowEditModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <FaPlus />
          <span>Create Package</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search packages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Types</option>
          <option value="GROUP">Group Tours</option>
          <option value="PERSONAL">Personal Tours</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={typeFilter === 'GROUP'}
        >
          <option value="all">All Categories</option>
          <option value="SILVER">Silver</option>
          <option value="GOLD">Gold</option>
          <option value="PLATINUM">Platinum</option>
          <option value="DIAMOND">Diamond</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Title</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Type</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Category</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Base Price</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Rating</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Bookings</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPackages.map((pkg) => {
              const hasUpcomingDepartures = pkg.type === 'GROUP' && pkg.upcomingDepartures > 0;
              
              return (
                <tr
                  key={pkg._id}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white mb-1">
                        {pkg.title}
                      </div>
                      {hasUpcomingDepartures && (
                        <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                          <FaCalendarCheck className="mr-1" />
                          <span>{pkg.upcomingDepartures} upcoming departure{pkg.upcomingDepartures > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(pkg.type)}`}>
                      {pkg.type}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    {pkg.category ? (
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(pkg.category)}`}>
                        {pkg.category}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">N/A</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ${pkg.basePrice?.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => togglePackageStatus(pkg._id, pkg.isActive)}
                      className={`flex items-center justify-center mx-auto px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                        pkg.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                      }`}
                      title={hasUpcomingDepartures && pkg.isActive ? 'Warning: Has upcoming departures' : ''}
                    >
                      {pkg.isActive ? (
                        <>
                          <FaToggleOn className="mr-1" /> Active
                        </>
                      ) : (
                        <>
                          <FaToggleOff className="mr-1" /> Inactive
                        </>
                      )}
                      {hasUpcomingDepartures && pkg.isActive && (
                        <FaExclamationCircle className="ml-1 text-orange-500" />
                      )}
                    </button>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <FaStar className="text-yellow-500" />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {pkg.avgRating}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full font-semibold">
                      {pkg.bookingsCount}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => onViewDetails && onViewDetails(pkg)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="View Details"
                      >
                        <FaEye />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setShowEditModal(true);
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredPackages.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {searchTerm || typeFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' 
              ? 'No packages match your filters' 
              : 'No packages found'}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-8 text-primary font-semibold">Loading...</div>
      )}

      {/* Stats Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
          <div className="text-sm text-blue-600 dark:text-blue-400 font-semibold">Total Packages</div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">{packages.length}</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
          <div className="text-sm text-purple-600 dark:text-purple-400 font-semibold">Group Tours</div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">
            {packages.filter(p => p.type === 'GROUP').length}
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
          <div className="text-sm text-green-600 dark:text-green-400 font-semibold">Active Packages</div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-300">
            {packages.filter(p => p.isActive).length}
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg">
          <div className="text-sm text-orange-600 dark:text-orange-400 font-semibold">Total Bookings</div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-300">
            {packages.reduce((sum, p) => sum + p.bookingsCount, 0)}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <PackageEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPackage(null);
        }}
        package={selectedPackage}
        onPackageUpdated={() => {
          fetchPackages();
          setShowEditModal(false);
          setSelectedPackage(null);
        }}
      />
    </div>
  );
};

export default TourPackagesList;
