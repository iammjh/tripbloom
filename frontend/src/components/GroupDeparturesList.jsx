import { LuArrowRight, LuCalendar, LuCircleCheck, LuCircleX, LuClock, LuEye, LuFilter, LuLayoutGrid, LuList, LuMapPin, LuPencil, LuPlus, LuSearch, LuTable, LuTrash2, LuTriangleAlert, LuUserCog, LuUsers } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AdminTable, thClass, tdClass } from './admin/AdminPrimitives.jsx';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import IconButton from './ui/IconButton.jsx';


const STATUS_TONE = { OPEN: 'success', FULL: 'warning', CLOSED: 'neutral', CANCELLED: 'danger' };

const GroupDeparturesList = ({ onViewDetails, onCreateDeparture, onEditDeparture, onDeleteDeparture }) => {
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ status: '', packageId: '' });
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDepartures();
  }, [filter]);

  const fetchDepartures = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/group-departures', { params: filter });
      // Sort departures by upcoming close event date (startDate ascending)
      const sortedDepartures = (res.data.departures || []).sort((a, b) => {
        return new Date(a.startDate) - new Date(b.startDate);
      });
      setDepartures(sortedDepartures);
    } catch (err) {
      console.error('Failed to fetch departures:', err);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      OPEN: 'text-success bg-success/10',
      FULL: 'text-warning bg-warning/10',
      CANCELLED: 'text-danger bg-danger/10',
      CLOSED: 'text-text-muted bg-surface-muted'
    };
    return colors[status] || 'text-info bg-info/10';
  };

  const getCapacityBarColor = (bookedSeats, totalSeats) => {
    const percentage = (bookedSeats / totalSeats) * 100;
    if (bookedSeats > totalSeats) return 'bg-danger'; // Overbooking
    if (percentage >= 90) return 'bg-warning';
    if (percentage >= 70) return 'bg-warning';
    return 'bg-success';
  };

  const isStartingSoon = (startDate) => {
    const start = new Date(startDate);
    const now = new Date();
    const hoursUntilStart = (start - now) / (1000 * 60 * 60);
    return hoursUntilStart < 24 && hoursUntilStart > 0;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getDaysUntilStart = (startDate) => {
    const start = new Date(startDate);
    const now = new Date();
    const days = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    return days;
  };

  // Everything the list view shows about one departure, derived once per row.
  const flagsFor = (departure) => {
    const totalSeats = Number(departure.totalSeats) || 0;
    const bookedSeats = Number(departure.bookedSeats) || 0;
    const percent = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;
    const days = getDaysUntilStart(departure.startDate);
    const operatorCount = departure.operators?.length || 0;
    let timing = 'Already started';
    if (days === 0) timing = 'Starts today';
    else if (days > 0) timing = `Starts in ${days} day${days === 1 ? '' : 's'}`;
    return {
      percent,
      fill: Math.min(percent, 100),
      timing,
      startsSoon: days >= 0 && days <= 7,
      overbooked: bookedSeats > totalSeats,
      noOperator: operatorCount === 0,
      operatorCount,
    };
  };

  const filteredDepartures = departures.filter(dep => {
    const matchesSearch = !searchTerm || 
      dep.packageId?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="bg-gradient-to-br from-surface to-surface rounded-2xl shadow-2xl p-6 border border-border">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center">
            <LuCalendar aria-hidden="true" className="mr-3 text-info" />
            Group Departures
          </h2>
          <p className="text-text-muted mt-1">
            Manage upcoming tour group departures
          </p>
        </div>
        <button 
          onClick={() => onCreateDeparture && onCreateDeparture()}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-info to-info text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all font-semibold"
        >
          <LuPlus aria-hidden="true" />
          <span>Create New Departure</span>
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <LuSearch aria-hidden="true" className="absolute left-3 top-3 text-text-muted" />
          <input
            type="text"
            placeholder="Search by package name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-surface text-text focus:ring-2 focus:ring-brand"
          />
        </div>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-4 py-2 border border-border rounded-lg bg-surface text-text focus:ring-2 focus:ring-brand"
        >
          <option value="">All Status</option>
          <option value="OPEN">Open</option>
          <option value="FULL">Full</option>
          <option value="CLOSED">Closed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'cards'
                ? 'bg-brand text-white'
                : 'bg-surface-muted text-text-muted'
            }`}
            title="Card View"
          >
            <LuLayoutGrid aria-hidden="true" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'table'
                ? 'bg-brand text-white'
                : 'bg-surface-muted text-text-muted'
            }`}
            title="Table View"
          >
            <LuTable aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' && filteredDepartures.length > 0 && (
        <ul aria-label="Group departures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredDepartures.map((departure) => {
            const flags = flagsFor(departure);
            const operators = departure.operators || [];
            const leadOperator = operators[0]?.operatorId?.fullName || 'Operator';
            const destination = departure.packageId?.destinations?.[0]?.name;
            const fillClass = flags.overbooked ? 'bg-danger' : getCapacityBarColor(departure.bookedSeats, departure.totalSeats);

            return (
              <li
                key={departure._id}
                className={`glass flex flex-col overflow-hidden rounded-2xl transition-transform duration-200 hover:-translate-y-0.5 ${
                  flags.overbooked ? 'border-danger/50' : flags.noOperator ? 'border-warning/50' : ''
                }`}
              >
                {/* Title, route and status */}
                <div className="flex items-start justify-between gap-3 p-5 pb-0">
                  <div className="min-w-0">
                    {destination && (
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                        <LuMapPin aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
                        <span className="truncate">{destination}</span>
                      </p>
                    )}
                    <h3 className="mt-1.5 truncate font-display text-lg font-semibold text-text" title={departure.packageId?.title || ''}>
                      {departure.packageId?.title || 'Package'}
                    </h3>
                    {departure.packageId?.defaultDays && (
                      <p className="mt-0.5 text-sm text-text-muted">{departure.packageId.defaultDays} days</p>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[departure.status] || 'neutral'}>{departure.status}</Badge>
                </div>

                {/* Dates */}
                <div className="mx-5 mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-surface-muted p-3">
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Starts</p>
                    <p className="text-sm font-semibold text-text">{formatDate(departure.startDate)}</p>
                  </div>
                  <LuArrowRight aria-hidden="true" className="h-4 w-4 text-text-muted" />
                  <div className="min-w-0 text-right">
                    <p className="text-xs text-text-muted">Ends</p>
                    <p className="text-sm font-semibold text-text">{formatDate(departure.endDate)}</p>
                  </div>
                </div>
                <p className={`mx-5 mt-2 text-xs ${flags.startsSoon ? 'font-semibold text-warning' : 'text-text-muted'}`}>{flags.timing}</p>

                {/* Seats */}
                <div className="mx-5 mt-4">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-text">Seats booked</span>
                    <span className={`font-semibold ${flags.overbooked ? 'text-danger' : 'text-text'}`}>
                      {departure.bookedSeats}/{departure.totalSeats}
                      <span className="ml-1.5 text-xs font-normal text-text-muted">{flags.percent}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted" role="presentation">
                    <div className={`h-full rounded-full transition-all ${fillClass}`} style={{ width: `${flags.fill}%` }} />
                  </div>
                  {flags.overbooked && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-danger">
                      <LuTriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
                      Overbooked by {departure.bookedSeats - departure.totalSeats} seat{departure.bookedSeats - departure.totalSeats === 1 ? '' : 's'}
                    </p>
                  )}
                </div>

                {/* Operators */}
                <div className="mx-5 mb-5 mt-4 rounded-xl border border-border p-3">
                  <p className="mb-2 text-xs text-text-muted">Operators</p>
                  {flags.operatorCount > 0 ? (
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {operators.slice(0, 3).map((op, idx) => (
                          <span
                            key={idx}
                            title={op.operatorId?.fullName || 'Operator'}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-warning text-xs font-bold text-white ring-2 ring-surface"
                          >
                            {(op.operatorId?.fullName || 'O').charAt(0)}
                          </span>
                        ))}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text">{leadOperator}</p>
                        <p className="text-xs text-text-muted">
                          {flags.operatorCount > 1 ? `and ${flags.operatorCount - 1} more` : 'Assigned operator'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-sm font-semibold text-warning">
                      <LuTriangleAlert aria-hidden="true" className="h-4 w-4 flex-none" />
                      No operator assigned
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-auto flex items-center gap-2 border-t border-border p-4">
                  <Button size="md" variant="secondary" icon={LuEye} className="flex-1" onClick={() => onViewDetails && onViewDetails(departure)}>View</Button>
                  <IconButton label="Edit Departure" icon={LuPencil} onClick={() => onEditDeparture && onEditDeparture(departure)} />
                  <IconButton label="Delete Departure" icon={LuTrash2} variant="danger" onClick={() => onDeleteDeparture && onDeleteDeparture(departure)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Table View */}
      {viewMode === 'table' && filteredDepartures.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-surface-muted px-3 py-1 font-semibold text-text">
              {filteredDepartures.length} {filteredDepartures.length === 1 ? 'departure' : 'departures'}
            </span>
            {filteredDepartures.some(dep => flagsFor(dep).noOperator) && (
              <Badge tone="warning" icon={LuUserCog}>
                {filteredDepartures.filter(dep => flagsFor(dep).noOperator).length} without an operator
              </Badge>
            )}
            {filteredDepartures.some(dep => flagsFor(dep).overbooked) && (
              <Badge tone="danger" icon={LuTriangleAlert}>
                {filteredDepartures.filter(dep => flagsFor(dep).overbooked).length} overbooked
              </Badge>
            )}
          </div>

          <AdminTable label="Group departures" minWidth={1000}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Package</th>
                <th scope="col" className={thClass}>Dates</th>
                <th scope="col" className={thClass}>Capacity</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={thClass}>Operators</th>
                <th scope="col" className={`${thClass} text-right`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartures.map((departure) => {
                const flags = flagsFor(departure);
                const leadOperator = departure.operators?.[0]?.operatorId?.fullName || 'Operator';
                return (
                  <tr key={departure._id} className="transition-colors hover:bg-surface-muted/60">
                    <td className={`${tdClass} border-l-4 ${flags.noOperator ? 'border-l-warning' : 'border-l-transparent'}`}>
                      <div className="font-semibold text-text">{departure.packageId?.title || 'Package'}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                        <span className="inline-flex items-center gap-1">
                          <LuMapPin aria-hidden="true" className="h-3.5 w-3.5" />
                          {departure.packageId?.destinations?.[0]?.name || 'Destination not set'}
                        </span>
                        {departure.packageId?.defaultDays && <span>{departure.packageId.defaultDays} days</span>}
                      </div>
                    </td>

                    <td className={`${tdClass} whitespace-nowrap`}>
                      <div className="font-medium text-text">{formatDate(departure.startDate)} – {formatDate(departure.endDate)}</div>
                      <div className={`mt-0.5 inline-flex items-center gap-1 text-xs ${flags.startsSoon ? 'font-semibold text-warning' : 'text-text-muted'}`}>
                        {flags.startsSoon && <LuClock aria-hidden="true" className="h-3.5 w-3.5" />}
                        {flags.timing}
                      </div>
                    </td>

                    <td className={`${tdClass} min-w-[180px]`}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className={`font-semibold ${flags.overbooked ? 'text-danger' : 'text-text'}`}>
                          {departure.bookedSeats}/{departure.totalSeats} seats
                        </span>
                        <span className="text-text-muted">{flags.percent}%</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-muted" role="presentation">
                        <div
                          className={`h-full rounded-full transition-all ${getCapacityBarColor(departure.bookedSeats, departure.totalSeats)}`}
                          style={{ width: `${flags.fill}%` }}
                        />
                      </div>
                      {flags.overbooked && (
                        <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-danger">
                          <LuTriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
                          Overbooked
                        </div>
                      )}
                    </td>

                    <td className={tdClass}>
                      <Badge tone={STATUS_TONE[departure.status] || 'neutral'}>{departure.status}</Badge>
                    </td>

                    <td className={tdClass}>
                      {flags.operatorCount > 0 ? (
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            {departure.operators.slice(0, 3).map((op, idx) => (
                              <span
                                key={idx}
                                title={op.operatorId?.fullName || 'Operator'}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-warning text-xs font-bold text-white ring-2 ring-surface"
                              >
                                {(op.operatorId?.fullName || 'O').charAt(0)}
                              </span>
                            ))}
                          </div>
                          <div className="min-w-0 text-sm">
                            <div className="truncate text-text">{leadOperator}</div>
                            {flags.operatorCount > 1 && <div className="text-xs text-text-muted">+{flags.operatorCount - 1} more</div>}
                          </div>
                        </div>
                      ) : (
                        <Badge tone="warning" icon={LuTriangleAlert}>No operator</Badge>
                      )}
                    </td>

                    <td className={`${tdClass} text-right`}>
                      <div className="inline-flex items-center justify-end gap-1">
                        <IconButton label="View Details" icon={LuEye} onClick={() => onViewDetails && onViewDetails(departure)} />
                        <IconButton label="Edit Departure" icon={LuPencil} onClick={() => onEditDeparture && onEditDeparture(departure)} />
                        <IconButton label="Delete Departure" icon={LuTrash2} variant="danger" onClick={() => onDeleteDeparture && onDeleteDeparture(departure)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        </div>
      )}

      {/* Empty State */}
      {filteredDepartures.length === 0 && !loading && (
        <div className="text-center py-16">
          <LuCalendar aria-hidden="true" className="mx-auto text-6xl text-text mb-4" />
          <h3 className="text-xl font-semibold text-text-muted mb-2">
            No Departures Found
          </h3>
          <p className="text-text-muted mb-6">
            {searchTerm || filter.status 
              ? 'Try adjusting your filters'
              : 'Create your first group departure to get started'}
          </p>
          <button className="px-6 py-3 bg-gradient-to-r from-info to-info text-white rounded-xl hover:shadow-lg transition-all font-semibold">
            <LuPlus aria-hidden="true" className="inline mr-2" />
            Create First Departure
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-brand font-semibold">Loading...</div>
      )}
    </div>
  );
};

export default GroupDeparturesList;
