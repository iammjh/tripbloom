import { LuBook, LuBus, LuCalendarCheck, LuChartColumn, LuClipboardList, LuHouse, LuIdCard, LuLogOut, LuMessagesSquare, LuUser } from 'react-icons/lu';
import { StarIcon, BusIcon } from './ui/icons.js';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import OperatorHome from '../operator/OperatorHome';
import MyDepartures from '../operator/MyDepartures';
import MyBookings from '../operator/MyBookings';
import ItinerariesManager from '../operator/ItinerariesManager';
import MessagesAnnouncements from '../operator/MessagesAnnouncements';
import OperatorProfile from '../operator/OperatorProfile';
import NotificationCenter from './NotificationCenter';
import AnnouncementBanner from './AnnouncementBanner';

const OperatorDashboard = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Operator';
  const firstName = userName.split(' ')[0];
  
  const [activeView, setActiveView] = useState(() => {
    try {
      return localStorage.getItem('operatorActiveView') || 'dashboard';
    } catch (e) {
      return 'dashboard';
    }
  });
  const [openBookingId, setOpenBookingId] = useState(null);
  const [openAdminId, setOpenAdminId] = useState(null);

  const handleSetActiveView = (id) => {
    setActiveView(id);
    try { localStorage.setItem('operatorActiveView', id); } catch (e) { /* ignore */ }
  };

  const menuItems = [
    { id: 'dashboard', icon: LuHouse, label: 'Dashboard' },
    { id: 'departures', icon: LuBus, label: 'My Departures' },
    { id: 'bookings', icon: LuBook, label: 'My Bookings' },
    { id: 'itineraries', icon: LuClipboardList, label: 'Checklists' },
    { id: 'messages', icon: LuMessagesSquare, label: 'Messages' },
    { id: 'profile', icon: LuUser, label: 'Profile' }
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <OperatorHome />;
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
        return <OperatorHome />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-orange-600 to-orange-700 text-white p-6 shadow-2xl overflow-y-auto">
        <div className="flex items-center space-x-3 mb-8">
          <LuBus aria-hidden="true" className="text-3xl" />
          <h1 className="text-xl font-bold">Operator Hub</h1>
        </div>
        
        <nav className="space-y-2">
          <button
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all bg-green-600 hover:bg-green-700 mb-4"
            onClick={() => navigate('/')}
          >
            <LuChartColumn aria-hidden="true" />
            <span className="font-semibold">Main Site</span>
          </button>

          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSetActiveView(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                activeView === item.id
                  ? 'bg-white/20 backdrop-blur-md shadow-lg'
                  : 'hover:bg-white/10'
              }`}
            >
              <item.icon />
              <span className="font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>

        <button 
          onClick={() => {
            localStorage.removeItem('userName');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userId');
            try { localStorage.removeItem('operatorActiveView'); } catch (e) {}
            navigate('/');
          }}
          className="absolute bottom-6 left-6 right-6 flex items-center justify-center space-x-2 px-4 py-3 bg-white/20 backdrop-blur-md rounded-xl hover:bg-white/30 transition-all"
        >
          <LuLogOut aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        {/* Announcements Banner */}
        <div className="mb-6">
          <AnnouncementBanner userRole="OPERATORS" />
        </div>

        {/* Header: large welcome only on dashboard; compact title+controls on other views */}
        {activeView === 'dashboard' ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Welcome back, {firstName}! <BusIcon aria-hidden="true" className="inline h-4 w-4 align-[-2px]" />
                </h2>
              </div>
              <div className="flex items-center space-x-4">
                <NotificationCenter
                  userId={localStorage.getItem('userId')}
                  userRole="TOUR_OPERATOR"
                  onOpenChat={(booking, customer) => {
                    setOpenBookingId(booking._id);
                    handleSetActiveView('messages');
                    // Reset openBookingId after a short delay to allow MessagesAnnouncements to react
                    setTimeout(() => setOpenBookingId(null), 100);
                  }}
                  onOpenAdminChat={(adminId, adminName) => {
                    setOpenAdminId(adminId);
                    handleSetActiveView('messages');
                    // do not clear here; MessagesAnnouncements will call back when it opened the convo
                  }}
                />
                {/* AdminChat removed from header per request */}
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Current Rating</p>
                  <p className="text-3xl font-bold text-orange-600">4.9 <StarIcon aria-hidden="true" className="inline h-4 w-4 align-[-2px]" /></p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {menuItems.find(m => m.id === activeView)?.label || 'Dashboard'}
            </h2>
            <div className="flex items-center space-x-4">
              <NotificationCenter
                userId={localStorage.getItem('userId')}
                userRole="TOUR_OPERATOR"
                onOpenChat={(booking, customer) => {
                  setOpenBookingId(booking._id);
                  handleSetActiveView('messages');
                }}
                onOpenAdminChat={(adminId, adminName) => {
                  setOpenAdminId(adminId);
                  handleSetActiveView('messages');
                  setTimeout(() => setOpenAdminId(null), 100);
                }}
              />
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Current Rating</p>
                <p className="text-3xl font-bold text-orange-600">4.9 <StarIcon aria-hidden="true" className="inline h-4 w-4 align-[-2px]" /></p>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Content */}
        {renderContent()}
      </div>
    </div>
  );
};

export default OperatorDashboard;
