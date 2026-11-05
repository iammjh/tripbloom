import { LuEye, LuPencil, LuPlus, LuSearch, LuToggleLeft, LuToggleRight, LuTriangleAlert, LuUsers } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { thClass, tdClass } from './admin/AdminPrimitives.jsx';


const OperatorsList = ({ onViewDetails }) => {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    setLoading(true);
    try {
      // First try to get all users, then filter by role on frontend
      // This ensures we catch all operator role variations
      const res = await axios.get('/api/admin/users');
      
      console.log('API Response:', res.data);
      
      // Filter operators (handle all role variations)
      const allUsers = res.data.users || res.data || [];
      const operatorUsers = allUsers.filter(user => 
        user.roles?.some(r => {
          const roleUpper = r.toUpperCase();
          return roleUpper === 'TOUR_OPERATOR' || roleUpper === 'OPERATOR';
        })
      );
      
      // Fetch additional data for each operator
      const operatorsWithData = await Promise.all(
        operatorUsers.map(async (operator) => {
          try {
            // Get all departures to count both upcoming and assigned packages
            const allDeparturesRes = await axios.get('/api/admin/group-departures');
            const allDepartures = allDeparturesRes.data.departures || [];
            
            console.log(`\n=== Processing operator: ${operator.fullName} (ID: ${operator._id}) ===`);
            console.log(`Total departures in system: ${allDepartures.length}`);
            
            // Log first departure structure for debugging
            if (allDepartures.length > 0) {
              console.log('Sample departure structure:', {
                id: allDepartures[0]._id,
                packageTitle: allDepartures[0].packageId?.title,
                operators: allDepartures[0].operators,
                packageId: allDepartures[0].packageId?._id,
                startDate: allDepartures[0].startDate,
                endDate: allDepartures[0].endDate,
                status: allDepartures[0].status
              });
              console.log('All departures with dates:');
              allDepartures.forEach((dep, idx) => {
                console.log(`  ${idx + 1}. ${dep.packageId?.title || 'Unknown'}: Start=${dep.startDate}, End=${dep.endDate}, Status=${dep.status}`);
              });
            }
            
            const now = new Date();
            console.log(`Current date: ${now.toISOString()}`);
            
            // Filter departures where this operator is assigned
            const operatorDepartures = allDepartures.filter(dep => {
              // Check if operator is assigned to this departure
              // Handle both string and ObjectId comparisons
              if (!dep.operators || dep.operators.length === 0) {
                return false;
              }
              
              const isAssigned = dep.operators.some(op => {
                const opId = op.operatorId?._id || op.operatorId;
                const match = String(opId) === String(operator._id);
                if (match) {
                  console.log(`  Matched in departure: ${dep.packageId?.title || dep._id}`);
                }
                return match;
              });
              return isAssigned;
            });
            
            console.log(`Total departures assigned to ${operator.fullName}: ${operatorDepartures.length}`);
            
            // Count upcoming departures (future dates only)
            const upcomingDepartures = operatorDepartures.filter(dep => {
              const startDate = new Date(dep.startDate);
              const isFuture = startDate >= now;
              console.log(`  Departure "${dep.packageId?.title || dep._id}": ${startDate.toISOString()} - ${isFuture ? 'FUTURE' : 'PAST'}`);
              return isFuture;
            }).length;
            
            console.log(`Upcoming departures count: ${upcomingDepartures}`);
            
            // Count unique packages from all operator departures
            const uniquePackageIds = new Set(
              operatorDepartures
                .map(dep => {
                  const pkgId = dep.packageId?._id || dep.packageId;
                  return String(pkgId);
                })
                .filter(id => id && id !== 'undefined')
            );
            
            const assignedPackages = uniquePackageIds.size;
            
            console.log(`Unique packages count: ${assignedPackages}\n`);

            return {
              ...operator,
              upcomingDepartures,
              assignedPackages
            };
          } catch (err) {
            console.error(`Error fetching data for operator ${operator._id}:`, err);
            return {
              ...operator,
              upcomingDepartures: 0,
              assignedPackages: 0
            };
          }
        })
      );

      setOperators(operatorsWithData);
      
      // Debug logging
      console.log('Total users fetched:', allUsers.length);
      console.log('Filtered operators:', operatorUsers.length);
      console.log('Operators with data:', operatorsWithData);
    } catch (err) {
      console.error('Failed to fetch operators:', err);
    }
    setLoading(false);
  };

  const toggleOperatorStatus = async (operatorId, currentStatus) => {
    try {
      await axios.put(`/api/admin/users/${operatorId}`, {
        isActive: !currentStatus
      });
      fetchOperators(); // Refresh list
    } catch (err) {
      console.error('Failed to toggle operator status:', err);
    }
  };

  const filteredOperators = operators.filter(op => {
    const matchesSearch = op.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         op.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && op.isActive) ||
                         (statusFilter === 'inactive' && !op.isActive);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-surface rounded-2xl shadow-lg p-6 border border-border">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-text flex items-center">
          <LuUsers aria-hidden="true" className="mr-3 text-brand" />
          Tour Operators
        </h2>
        <button className="flex items-center space-x-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-opacity hover:opacity-90">
          <LuPlus aria-hidden="true" />
          <span>Add Operator</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <LuSearch aria-hidden="true" className="absolute left-3 top-3 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-surface text-text focus:ring-2 focus:ring-brand"
          />
        </div>
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
              <th className={thClass}>Name</th>
              <th className={thClass}>Email</th>
              <th className={thClass}>Phone</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Assigned Packages</th>
              <th className={thClass}>Upcoming Departures</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOperators.map((operator) => {
              const hasWarning = !operator.isActive && operator.upcomingDepartures > 0;
              
              return (
                <tr
                  key={operator._id}
                  className={`border-b border-border hover:bg-surface-muted transition-colors ${
                    hasWarning ? 'bg-warning/10' : ''
                  }`}
                >
                  <td className={tdClass}>
                    <div className="flex items-center">
                      <div className="font-medium text-text">
                        {operator.fullName}
                      </div>
                      {hasWarning && (
                        <LuTriangleAlert aria-hidden="true" 
                          className="ml-2 text-warning" 
                          title="Inactive operator with future departures"
                        />
                      )}
                    </div>
                  </td>
                  <td className={tdClass}>
                    {operator.email}
                  </td>
                  <td className={tdClass}>
                    {operator.phone || 'N/A'}
                  </td>
                  <td className={tdClass}>
                    <button
                      onClick={() => toggleOperatorStatus(operator._id, operator.isActive)}
                      className={`flex items-center justify-center mx-auto px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                        operator.isActive
                          ? 'bg-success/10 text-success'
                          : 'bg-surface-muted text-text'
                      }`}
                    >
                      {operator.isActive ? (
                        <>
                          <LuToggleRight aria-hidden="true" className="mr-1" /> Active
                        </>
                      ) : (
                        <>
                          <LuToggleLeft aria-hidden="true" className="mr-1" /> Inactive
                        </>
                      )}
                    </button>
                  </td>
                  <td className={tdClass}>
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-info/10 text-info rounded-full font-semibold">
                      {operator.assignedPackages}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-semibold ${
                      operator.upcomingDepartures > 0
                        ? 'bg-warning/10 text-warning'
                        : 'bg-surface-muted text-text'
                    }`}>
                      {operator.upcomingDepartures}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => onViewDetails && onViewDetails(operator)}
                        className="p-2 text-info hover:bg-info/10 rounded transition-colors"
                        title="View Details"
                      >
                        <LuEye aria-hidden="true" />
                      </button>
                      <button
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

        {filteredOperators.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-text-muted mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'No operators match your filters' 
                : operators.length === 0 
                  ? 'No tour operators found in the system'
                  : 'No operators found'}
            </div>
            {operators.length === 0 && !searchTerm && statusFilter === 'all' && (
              <div className="text-sm text-text-muted">
                <p className="mb-2">No users with "tour_operator" or "operator" role exist yet.</p>
                <p>Add users with operator role from User Management or create a new operator.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-8 text-brand font-semibold">Loading...</div>
      )}

      {/* Stats Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-br from-info/10 to-info/5 rounded-lg">
          <div className="text-sm text-info font-semibold">Total Operators</div>
          <div className="text-2xl font-bold text-info">{operators.length}</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-success/10 to-success/5 rounded-lg">
          <div className="text-sm text-success font-semibold">Active Operators</div>
          <div className="text-2xl font-bold text-success">
            {operators.filter(op => op.isActive).length}
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-warning/10 to-warning/5 rounded-lg">
          <div className="text-sm text-warning font-semibold">With Future Departures</div>
          <div className="text-2xl font-bold text-warning">
            {operators.filter(op => op.upcomingDepartures > 0).length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperatorsList;
