import { LuBan, LuEye, LuPencil, LuPlus, LuSearch, LuShield, LuToggleLeft, LuToggleRight, LuUser, LuUserCog, LuUsers } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

import UserEditModal from './UserEditModal';
import { thClass, tdClass } from './admin/AdminPrimitives.jsx';

const UsersList = ({ onViewDetails }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'CUSTOMER', 'ADMIN', 'TOUR_OPERATOR'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/users');
      
      // Fetch additional data for each user
      const usersWithData = await Promise.all(
        (res.data.users || []).map(async (user) => {
          try {
            // Get bookings count for this customer
            let bookingsCount = 0;
            let activeBookingsCount = 0;
            try {
              const bookingsRes = await axios.get('/api/bookings', {
                params: { customerId: user._id }
              });
              bookingsCount = bookingsRes.data.bookings?.length || 0;
              activeBookingsCount = bookingsRes.data.bookings?.filter(b => 
                ['PENDING', 'CONFIRMED'].includes(b.status)
              ).length || 0;
            } catch (err) {
              // Bookings could not be loaded; leave the counts unknown rather than guessing
              bookingsCount = null;
              activeBookingsCount = null;
            }

            // Get future departures if operator
            let futureDepartures = 0;
            if (user.roles?.some(r => r.toLowerCase() === 'tour_operator' || r.toLowerCase() === 'operator')) {
              try {
                const depRes = await axios.get(`/api/group-departure/operator/${user._id}/future`);
                futureDepartures = depRes.data.departures?.length || 0;
              } catch (err) {
                futureDepartures = 0;
              }
            }

            // The backend does not record last login, so no value is shown
            const lastLogin = null;

            return {
              ...user,
              bookingsCount,
              activeBookingsCount,
              futureDepartures,
              lastLogin
            };
          } catch (err) {
            return {
              ...user,
              bookingsCount: 0,
              activeBookingsCount: 0,
              futureDepartures: 0,
              lastLogin: null
            };
          }
        })
      );

      setUsers(usersWithData);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
    setLoading(false);
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await axios.put(`/api/admin/users/${userId}`, {
        isActive: !currentStatus
      });
      fetchUsers(); // Refresh list
    } catch (err) {
      console.error('Failed to toggle user status:', err);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || 
                       user.roles?.some(r => r.toUpperCase() === roleFilter.toUpperCase() || 
                                           (roleFilter === 'TOUR_OPERATOR' && r.toLowerCase() === 'operator'));
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleIcon = (role) => {
    const roleUpper = role.toUpperCase();
    if (roleUpper === 'ADMIN') return LuShield;
    if (roleUpper === 'TOUR_OPERATOR' || roleUpper === 'OPERATOR') return LuUserCog;
    return LuUser;
  };

  const getRoleColor = (role) => {
    const roleUpper = role.toUpperCase();
    if (roleUpper === 'ADMIN') return 'bg-danger/10 text-danger';
    if (roleUpper === 'TOUR_OPERATOR' || roleUpper === 'OPERATOR') return 'bg-warning/10 text-warning';
    return 'bg-info/10 text-info';
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatLastLogin = (date) => {
    if (!date) return 'Not tracked';
    const now = new Date();
    const loginDate = new Date(date);
    const diffMs = now - loginDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(loginDate);
  };

  return (
    <div className="bg-surface rounded-2xl shadow-lg p-6 border border-border">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-text flex items-center">
          <LuUsers aria-hidden="true" className="mr-3 text-brand" />
          User Management
        </h2>
        <button 
          onClick={() => {
            setSelectedUser(null);
            setShowEditModal(true);
          }}
          className="flex items-center space-x-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-opacity hover:opacity-90"
        >
          <LuPlus aria-hidden="true" />
          <span>Add User</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
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
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
        >
          <option value="all">All Roles</option>
          <option value="CUSTOMER">Customers</option>
          <option value="ADMIN">Admins</option>
          <option value="TOUR_OPERATOR">Tour Operators</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg bg-surface text-text"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive/Blocked Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-border">
              <th className={thClass}>Name</th>
              <th className={thClass}>Email</th>
              <th className={thClass}>Role(s)</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Created Date</th>
              <th className={thClass}>Last Login</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const hasActiveData = user.activeBookingsCount > 0 || user.futureDepartures > 0;
              
              return (
                <tr
                  key={user._id}
                  className={`border-b border-border hover:bg-surface-muted transition-colors ${
                    !user.isActive ? 'bg-danger/10' : ''
                  }`}
                >
                  <td className={tdClass}>
                    <div className="flex items-center">
                      <div className="font-medium text-text">
                        {user.fullName}
                      </div>
                      {!user.isActive && (
                        <LuBan aria-hidden="true" className="ml-2 text-danger" title="Blocked/Inactive user" />
                      )}
                    </div>
                  </td>
                  <td className={tdClass}>
                    {user.email}
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-1">
                      {user.roles?.map((role, idx) => {
                        const RoleIcon = getRoleIcon(role);
                        return (
                          <span 
                            key={idx}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getRoleColor(role)}`}
                          >
                            <RoleIcon className="mr-1" />
                            {role.toUpperCase() === 'TOUR_OPERATOR' || role.toLowerCase() === 'operator' ? 'Operator' : role}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className={tdClass}>
                    <button
                      onClick={() => toggleUserStatus(user._id, user.isActive)}
                      className={`flex items-center justify-center mx-auto px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                        user.isActive
                          ? 'bg-success/10 text-success'
                          : 'bg-danger/10 text-danger'
                      }`}
                      title={hasActiveData && user.isActive ? 'Warning: User has active bookings/departures' : ''}
                    >
                      {user.isActive ? (
                        <>
                          <LuToggleRight aria-hidden="true" className="mr-1" /> Active
                        </>
                      ) : (
                        <>
                          <LuToggleLeft aria-hidden="true" className="mr-1" /> Blocked
                        </>
                      )}
                    </button>
                  </td>
                  <td className={tdClass}>
                    {formatDate(user.createdAt)}
                  </td>
                  <td className={tdClass}>
                    {formatLastLogin(user.lastLogin)}
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => onViewDetails && onViewDetails(user)}
                        className="p-2 text-info hover:bg-info/10 rounded transition-colors"
                        title="View Details"
                      >
                        <LuEye aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
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

        {filteredUsers.length === 0 && !loading && (
          <div className="text-center py-12 text-text-muted">
            {searchTerm || roleFilter !== 'all' || statusFilter !== 'all' 
              ? 'No users match your filters' 
              : 'No users found'}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-8 text-brand font-semibold">Loading...</div>
      )}

      {/* Stats Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-info/10 to-info/5 rounded-lg">
          <div className="text-sm text-info font-semibold">Total Users</div>
          <div className="text-2xl font-bold text-info">{users.length}</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-info/10 to-info/5 rounded-lg">
          <div className="text-sm text-info font-semibold">Customers</div>
          <div className="text-2xl font-bold text-info">
            {users.filter(u => u.roles?.some(r => r.toUpperCase() === 'CUSTOMER')).length}
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-success/10 to-success/5 rounded-lg">
          <div className="text-sm text-success font-semibold">Active Users</div>
          <div className="text-2xl font-bold text-success">
            {users.filter(u => u.isActive).length}
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-danger/10 to-danger/5 rounded-lg">
          <div className="text-sm text-danger font-semibold">Blocked Users</div>
          <div className="text-2xl font-bold text-danger">
            {users.filter(u => !u.isActive).length}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <UserEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onUserUpdated={() => {
          fetchUsers();
          setShowEditModal(false);
          setSelectedUser(null);
        }}
      />
    </div>
  );
};

export default UsersList;
