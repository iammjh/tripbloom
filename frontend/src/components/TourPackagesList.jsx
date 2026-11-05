import { LuCalendarCheck, LuCircleAlert, LuEye, LuPackage, LuPencil, LuPlus, LuSearch, LuStar, LuToggleLeft, LuToggleRight } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

import PackageEditModal from './PackageEditModal';
import { thClass, tdClass } from './admin/AdminPrimitives.jsx';

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
            // Bookings for this package; null when the request fails so the table shows a dash instead of a guess
            let bookingsCount = null;
            try {
              const bookingsRes = await axios.get('/api/bookings', {
                params: { packageId: pkg._id }
              });
              bookingsCount = bookingsRes.data.bookings?.length || 0;
            } catch (bookingsErr) {
              bookingsCount = null;
            }

            // Average rating from approved reviews; null when there are none or the request fails
            let avgRating = null;
            try {
              const ratingRes = await axios.get(`/api/packages/${pkg._id}/rating-stats`);
              avgRating = ratingRes.data.stats?.totalReviews ? ratingRes.data.stats.averageRating : null;
            } catch (ratingErr) {
              avgRating = null;
            }

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
              avgRating,
              upcomingDepartures
            };
          } catch (err) {
            console.error('Failed to fetch package data:', err);
            return {
              ...pkg,
              bookingsCount: null,
              avgRating: null,
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
      ? 'bg-info/10 text-info'
      : 'bg-info/10 text-info';
  };

  const getCategoryColor = (category) => {
    const colors = {
      SILVER: 'bg-surface-muted text-text',
      GOLD: 'bg-warning/10 text-warning',
      PLATINUM: 'bg-info/10 text-info',
      DIAMOND: 'bg-danger/10 text-danger'
    };
    return colors[category] || 'bg-surface-muted text-text';
  };

  return (
    <div className="bg-surface rounded-2xl shadow-lg p-6 border border-border">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-text flex items-center">
          <LuPackage aria-hidden="true" className="mr-3 text-brand" />
          Tour Packages
        </h2>
        <button 
          onClick={() => {
            setSelectedPackage(null);
            setShowEditModal(true);
          }}
          className="flex items-center space-x-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-opacity hover:opacity-90"
        >
          <LuPlus aria-hidden="true" />
          <span>Create Package</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <LuSearch aria-hidden="true" className="absolute left-3 top-3 text-text-muted" />
          <input
            type="text"
            placeholder="Search packages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-surface text-text focus:ring-2 focus:ring-brand"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
        >
          <option value="all">All Types</option>
          <option value="GROUP">Group Tours</option>
          <option value="PERSONAL">Personal Tours</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
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
          className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
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
            <tr className="border-b-2 border-border">
              <th className={thClass}>Title</th>
              <th className={thClass}>Type</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Base Price</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Rating</th>
              <th className={thClass}>Bookings</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPackages.map((pkg) => {
              const hasUpcomingDepartures = pkg.type === 'GROUP' && pkg.upcomingDepartures > 0;
              
              return (
                <tr
                  key={pkg._id}
                  className="border-b border-border hover:bg-surface-muted transition-colors"
                >
                  <td className={tdClass}>
                    <div>
                      <div className="font-semibold text-text mb-1">
                        {pkg.title}
                      </div>
                      {hasUpcomingDepartures && (
                        <div className="flex items-center text-xs text-info">
                          <LuCalendarCheck aria-hidden="true" className="mr-1" />
                          <span>{pkg.upcomingDepartures} upcoming departure{pkg.upcomingDepartures > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={tdClass}>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(pkg.type)}`}>
                      {pkg.type}
                    </span>
                  </td>
                  <td className={tdClass}>
                    {pkg.category ? (
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(pkg.category)}`}>
                        {pkg.category}
                      </span>
                    ) : (
                      <span className="text-text-muted text-sm">N/A</span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <span className="font-semibold text-text">
                      BDT {pkg.basePrice?.toLocaleString()}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <button
                      onClick={() => togglePackageStatus(pkg._id, pkg.isActive)}
                      className={`flex items-center justify-center mx-auto px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                        pkg.isActive
                          ? 'bg-success/10 text-success'
                          : 'bg-surface-muted text-text'
                      }`}
                      title={hasUpcomingDepartures && pkg.isActive ? 'Warning: Has upcoming departures' : ''}
                    >
                      {pkg.isActive ? (
                        <>
                          <LuToggleRight aria-hidden="true" className="mr-1" /> Active
                        </>
                      ) : (
                        <>
                          <LuToggleLeft aria-hidden="true" className="mr-1" /> Inactive
                        </>
                      )}
                      {hasUpcomingDepartures && pkg.isActive && (
                        <LuCircleAlert aria-hidden="true" className="ml-1 text-warning" />
                      )}
                    </button>
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center justify-center space-x-1">
                      <LuStar aria-hidden="true" className="text-warning" />
                      <span className="font-semibold text-text">
                        {pkg.avgRating ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className={tdClass}>
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-info/10 text-info rounded-full font-semibold">
                      {pkg.bookingsCount ?? '—'}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => onViewDetails && onViewDetails(pkg)}
                        className="p-2 text-info hover:bg-info/10 rounded transition-colors"
                        title="View Details"
                      >
                        <LuEye aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setShowEditModal(true);
                        }}
                        className="p-2 text-success hover:bg-success/10 rounded transition-colors"
                        title="Edit"
                      >
                        <LuPencil aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredPackages.length === 0 && !loading && (
          <div className="text-center py-12 text-text-muted">
            {searchTerm || typeFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' 
              ? 'No packages match your filters' 
              : 'No packages found'}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-8 text-brand font-semibold">Loading...</div>
      )}

      {/* Stats Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-info/10 to-info/5 rounded-lg">
          <div className="text-sm text-info font-semibold">Total Packages</div>
          <div className="text-2xl font-bold text-info">{packages.length}</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-info/10 to-info/5 rounded-lg">
          <div className="text-sm text-info font-semibold">Group Tours</div>
          <div className="text-2xl font-bold text-info">
            {packages.filter(p => p.type === 'GROUP').length}
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-success/10 to-success/5 rounded-lg">
          <div className="text-sm text-success font-semibold">Active Packages</div>
          <div className="text-2xl font-bold text-success">
            {packages.filter(p => p.isActive).length}
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-warning/10 to-warning/5 rounded-lg">
          <div className="text-sm text-warning font-semibold">Total Bookings</div>
          <div className="text-2xl font-bold text-warning">
            {packages.reduce((sum, p) => sum + (p.bookingsCount || 0), 0)}
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
