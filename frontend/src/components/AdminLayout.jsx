import { LuX, LuActivity, LuBanknote, LuBell, LuCalendarClock, LuCalendarDays, LuHouse, LuIdCard, LuLayoutDashboard, LuLogOut, LuMail, LuMegaphone, LuMenu, LuRoute, LuSettings, LuStar, LuUndo2, LuWallet } from 'react-icons/lu';
import { MailIcon, CalendarIcon, ClockIcon, IdCardIcon } from './ui/icons.js';
import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ManageUsersMenu from './ManageUsersMenu';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import { useAuth } from '../context/AuthContext';
import { isRefundPending } from '../utils/refundState.js';
import { ADMIN_DATA_CHANGED } from '../utils/adminEvents.js';

// Sidebar sections. `menu` marks the group that also shows the Manage Users dropdown.
const NAV_GROUPS = [
  { label: 'Overview', items: [
    { label: 'Dashboard', path: '/admin', icon: LuLayoutDashboard },
  ] },
  { label: 'People', menu: true, items: [
    { label: 'Contact messages', path: '/admin/contacts', icon: LuMail },
    { label: 'KYC verification', path: '/admin/kyc', icon: LuIdCard, badgeKey: 'kyc' },
  ] },
  { label: 'Catalogue', items: [
    { label: 'Tour packages', path: '/admin/packages', icon: LuRoute },
    { label: 'Departures', path: '/admin/departures', icon: LuCalendarDays },
    { label: 'Reviews', path: '/admin/reviews', icon: LuStar },
  ] },
  { label: 'Money', items: [
    { label: 'Payment verification', path: '/admin/payments', icon: LuWallet },
    { label: 'Refund queue', path: '/admin/refunds', icon: LuUndo2 },
    { label: 'Date change requests', path: '/admin/date-changes', icon: LuCalendarClock },
  ] },
  { label: 'Content & system', items: [
    { label: 'Announcements', path: '/admin/announcements', icon: LuMegaphone },
    { label: 'Activity logs', path: '/admin/activity-logs', icon: LuActivity },
    { label: 'Settings', path: '/admin/settings', icon: LuSettings },
  ] },
];

// Badge tone and label for each notification type.
const NOTIFICATION_TONE = { contact: 'brand', kyc: 'info', datechange: 'info', refund: 'danger', 'review-pending': 'warning', chat: 'success', 'live-chat': 'success' };
const NOTIFICATION_LABEL = { datechange: 'Date change', 'review-pending': 'Review', chat: 'Chat', 'live-chat': 'Chat', kyc: 'KYC', refund: 'Refund' };

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // On screens narrower than lg the sidebar is a slide-over; it closes when the page changes.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

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

  // Live chat messages from customers and operators that the admin has not seen yet.
  const liveChatItems = async (adminId) => {
    try {
      const usersRes = await axios.get('/api/users').catch(() => ({ data: [] }));
      const usersList = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data.users || []);
      const nonAdmins = usersList.filter(u => {
        if (!u) return false;
        const r = u.role || '';
        const rs = u.roles || [];
        const isAdmin = r.toString().toUpperCase() === 'ADMIN' ||
          (Array.isArray(rs) && rs.some(x => (x || '').toString().toUpperCase() === 'ADMIN'));
        return !isAdmin;
      });
      const seenChats = JSON.parse(localStorage.getItem('seenChatTimestamps') || '{}');
      const items = [];
      for (const user of nonAdmins.slice(0, 15)) {
        try {
          const qs = new URLSearchParams({ userA: adminId, userB: user._id });
          const convRes = await axios.get('/api/messages/conversation?' + qs.toString()).catch(() => ({ data: { messages: [] } }));
          if (!(convRes.data.success && convRes.data.messages && convRes.data.messages.length > 0)) continue;
          const incoming = convRes.data.messages.filter(m => (m.senderId?._id || m.senderId) !== adminId);
          if (incoming.length === 0) continue;
          const lastMsg = incoming[incoming.length - 1];
          const lastMsgTime = new Date(lastMsg.sentAt).getTime();
          if (lastMsgTime <= (seenChats[user._id] || 0)) continue;
          const senderName = lastMsg.senderId?.fullName || lastMsg.senderId?.name || user.fullName || user.name || user.email || 'User';
          const notifId = `chat-${user._id}`;
          items.push({
            id: notifId,
            type: 'live-chat',
            icon: <LuMail aria-hidden="true" className="text-info" />,
            title: `Chat from ${senderName}`,
            message: (lastMsg.content || '').substring(0, 50) + ((lastMsg.content || '').length > 50 ? '...' : ''),
            time: new Date(lastMsg.sentAt),
            action: () => {
              // Opening the chat marks it as seen and removes it from the bell.
              const currentSeen = JSON.parse(localStorage.getItem('seenChatTimestamps') || '{}');
              currentSeen[user._id] = Date.now();
              localStorage.setItem('seenChatTimestamps', JSON.stringify(currentSeen));
              dismissNotification(notifId);
              navigate(`/admin/contacts?chatUserId=${user._id}`);
            }
          });
        } catch (err) {
          // Skip one conversation that fails; the rest still show.
        }
      }
      return items;
    } catch (err) {
      console.debug('Live chat notifications fetch failed', err);
      return [];
    }
  };

  // Builds the whole bell from every source in one pass and replaces the list once. Handled records drop out on the next pass.
  const fetchUnread = async () => {
    try {
      const role = localStorage.getItem('userRole') || '';
      const roleUpper = role.toUpperCase();
      const isAdminLike = roleUpper === 'ADMIN' || roleUpper === 'MODERATOR';
      const adminId = localStorage.getItem('userId');

      const [contactsRes, bookingsRes, kycRes, reviewsRes] = await Promise.all([
        axios.get('/api/admin/contacts', { headers: { 'x-user-role': role } }).catch(() => null),
        axios.get('/api/bookings').catch(() => null),
        axios.get('/api/admin/kyc', { headers: { 'x-user-role': role } }).catch(() => null),
        isAdminLike ? axios.get('/api/reviews?status=PENDING').catch(() => null) : Promise.resolve(null),
      ]);

      const items = [];

      if (Array.isArray(contactsRes?.data?.contacts)) {
        contactsRes.data.contacts.filter(c => !c.handled).forEach(c => {
          items.push({
            id: `contact-${c._id}`,
            type: 'contact',
            icon: <MailIcon aria-hidden="true" className="h-4 w-4" />,
            title: c.name,
            message: c.message,
            time: new Date(c.createdAt),
            action: () => navigate(`/admin/contacts?focus=${c._id}`)
          });
        });
      }

      if (Array.isArray(kycRes?.data?.kycs)) {
        const pendingKYCs = kycRes.data.kycs.filter(k => k.status === 'pending');
        setPendingKYCCount(pendingKYCs.length);
        pendingKYCs.forEach(k => {
          items.push({
            id: `kyc-${k._id}`,
            type: 'kyc',
            icon: <IdCardIcon aria-hidden="true" className="h-4 w-4" />,
            title: 'KYC Pending Review',
            message: `${k.user?.fullName || k.user?.name || 'Customer'} submitted KYC verification`,
            time: new Date(k.createdAt),
            action: () => navigate('/admin/kyc')
          });
        });
      }

      const allBookings = Array.isArray(bookingsRes?.data?.bookings) ? bookingsRes.data.bookings : [];

      allBookings
        .filter(b => b.dateChangeRequest && b.dateChangeRequest.status === 'PENDING')
        .forEach(b => {
          items.push({
            id: `datechange-${b._id}`,
            type: 'datechange',
            icon: <CalendarIcon aria-hidden="true" className="h-4 w-4" />,
            title: 'Date Change Request',
            message: `${b.customerId?.fullName || 'Customer'} requested to change booking date`,
            time: new Date(b.dateChangeRequest.requestedAt),
            action: () => navigate('/admin/date-changes')
          });
        });

      // Same rule as the refund queue: cancelled, paid, and no refund recorded yet.
      allBookings.filter(isRefundPending).forEach(b => {
        items.push({
          id: `refund-${b._id}`,
          type: 'refund',
          icon: <LuBanknote aria-hidden="true" className="text-success" />,
          title: 'Refund Request',
          message: `${b.customerId?.fullName || 'Customer'} needs refund for cancelled booking`,
          time: new Date(b.cancellation?.cancelledAt || b.updatedAt),
          action: () => navigate('/admin/refunds')
        });
      });

      if (Array.isArray(reviewsRes?.data?.reviews)) {
        reviewsRes.data.reviews.forEach(r => {
          items.push({
            id: `review-pending-${r._id}`,
            type: 'review-pending',
            icon: <ClockIcon aria-hidden="true" className="h-4 w-4" />,
            title: 'Review Awaiting Approval',
            message: `${r.customerId?.fullName || 'Customer'} submitted a review for ${r.packageId?.title || 'a package'}`,
            time: new Date(r.createdAt),
            action: () => navigate(`/admin/reviews?reviewId=${r._id}`)
          });
        });
      }

      if (isAdminLike && adminId) {
        items.push(...await liveChatItems(adminId));
      }

      items.sort((a, b) => b.time - a.time);
      setUnreadList(items.slice(0, 15));
      setUnreadCount(items.length);
    } catch (err) {
      console.debug('Unread fetch failed', err?.message || err);
    }
  };

  useEffect(() => {
    fetchUnread();
    const t = setInterval(fetchUnread, 30000);
    return () => clearInterval(t);
  }, []);

  // Refresh at once when an administrator changes a record that feeds the bell.
  useEffect(() => {
    const refresh = () => { fetchUnread(); };
    window.addEventListener(ADMIN_DATA_CHANGED, refresh);
    return () => window.removeEventListener(ADMIN_DATA_CHANGED, refresh);
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

  const { logout } = useAuth();
  const MENU_PAGES = [
    { label: 'All users', path: '/admin/users', group: 'People' },
    { label: 'Operators', path: '/admin/operators', group: 'People' },
  ];
  const allItems = [...NAV_GROUPS.flatMap(group => group.items.map(item => ({ ...item, group: group.label }))), ...MENU_PAGES];
  const currentItem = allItems.find(item => isActive(item.path));
  const currentGroup = currentItem ? { label: currentItem.group } : null;
  const pageTitle = currentItem ? currentItem.label : 'Admin';

  const handleLogout = () => {
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    logout();
    navigate('/');
  };

  return (
    <div className="dark mesh-bg min-h-screen text-text">
      <aside
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface lg:glass-strong transition-transform duration-200 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-border px-5">
          <img src="/tripbloom_logo.svg" alt="" className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold text-text">TripBloom</p>
            <p className="text-xs text-text-muted">Admin portal</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
            title="Close navigation"
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text lg:hidden"
          >
            <LuX aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Admin sections" className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-3 py-5">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 px-3" role="presentation">
                <span className="h-px flex-1 bg-border" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{group.label}</p>
                <span className="h-px flex-1 bg-border" />
              </div>
              {group.menu && <div className="mt-2"><ManageUsersMenu navigate={navigate} /></div>}
              <ul className="mt-2 space-y-1">
                {group.items.map(item => {
                  const active = isActive(item.path);
                  const Icon = item.icon;
                  const count = item.badgeKey === 'kyc' ? pendingKYCCount : 0;
                  return (
                    <li key={item.path}>
                      <button
                        type="button"
                        onClick={() => navigate(item.path)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                          active ? 'bg-brand/15 text-text ring-1 ring-inset ring-brand/30' : 'text-text-muted hover:bg-surface-muted hover:text-text'
                        }`}
                      >
                        <Icon aria-hidden="true" className={`h-4 w-4 flex-none ${active ? 'text-brand' : ''}`} />
                        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                        {count > 0 && (
                          <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold leading-none text-white">{count}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-border p-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          >
            <LuHouse aria-hidden="true" className="h-4 w-4" />
            View public site
          </button>
          <Button variant="secondary" icon={LuLogOut} className="w-full" onClick={handleLogout}>Log out</Button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div aria-hidden="true" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      <div className="min-h-screen min-w-0 lg:pl-72">
        <header className="glass-strong backdrop-blur-xl sticky top-0 z-30 flex h-20 items-center justify-between gap-4 border-b border-border px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(open => !open)}
              aria-label="Toggle navigation"
              aria-expanded={mobileNavOpen}
              className="rounded-xl p-2 text-text-muted transition-colors hover:bg-surface-muted hover:text-text lg:hidden"
            >
              <LuMenu aria-hidden="true" className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-text-muted">Admin{currentGroup ? ` / ${currentGroup.label}` : ''}</p>
              <h2 className="truncate font-display text-xl font-bold text-text">{pageTitle}</h2>
            </div>
          </div>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => { if (!showNotifications) fetchUnread(); setShowNotifications(v => !v); }}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              aria-expanded={showNotifications}
              className="relative rounded-xl p-2.5 text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
            >
              <LuBell aria-hidden="true" className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{unreadCount}</span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface text-text shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="font-semibold text-text">Notifications</p>
                  <span className="text-xs text-text-muted">{unreadCount} unread</span>
                </div>
                <div className="max-h-96 overflow-auto">
                  {unreadList.length === 0 && (
                    <p className="p-6 text-center text-sm text-text-muted">No new notifications.</p>
                  )}
                  <ul>
                    {unreadList.map(n => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => { setShowNotifications(false); n.action(); }}
                          className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-muted"
                        >
                          <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-muted text-text-muted" aria-hidden="true">{n.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-semibold text-text">{n.title}</span>
                              {n.type !== 'contact' && <Badge tone={NOTIFICATION_TONE[n.type] || 'danger'}>{NOTIFICATION_LABEL[n.type] || 'Refund'}</Badge>}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-sm text-text-muted">{n.message}</span>
                            <span className="mt-1 block text-xs text-text-muted">{formatNotificationTime(n.time)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border-t border-border p-2 text-center">
                  <button type="button" onClick={() => setShowNotifications(false)} className="text-sm font-semibold text-brand hover:underline">Close</button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
