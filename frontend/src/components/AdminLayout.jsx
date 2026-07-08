import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ManageUsersMenu from './ManageUsersMenu';
import { 
  FaUsers, FaRoute, FaChartLine, FaCog, FaSignOutAlt, FaBell, FaSearch, 
  FaCalendar, FaDollarSign, FaStar, FaEnvelope, FaCalendarAlt, FaEye, FaBullhorn, FaIdCard, FaMoneyBillWave
} from 'react-icons/fa';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadList, setUnreadList] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingKYCCount, setPendingKYCCount] = useState(0);
  const notifRef = useRef(null);

  // Helper to dismiss a notification by id
  const dismissNotification = (notifId) => {
    setUnreadList(prev => {
      const updated = prev.filter(n => n.id !== notifId);
      setUnreadCount(updated.length);
      return updated;
    });
  };

  // Helper function to check if a path is active
  const isActive = (path) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const formatNotificationTime = (time) => {
    const now = new Date();
    const diff = Math.floor((now - time) / 1000); // seconds
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    
    return time.toLocaleDateString();
  };

  const fetchUnread = async () => {
    try {
      const role = localStorage.getItem('userRole') || '';
      const roleUpper = (role || '').toUpperCase();
      
      // Fetch all notification sources in parallel
      const [contactsRes, bookingsRes, kycRes] = await Promise.all([
        axios.get('/api/admin/contacts', { headers: { 'x-user-role': role } }).catch(() => ({ data: { contacts: [] } })),
        axios.get('/api/bookings').catch(() => ({ data: { bookings: [] } })),
        axios.get('/api/admin/kyc', { 
          headers: { 'x-user-role': role } 
        }).catch(() => ({ data: { kycs: [] } }))
      ]);
      
      const notifications = [];
      
      // Contact messages
      if (contactsRes.data && Array.isArray(contactsRes.data.contacts)) {
        const unreadContacts = contactsRes.data.contacts.filter(c => !c.handled);
        unreadContacts.forEach(c => {
          notifications.push({
            id: `contact-${c._id}`,
            type: 'contact',
            icon: '📧',
            title: c.name,
            message: c.message,
            time: new Date(c.createdAt),
            action: () => navigate(`/admin/contacts?focus=${c._id}`)
          });
        });
      }
      
      // KYC requests
      if (kycRes.data && Array.isArray(kycRes.data.kycs)) {
        const allKYCs = kycRes.data.kycs;
        const pendingKYCs = allKYCs.filter(k => k.status === 'pending');
        setPendingKYCCount(pendingKYCs.length); // Set count for menu badge
        pendingKYCs.forEach(k => {
          notifications.push({
            id: `kyc-${k._id}`,
            type: 'kyc',
            icon: '🆔',
            title: 'KYC Pending Review',
            message: `${k.user?.fullName || k.user?.name || 'Customer'} submitted KYC verification`,
            time: new Date(k.createdAt),
            action: () => navigate('/admin/kyc')
          });
        });
      }
      
      // Date change requests
      const allBookings = bookingsRes.data.bookings || [];
      const pendingDateChanges = allBookings.filter(b => 
        b.dateChangeRequest && b.dateChangeRequest.status === 'PENDING'
      );
      pendingDateChanges.forEach(b => {
        notifications.push({
          id: `datechange-${b._id}`,
          type: 'datechange',
          icon: '📅',
          title: 'Date Change Request',
          message: `${b.customerId?.fullName || 'Customer'} requested to change booking date`,
          time: new Date(b.dateChangeRequest.requestedAt),
          action: () => navigate('/admin/date-changes')
        });
      });
      
      // Refund requests (cancelled bookings with payments that haven't been refunded)
      const pendingRefunds = allBookings.filter(b => {
        const isCancelled = b.status === 'CANCELLED' || b.cancellation?.isCancelled;
        const notRefunded = b.status !== 'REFUNDED' && !b.cancellation?.refundProcessed;
        const hasPaid = (b.payments || [])
          .filter(p => p.status === 'SUCCESS' || p.status === 'CONFIRMED')
          .reduce((sum, p) => sum + (p.amount || 0), 0) > 0;
        return isCancelled && notRefunded && hasPaid;
      });
      pendingRefunds.forEach(b => {
        notifications.push({
          id: `refund-${b._id}`,
          type: 'refund',
          icon: <FaMoneyBillWave className="text-green-500" />,
          title: 'Refund Request',
          message: `${b.customerId?.fullName || 'Customer'} needs refund for cancelled booking`,
          time: new Date(b.cancellation?.cancelledAt || b.updatedAt),
          action: () => navigate('/admin/refunds')
        });
      });
      
      // Sort by time (newest first) and limit to 10
      notifications.sort((a, b) => b.time - a.time);
      const recentNotifications = notifications.slice(0, 10);
      
      setUnreadList(recentNotifications);
      setUnreadCount(notifications.length);
      
      // Fetch live chat messages for admin
      try {
        const adminId = localStorage.getItem('userId');
        if (adminId && (roleUpper === 'ADMIN' || roleUpper === 'MODERATOR')) {
          const usersRes = await axios.get('/api/users').catch(() => ({ data: [] }));
          const usersList = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data.users || []);
          
          // Filter non-admin users
          const nonAdmins = usersList.filter(u => {
            if (!u) return false;
            const r = u.role || '';
            const rs = u.roles || [];
            const isAdmin = r.toString().toUpperCase() === 'ADMIN' || 
                           (Array.isArray(rs) && rs.some(x => (x||'').toString().toUpperCase() === 'ADMIN'));
            return !isAdmin;
          });
          
          // Get seen chat timestamps from localStorage
          const seenChats = JSON.parse(localStorage.getItem('seenChatTimestamps') || '{}');
          
          const chatNotifs = [];
          for (const user of nonAdmins.slice(0, 15)) {
            try {
              const qs = new URLSearchParams({ userA: adminId, userB: user._id });
              const convRes = await axios.get('/api/messages/conversation?' + qs.toString()).catch(() => ({ data: { messages: [] } }));
              
              if (convRes.data.success && convRes.data.messages && convRes.data.messages.length > 0) {
                const incomingMsgs = convRes.data.messages.filter(m => {
                  const sid = m.senderId?._id || m.senderId;
                  return sid !== adminId;
                });
                
                if (incomingMsgs.length > 0) {
                  const lastMsg = incomingMsgs[incomingMsgs.length - 1];
                  const lastMsgTime = new Date(lastMsg.sentAt).getTime();
                  const seenTime = seenChats[user._id] || 0;
                  
                  // Only show notification if message is newer than last seen
                  if (lastMsgTime > seenTime) {
                    const senderName = lastMsg.senderId?.fullName || lastMsg.senderId?.name || user.fullName || user.name || user.email || 'User';
                    const notifId = `chat-${user._id}`;
                    chatNotifs.push({
                      id: notifId,
                      type: 'live-chat',
                      icon: <FaEnvelope className="text-blue-500" />,
                      title: `Chat from ${senderName}`,
                      message: lastMsg.content?.substring(0, 50) + (lastMsg.content?.length > 50 ? '...' : ''),
                      time: new Date(lastMsg.sentAt),
                      action: () => {
                        // Mark chat as seen when clicked
                        const currentSeen = JSON.parse(localStorage.getItem('seenChatTimestamps') || '{}');
                        currentSeen[user._id] = Date.now();
                        localStorage.setItem('seenChatTimestamps', JSON.stringify(currentSeen));
                        // Immediately dismiss from UI
                        dismissNotification(notifId);
                        navigate(`/admin/contacts?chatUserId=${user._id}`);
                      }
                    });
                  }
                }
              }
            } catch (err) {
              // skip
            }
          }
          
          if (chatNotifs.length > 0) {
            const merged = [...chatNotifs, ...recentNotifications]
              .sort((a, b) => b.time - a.time)
              .slice(0, 15);
            const uniqueIds = new Set(merged.map(n => n.id));
            setUnreadList(merged);
            setUnreadCount(uniqueIds.size);
          }
        }
      } catch (err) {
        console.debug('Live chat notifications fetch failed', err);
      }
      
      // Additionally fetch pending reviews (admin/moderator)
      try {
        // allow different casing (admin, ADMIN, Admin)
        if (roleUpper === 'ADMIN' || roleUpper === 'MODERATOR') {
          const revRes = await axios.get('/api/reviews?status=PENDING').catch(() => ({ data: { reviews: [] } }));
          const reviews = revRes.data.reviews || [];
          const reviewNotifs = reviews.map(r => ({
            id: `review-pending-${r._id}`,
            type: 'review-pending',
            icon: '🕒',
            title: 'Review Awaiting Approval',
            message: `${r.customerId?.fullName || 'Customer'} submitted a review for ${r.packageId?.title || 'a package'}`,
            time: new Date(r.createdAt),
            // deep-link into the reviews moderation page with the specific review id
            action: () => navigate(`/admin/reviews?reviewId=${r._id}`)
          }));

          console.debug('AdminLayout: fetched pending reviews', reviewNotifs.length, { role: roleUpper });

          if (reviewNotifs.length > 0) {
            const merged = [...reviewNotifs, ...unreadList]
              .sort((a, b) => b.time - a.time)
              .slice(0, 15);
            // compute unique count by id to avoid double-counting
            const uniqueIds = new Set(merged.map(n => n.id));
            setUnreadList(merged);
            setUnreadCount(uniqueIds.size);
          }
        }
      } catch (err) {
        // ignore review fetch errors
      }
    } catch (err) {
      // ignore polling errors
      console.debug('Unread fetch failed', err?.message || err);
    }
  };

  useEffect(() => {
    fetchUnread();
    const t = setInterval(fetchUnread, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-900 flex">
      {/* Left Sidebar Navigation */}
      <aside className="w-64 bg-gray-800 dark:bg-gray-800 shadow-2xl border-r border-gray-700 dark:border-gray-700 fixed h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3 mb-4">
            <img src="/tripbloom_logo.svg" alt="TripBloom" className="w-10 h-10" />
            <h1 className="text-xl font-bold text-primary">Admin Portal</h1>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto pb-20">
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all"
          >
            <FaChartLine className="text-xl" />
            <span className="font-semibold">Home</span>
          </button>
          <button 
            onClick={() => navigate('/admin')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:shadow-lg transition-all ${
              isActive('/admin')
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaChartLine className="text-xl" />
            <span className="font-semibold">Dashboard</span>
          </button>

          {/* Manage Users Dropdown */}
          <ManageUsersMenu navigate={navigate} />

          
          
          <button 
            onClick={() => navigate('/admin/packages')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive('/admin/packages')
                ? 'bg-green-500 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaRoute className="text-xl" />
            <span className="font-semibold">Tour Packages</span>
          </button>
          
          <button 
            onClick={() => navigate('/admin/departures')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive('/admin/departures')
                ? 'bg-purple-500 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaCalendar className="text-xl" />
            <span className="font-semibold">Departures</span>
          </button>
          
          <button 
            onClick={() => navigate('/admin/contacts')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive('/admin/contacts')
                ? 'bg-indigo-500 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaEnvelope className="text-xl" />
            <span className="font-semibold">Contact Messages</span>
          </button>
          
          <button 
            onClick={() => navigate('/admin/refunds')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive('/admin/refunds')
                ? 'bg-red-500 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaDollarSign className="text-xl" />
            <span className="font-semibold">Refund Queue</span>
          </button>
          
          <button 
            onClick={() => navigate('/admin/date-changes')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive('/admin/date-changes')
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaCalendarAlt className="text-xl" />
            <span className="font-semibold">Date Change Req</span>
          </button>
          
          <button 
            onClick={() => navigate('/admin/kyc')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive('/admin/kyc')
                ? 'bg-cyan-500 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaIdCard className="text-xl" />
            <span className="font-semibold">KYC Verify</span>
            {pendingKYCCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                {pendingKYCCount}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => navigate('/admin/reviews')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive('/admin/reviews')
                ? 'bg-yellow-500 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaStar className="text-xl" />
            <span className="font-semibold">Reviews</span>
          </button>
          
          <button 
            onClick={() => navigate('/admin/announcements')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive('/admin/announcements')
                ? 'bg-pink-500 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaBullhorn className="text-xl" />
            <span className="font-semibold">Announcements</span>
          </button>
          
          <button 
            onClick={() => navigate('/admin/activity-logs')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive('/admin/activity-logs')
                ? 'bg-teal-500 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaEye className="text-xl" />
            <span className="font-semibold">Activity Logs</span>
          </button>
          

          <button 
            onClick={() => navigate('/admin/settings')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive('/admin/settings')
                ? 'bg-gray-600 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaCog className="text-xl" />
            <span className="font-semibold">Settings</span>
          </button>
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-700 dark:border-gray-700 bg-gray-800 dark:bg-gray-800 flex-shrink-0">
          <button 
            onClick={() => {
              localStorage.removeItem('userName');
              localStorage.removeItem('userRole');
              navigate('/');
            }}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-semibold"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-64">
        {/* Top Bar */}
        <div className="bg-gray-800 dark:bg-gray-800 shadow-lg border-b border-gray-700 dark:border-gray-700 px-8 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white dark:text-white">Admin Dashboard</h2>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-600 dark:border-gray-600 rounded-lg bg-gray-700 dark:bg-gray-700 text-white dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
              </div>
              <div className="relative" ref={notifRef}>
                <button onClick={() => setShowNotifications(v => !v)} className="relative p-2 text-gray-300 dark:text-gray-300 hover:text-primary transition-colors">
                  <FaBell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full animate-pulse">{unreadCount}</span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-700 font-semibold text-gray-900 dark:text-white">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="max-h-96 overflow-auto">
                      {unreadList.length === 0 && (
                        <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                          No new notifications
                        </div>
                      )}
                      {unreadList.map(n => (
                        <button 
                          key={n.id} 
                          onClick={() => { 
                            setShowNotifications(false); 
                            n.action(); 
                          }} 
                          className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              <span className="text-xl flex-shrink-0" aria-hidden="true">{n.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 dark:text-white">
                                  {n.title}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-0.5">
                                  {n.message}
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                  {formatNotificationTime(n.time)}
                                </div>
                              </div>
                            </div>
                            {n.type !== 'contact' && (
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${
                                n.type === 'datechange' 
                                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' 
                                  : n.type === 'review-pending'
                                  ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                                  : (n.type === 'chat' || n.type === 'live-chat')
                                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                  : n.type === 'kyc'
                                  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                                  : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                              }`}>
                                {n.type === 'datechange' ? 'Date Change' 
                                  : n.type === 'review-pending' ? 'Review' 
                                  : (n.type === 'chat' || n.type === 'live-chat') ? 'Chat'
                                  : n.type === 'kyc' ? 'KYC'
                                  : 'Refund'}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="p-2 text-center border-t border-gray-100 dark:border-gray-700">
                      <button 
                        onClick={() => setShowNotifications(false)} 
                        className="text-sm text-primary hover:underline"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="px-8 py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
