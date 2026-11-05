import { LuBook, LuBus, LuClipboardList, LuExternalLink, LuHouse, LuLogOut, LuMenu, LuMessagesSquare, LuUser, LuX } from 'react-icons/lu';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import OperatorHome from '../operator/OperatorHome';
import MyDepartures from '../operator/MyDepartures';
import MyBookings from '../operator/MyBookings';
import ItinerariesManager from '../operator/ItinerariesManager';
import MessagesAnnouncements from '../operator/MessagesAnnouncements';
import OperatorProfile from '../operator/OperatorProfile';
import NotificationCenter from './NotificationCenter';
import AnnouncementBanner from './AnnouncementBanner';

const MENU_ITEMS = [
  { id: 'dashboard', icon: LuHouse, label: 'Dashboard' },
  { id: 'departures', icon: LuBus, label: 'My Departures' },
  { id: 'bookings', icon: LuBook, label: 'My Bookings' },
  { id: 'itineraries', icon: LuClipboardList, label: 'Itinerary' },
  { id: 'messages', icon: LuMessagesSquare, label: 'Messages' },
  { id: 'profile', icon: LuUser, label: 'Profile' },
];

const readStoredView = () => {
  try {
    return localStorage.getItem('operatorActiveView') || 'dashboard';
  } catch (error) {
    return 'dashboard';
  }
};

// Operator workspace: a fixed sidebar on laptops, and a solid drawer on tablets and phones.
const OperatorDashboard = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState(readStoredView);
  // Bumped on every navigation so a section starts fresh, even when its own item is chosen again.
  const [navVersion, setNavVersion] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openBookingId, setOpenBookingId] = useState(null);
  const [openAdminId, setOpenAdminId] = useState(null);

  // Choosing a section stores it (so a reload returns to it) and closes the drawer on smaller screens.
  const handleSetActiveView = (id) => {
    setActiveView(id);
    setNavVersion(version => version + 1);
    setMobileNavOpen(false);
    try { localStorage.setItem('operatorActiveView', id); } catch (error) { /* storage unavailable: keep working */ }
  };

  // Escape closes the open drawer, as in the admin workspace.
  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setMobileNavOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  const currentLabel = MENU_ITEMS.find(item => item.id === activeView)?.label || 'Dashboard';
  const userName = localStorage.getItem('userName') || 'Operator';

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <OperatorHome onOpenSection={handleSetActiveView} />;
      case 'departures':
        return <MyDepartures />;
      case 'bookings':
        return <MyBookings />;
      case 'itineraries':
        return <ItinerariesManager />;
      case 'messages':
        return <MessagesAnnouncements openBookingId={openBookingId} openAdminId={openAdminId} onAdminOpened={() => setOpenAdminId(null)} />;
      case 'profile':
        return <OperatorProfile />;
      default:
        return <OperatorHome onOpenSection={handleSetActiveView} />;
    }
  };

  const logout = () => {
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    try { localStorage.removeItem('operatorActiveView'); } catch (error) { /* ignore */ }
    navigate('/');
  };

  return (
    <div className="dark mesh-bg min-h-screen text-text">
      {/* Backdrop for the drawer on smaller screens */}
      {mobileNavOpen && (
        <div aria-hidden="true" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Sidebar: fixed on laptops, a solid drawer below the large breakpoint */}
      <aside
        aria-label="Operator navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface lg:glass-strong transition-transform duration-200 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-border px-5">
          <LuBus aria-hidden="true" className="h-7 w-7 flex-none text-brand" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold text-text">Operator Hub</p>
            <p className="text-xs text-text-muted">TripBloom</p>
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

        <nav aria-label="Operator sections" className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-5">
          {MENU_ITEMS.map(item => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSetActiveView(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-brand/15 text-text ring-1 ring-inset ring-brand/30' : 'text-text-muted hover:bg-surface-muted hover:text-text'
                }`}
              >
                <item.icon aria-hidden="true" className="h-4 w-4 flex-none" />
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-border p-4">
          {/* Leaving the workspace sits apart from the section links and above log out, so it is not hit by accident. */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          >
            <LuExternalLink aria-hidden="true" className="h-4 w-4" />
            <span>Main site</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
          >
            <LuLogOut aria-hidden="true" className="h-4 w-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main column: header, announcements and the current section */}
      <div className="min-h-screen min-w-0 lg:pl-72">
        <header className="glass-strong backdrop-blur-xl sticky top-0 z-20 flex h-20 items-center justify-between gap-4 border-b border-border px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(open => !open)}
              aria-label="Toggle navigation"
              aria-expanded={mobileNavOpen}
              className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-muted hover:text-text lg:hidden"
            >
              <LuMenu aria-hidden="true" className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-text-muted">Operator</p>
              <h1 className="truncate font-display text-xl font-bold text-text">{currentLabel}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter
              userId={localStorage.getItem('userId')}
              userRole="TOUR_OPERATOR"
              onOpenChat={(booking) => {
                setOpenBookingId(booking._id);
                handleSetActiveView('messages');
                setTimeout(() => setOpenBookingId(null), 100);
              }}
              onOpenAdminChat={(adminId) => {
                setOpenAdminId(adminId);
                handleSetActiveView('messages');
              }}
            />
            <p className="hidden truncate text-sm text-text-muted sm:block">{userName}</p>
          </div>
        </header>

        <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mb-6">
            <AnnouncementBanner userRole="OPERATORS" />
          </div>
          <div key={`${activeView}-${navVersion}`}>{renderContent()}</div>
        </main>
      </div>
    </div>
  );
};

export default OperatorDashboard;
