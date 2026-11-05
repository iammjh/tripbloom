import { LuCalendar, LuChevronLeft, LuChevronRight, LuCircle, LuClock, LuMapPin, LuPlus, LuUsers } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';
import axios from 'axios';


const GroupDeparturesCalendar = ({ onCreateDeparture }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchDepartures();
  }, [currentDate]);

  const fetchDepartures = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const res = await axios.get('/api/admin/group-departures', {
        params: {
          startDate: startOfMonth.toISOString(),
          endDate: endOfMonth.toISOString()
        }
      });
      setDepartures(res.data.departures || []);
    } catch (err) {
      console.error('Failed to fetch departures:', err);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      OPEN: 'bg-success',
      FULL: 'bg-warning',
      CANCELLED: 'bg-danger',
      CLOSED: 'bg-text-muted'
    };
    return colors[status] || 'bg-info';
  };

  const getDeparturesForDay = (day) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
    return departures.filter(dep => {
      const depDate = new Date(dep.startDate).toISOString().split('T')[0];
      return depDate === dateStr;
    });
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleDayHover = (day, event) => {
    const dayDepartures = getDeparturesForDay(day);
    if (dayDepartures.length > 0) {
      setHoveredDay(day);
      setHoverPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="bg-gradient-to-br from-surface to-surface rounded-2xl shadow-2xl p-4 border border-border">
      {/* Compact Header with Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <LuCalendar aria-hidden="true" className="mr-2 text-info" />
            Departures Calendar
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Create Button */}
          <button
            onClick={() => onCreateDeparture && onCreateDeparture()}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-info to-info text-white rounded-lg hover:shadow-lg transform hover:scale-105 transition-all font-semibold"
          >
            <LuPlus aria-hidden="true" />
            <span>Create Departure</span>
          </button>
          
          {/* Compact Month Navigation */}
          <div className="flex items-center bg-surface-muted rounded-lg shadow-md border border-border px-1 py-1">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-info/10 rounded-md transition-all"
              title="Previous Month"
            >
              <LuChevronLeft aria-hidden="true" className="text-info" />
            </button>
            <span className="text-lg font-bold text-white px-4">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-info/10 rounded-md transition-all"
              title="Next Month"
            >
              <LuChevronRight aria-hidden="true" className="text-info" />
            </button>
          </div>
        </div>
      </div>

      {/* Compact Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-muted rounded-lg px-3 py-2 shadow-sm border border-border mb-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center space-x-1">
            <LuCircle aria-hidden="true" className="text-success text-[8px]" />
            <span className="text-xs font-medium text-text">Open</span>
          </div>
          <div className="flex items-center space-x-1">
            <LuCircle aria-hidden="true" className="text-warning text-[8px]" />
            <span className="text-xs font-medium text-text">Full</span>
          </div>
          <div className="flex items-center space-x-1">
            <LuCircle aria-hidden="true" className="text-danger text-[8px]" />
            <span className="text-xs font-medium text-text">Cancelled</span>
          </div>
          <div className="flex items-center space-x-1">
            <LuCircle aria-hidden="true" className="text-text-muted text-[8px]" />
            <span className="text-xs font-medium text-text">Closed</span>
          </div>
        </div>
        <div className="text-xs text-text-muted flex items-center">
          <LuClock aria-hidden="true" className="mr-1 text-[10px]" />
          {departures.length} departures
        </div>
      </div>

      {/* Compact Calendar Grid */}
      <div className="bg-surface rounded-lg shadow-md border border-border overflow-hidden">
        <div className="grid grid-cols-7 gap-0 border-b border-border">
          {/* Compact Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div 
              key={day} 
              className="text-center text-xs font-bold text-text py-2 bg-gradient-to-b from-surface to-surface border-r border-border last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0">
          {/* Empty cells for days before month starts */}
          {[...Array(firstDayOfMonth)].map((_, i) => (
            <div 
              key={`empty-${i}`} 
              className="h-16 bg-surface border-r border-b border-border"
            ></div>
          ))}

          {/* Compact Calendar days */}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            const dayDepartures = getDeparturesForDay(day);
            const today = new Date();
            const isToday = today.getDate() === day && 
                           today.getMonth() === currentDate.getMonth() && 
                           today.getFullYear() === currentDate.getFullYear();

            return (
              <div
                key={day}
                onMouseEnter={(e) => handleDayHover(day, e)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`h-16 border-r border-b border-border p-1.5 transition-all cursor-pointer relative group ${
                  isToday 
                    ? 'bg-gradient-to-br from-info/50 to-info/50' 
                    : 'bg-surface hover:bg-surface-muted'
                }`}
              >
                {/* Compact Day number */}
                <div className={`text-xs font-bold mb-1 ${
                  isToday 
                    ? 'text-info' 
                    : 'text-white'
                }`}>
                  {day}
                  {isToday && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-brand rounded-full animate-pulse"></div>
                  )}
                </div>

                {/* Compact Departure indicators */}
                {dayDepartures.length > 0 && (
                  <div className="space-y-0.5">
                    {dayDepartures.slice(0, 2).map((dep, idx) => (
                      <div
                        key={idx}
                        className={`w-full h-1.5 rounded-sm ${getStatusColor(dep.status)}`}
                        title={dep.packageId?.name || 'Package'}
                      ></div>
                    ))}
                    {dayDepartures.length > 2 && (
                      <div className="text-[9px] text-center font-bold bg-surface-muted text-text rounded-sm py-0.5">
                        +{dayDepartures.length - 2}
                      </div>
                    )}
                  </div>
                )}

                {/* Hover effect border */}
                <div className="absolute inset-0 border-2 border-info/30 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enhanced Hover Popup */}
      {hoveredDay && getDeparturesForDay(hoveredDay).length > 0 && (
        <div
          className="fixed z-50 bg-surface rounded-xl shadow-2xl border-2 border-info/30 p-4 max-w-md animate-fade-in"
          style={{ 
            left: Math.min(hoverPosition.x + 10, window.innerWidth - 400), 
            top: hoverPosition.y + 10 
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-border">
            <div className="font-bold text-lg text-white flex items-center">
              <LuCalendar aria-hidden="true" className="mr-2 text-info" />
              {monthNames[currentDate.getMonth()]} {hoveredDay}, {currentDate.getFullYear()}
            </div>
            <div className="text-xs bg-info/10 text-info px-2 py-1 rounded-full font-semibold">
              {getDeparturesForDay(hoveredDay).length} Departure{getDeparturesForDay(hoveredDay).length !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {getDeparturesForDay(hoveredDay).map((dep, idx) => (
                <div className="bg-surface-muted rounded-lg p-3 border border-border hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-white mb-1">
                      {dep.packageId?.title || 'Package'}
                    </div>
                    <div className="flex items-center text-xs text-text-muted">
                      <LuMapPin aria-hidden="true" className="mr-1" />
                      {dep.packageId?.destinations?.[0]?.name || 'Destination'}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold text-white ${getStatusColor(dep.status)}`}>
                    {dep.status}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-3 mt-2 pt-2 border-t border-border">
                  <div className="flex items-center text-xs text-text">
                    <LuUsers aria-hidden="true" className="mr-1 text-info" />
                    <span className="font-semibold">{dep.bookedSeats}/{dep.totalSeats}</span>
                    <span className="ml-1">seats</span>
                  </div>
                  <div className="w-24 h-2 bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${dep.bookedSeats > dep.totalSeats ? 'bg-danger' : 'bg-success'}`}
                      style={{ width: `${Math.min((dep.bookedSeats / dep.totalSeats) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-surface/50 flex items-center justify-center rounded-2xl">
          <div className="text-brand font-semibold">Loading...</div>
        </div>
      )}
    </div>
  );
};

export default GroupDeparturesCalendar;
