import { LuBell, LuBus, LuCalendar, LuCircleCheck, LuClock, LuCloudRain, LuMapPin, LuPlay, LuTriangleAlert, LuUsers } from 'react-icons/lu';
import { ChecklistIcon, AnnouncementIcon } from '../components/ui/icons.js';
import React, { useState, useEffect } from 'react';


const OperatorHome = () => {
  const operatorId = localStorage.getItem('userId');
  const [todayDepartures, setTodayDepartures] = useState([]);
  const [next7Days, setNext7Days] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [operatorName, setOperatorName] = useState('Operator');

  useEffect(() => {
    fetchDashboardData();
  }, [operatorId]);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`/api/operator/${operatorId}/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      
      // Set operator name from profile
      if (data.profile && data.profile.fullName) {
        setOperatorName(data.profile.fullName);
        localStorage.setItem('userName', data.profile.fullName);
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);

      // Filter today's departures
      const todayList = (data.groupDepartures || []).filter(dep => {
        const depStart = new Date(dep.startDate);
        depStart.setHours(0, 0, 0, 0);
        return depStart.getTime() === today.getTime();
      });

      // Group next 7 days
      const weekData = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(today);
        day.setDate(day.getDate() + i);
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        
        const count = (data.groupDepartures || []).filter(dep => {
          const depStart = new Date(dep.startDate);
          depStart.setHours(0, 0, 0, 0);
          return depStart.getTime() === dayStart.getTime();
        }).length;

        weekData.push({
          date: day,
          count,
          day: day.toLocaleDateString('en-US', { weekday: 'short' }),
          dateNum: day.getDate()
        });
      }

      setTodayDepartures(todayList);
      setNext7Days(weekData);
      
      // Generate alerts
      generateAlerts(todayList, data.groupDepartures || []);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setLoading(false);
    }
  };

  const generateAlerts = (today, all) => {
    const alertsList = [];
    
    // Check for departures within 24h without itinerary
    const upcoming24h = all.filter(dep => {
      const diff = new Date(dep.startDate) - new Date();
      return diff > 0 && diff < 24 * 60 * 60 * 1000;
    });
    
    if (upcoming24h.length > 0) {
      alertsList.push({
        type: 'warning',
        icon: LuTriangleAlert,
        message: `${upcoming24h.length} departure(s) within 24h - verify itinerary uploaded`,
        action: 'View Departures',
        actionLink: '/operator/departures'
      });
    }

    // Cancelled departures today
    const cancelledToday = today.filter(d => d.status === 'CANCELLED');
    if (cancelledToday.length > 0) {
      alertsList.push({
        type: 'error',
        icon: LuTriangleAlert,
        message: `${cancelledToday.length} departure(s) cancelled today by admin`,
        action: 'View Details',
        actionLink: '/operator/departures'
      });
    }

    // Low seat booking
    const lowSeats = today.filter(d => d.bookedSeats < d.totalSeats * 0.3);
    if (lowSeats.length > 0) {
      alertsList.push({
        type: 'info',
        icon: LuUsers,
        message: `${lowSeats.length} departure(s) with low booking - under 30% capacity`,
        action: 'View Details',
        actionLink: '/operator/departures'
      });
    }

    setAlerts(alertsList);
  };

  const getStatusBadge = (status, bookedSeats, totalSeats) => {
    if (status === 'CANCELLED') {
      return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: 'CANCELLED' };
    }
    if (bookedSeats >= totalSeats) {
      return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', label: 'FULL' };
    }
    if (status === 'OPEN') {
      return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: 'ON TIME' };
    }
    return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: status };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Today's Departures */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <LuBus aria-hidden="true" className="mr-3 text-orange-600" />
            Today's Departures
          </h2>
          <span className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full font-semibold">
            {todayDepartures.length} tour{todayDepartures.length !== 1 ? 's' : ''}
          </span>
        </div>

        {todayDepartures.length === 0 ? (
          <div className="text-center py-12">
            <LuCircleCheck aria-hidden="true" className="text-6xl text-green-500 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No trips today</p>
            <p className="text-gray-500 dark:text-gray-400">
              {next7Days.find(d => d.count > 0) 
                ? `Next trip starts on ${next7Days.find(d => d.count > 0).date.toLocaleDateString()}`
                : 'No upcoming trips scheduled'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {todayDepartures.map((dep, idx) => {
              const badge = getStatusBadge(dep.status, dep.bookedSeats, dep.totalSeats);
              const fillPercent = (dep.bookedSeats / dep.totalSeats) * 100;
              
              return (
                <div 
                  key={idx}
                  className="p-5 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-gray-700 dark:to-gray-700 rounded-xl border-l-4 border-orange-500 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                        {dep.packageId?.title || 'Tour Package'}
                      </h3>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center">
                          <LuClock aria-hidden="true" className="mr-2 text-orange-600" />
                          {new Date(dep.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                          {new Date(dep.endDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center">
                          <LuMapPin aria-hidden="true" className="mr-2 text-orange-600" />
                          {dep.packageId?.destination || 'Meeting Point TBD'}
                        </span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Seat Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300 font-semibold">
                        {dep.bookedSeats} / {dep.totalSeats} seats booked
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {fillPercent.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          fillPercent >= 90 ? 'bg-green-500' :
                          fillPercent >= 50 ? 'bg-blue-500' :
                          'bg-orange-500'
                        }`}
                        style={{ width: `${Math.min(fillPercent, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors">
                      View Details
                    </button>
                    <button className="flex items-center bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors">
                      <LuPlay aria-hidden="true" className="mr-2" />
                      Start Tour
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Next 7 Days Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <LuCalendar aria-hidden="true" className="mr-3 text-blue-600" />
          Next 7 Days
        </h2>
        
        <div className="grid grid-cols-7 gap-3">
          {next7Days.map((day, idx) => {
            const isToday = idx === 0;
            return (
              <div 
                key={idx}
                className={`text-center p-4 rounded-xl cursor-pointer transition-all ${
                  isToday 
                    ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500' 
                    : day.count > 0
                      ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  {day.day}
                </div>
                <div className={`text-2xl font-bold mb-2 ${
                  isToday ? 'text-orange-600' : 'text-gray-900 dark:text-white'
                }`}>
                  {day.dateNum}
                </div>
                {day.count > 0 ? (
                  <div className="flex items-center justify-center">
                    <LuBus aria-hidden="true" className="text-blue-600 mr-1 text-xs" />
                    <span className="text-sm font-bold text-blue-600">{day.count}</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">-</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Alerts & Tasks */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <LuBell aria-hidden="true" className="mr-3 text-yellow-600" />
          Alerts & Tasks
          {alerts.length > 0 && (
            <span className="ml-3 px-3 py-1 bg-red-500 text-white text-xs rounded-full font-bold">
              {alerts.length}
            </span>
          )}
        </h2>

        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <LuCircleCheck aria-hidden="true" className="text-5xl text-green-500 mx-auto mb-3 opacity-50" />
            <p className="text-gray-600 dark:text-gray-400">All clear! No pending alerts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, idx) => (
              <div 
                key={idx}
                className={`p-4 rounded-lg border-l-4 flex items-start justify-between ${
                  alert.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                  alert.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500' :
                  'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                }`}
              >
                <div className="flex items-start flex-1">
                  <alert.icon className={`mt-1 mr-3 ${
                    alert.type === 'error' ? 'text-red-600' :
                    alert.type === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                  <p className={`text-sm font-medium ${
                    alert.type === 'error' ? 'text-red-800 dark:text-red-300' :
                    alert.type === 'warning' ? 'text-yellow-800 dark:text-yellow-300' :
                    'text-blue-800 dark:text-blue-300'
                  }`}>
                    {alert.message}
                  </p>
                </div>
                <button className={`ml-4 px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  alert.type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' :
                  alert.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' :
                  'bg-blue-600 hover:bg-blue-700 text-white'
                }`}>
                  {alert.action}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white p-6 rounded-xl shadow-lg font-bold text-lg transition-all transform hover:scale-105">
          <ChecklistIcon aria-hidden="true" className="inline h-4 w-4 align-[-2px]" /> View Today's Passenger List
        </button>
        <button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-6 rounded-xl shadow-lg font-bold text-lg transition-all transform hover:scale-105">
          ▶️ Mark Tour as Started
        </button>
        <button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-6 rounded-xl shadow-lg font-bold text-lg transition-all transform hover:scale-105">
          <AnnouncementIcon aria-hidden="true" className="inline h-4 w-4 align-[-2px]" /> Send Broadcast Message
        </button>
      </div>
    </div>
  );
};

export default OperatorHome;
