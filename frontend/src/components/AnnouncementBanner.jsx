import { LuBell, LuCircleCheck, LuInfo, LuTriangleAlert, LuX } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';
import axios from 'axios';


const AnnouncementBanner = ({ userRole = 'CUSTOMERS' }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
    // Load dismissed announcements from localStorage
    const dismissed = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
    setDismissedIds(dismissed);
  }, [userRole]);

  const fetchAnnouncements = async () => {
    try {
      const audience = userRole?.toUpperCase() || 'CUSTOMERS';
      const response = await axios.get(`/api/announcements?audience=${audience}`);
      setAnnouncements(response.data.announcements || []);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    }
    setLoading(false);
  };

  const handleDismiss = (announcementId) => {
    const newDismissed = [...dismissedIds, announcementId];
    setDismissedIds(newDismissed);
    localStorage.setItem('dismissedAnnouncements', JSON.stringify(newDismissed));
  };

  const getTypeIcon = (type) => {
    const icons = {
      INFO: LuInfo,
      WARNING: LuTriangleAlert,
      SUCCESS: LuCircleCheck,
      ERROR: LuX,
      MAINTENANCE: LuBell
    };
    return icons[type] || LuInfo;
  };

  const getTypeStyles = (type) => {
    const styles = {
      INFO: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
      WARNING: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300',
      SUCCESS: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300',
      ERROR: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
      MAINTENANCE: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300'
    };
    return styles[type] || styles.INFO;
  };

  const getPriorityOrder = (priority) => {
    const order = {
      URGENT: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4
    };
    return order[priority] || 3;
  };

  // Filter out dismissed announcements and sort by priority
  const activeAnnouncements = announcements
    .filter(a => !dismissedIds.includes(a._id))
    .sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority));

  if (loading || activeAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-2">
      {activeAnnouncements.map((announcement) => {
        const Icon = getTypeIcon(announcement.type);
        const styles = getTypeStyles(announcement.type);

        return (
          <div
            key={announcement._id}
            className={`relative border-l-4 rounded-lg p-4 shadow-sm ${styles}`}
            role="alert"
          >
            <div className="flex items-start gap-3">
              <Icon className="text-xl flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm mb-1">
                      {announcement.title}
                      {announcement.priority === 'URGENT' && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-red-600 text-white rounded-full animate-pulse">
                          URGENT
                        </span>
                      )}
                      {announcement.priority === 'HIGH' && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-orange-600 text-white rounded-full">
                          HIGH PRIORITY
                        </span>
                      )}
                    </h4>
                    <p className="text-sm leading-relaxed">
                      {announcement.message}
                    </p>
                    {announcement.endDate && (
                      <p className="text-xs mt-2 opacity-75">
                        Valid until {new Date(announcement.endDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDismiss(announcement._id)}
                    className="flex-shrink-0 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                    aria-label="Dismiss announcement"
                  >
                    <LuX aria-hidden="true" className="text-sm" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AnnouncementBanner;
