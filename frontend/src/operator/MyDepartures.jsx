import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LuCalendarDays, LuFilter, LuSearch, LuTriangleAlert, LuUsers } from 'react-icons/lu';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import FormField, { inputClass } from '../components/ui/FormField.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import DepartureDetailPage from './DepartureDetailPage';
import { departureStatus, departureWarnings, filterDepartures, tourType } from '../utils/operatorDepartures.js';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const shortDate = value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// The operator's assigned group departures, with search, status and date filters.
const MyDepartures = () => {
  const operatorId = localStorage.getItem('userId');
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/operator/${operatorId}/dashboard`);
      if (!response.ok) throw new Error(`Departures request failed with status ${response.status}`);
      const data = await response.json();
      setDepartures(Array.isArray(data.groupDepartures) ? data.groupDepartures : []);
    } catch (failure) {
      console.error('Error fetching departures:', failure);
      setError('Your departures could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const visible = useMemo(() => filterDepartures(departures, { searchTerm, statusFilter, dateRange }, now), [departures, searchTerm, statusFilter, dateRange]);

  if (selectedDeparture) {
    return <DepartureDetailPage departure={selectedDeparture} onBack={() => setSelectedDeparture(null)} />;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted">Departures you are assigned to. Open one to see its guests, checklist and itinerary.</p>

      <section aria-label="Filter departures" className="glass grid gap-4 rounded-2xl p-4 md:grid-cols-2 xl:grid-cols-4">
        <FormField id="dep-search" label="Search">
          <div className="relative">
            <LuSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input id="dep-search" type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tour or destination" className={`${inputClass} pl-9`} />
          </div>
        </FormField>
        <FormField id="dep-status" label="Status">
          <select id="dep-status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputClass}>
            {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormField>
        <FormField id="dep-from" label="From">
          <input id="dep-from" type="date" value={dateRange.start} onChange={e => setDateRange(range => ({ ...range, start: e.target.value }))} className={inputClass} />
        </FormField>
        <FormField id="dep-to" label="To">
          <input id="dep-to" type="date" value={dateRange.end} onChange={e => setDateRange(range => ({ ...range, end: e.target.value }))} className={inputClass} />
        </FormField>
      </section>

      {loading && (
        <div className="space-y-3" aria-live="polite">
          <p className="sr-only">Loading departures…</p>
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      )}

      {!loading && error && <ErrorState title="Departures unavailable" message={error} onRetry={load} />}

      {!loading && !error && departures.length === 0 && (
        <EmptyState icon={LuCalendarDays} title="No departures assigned" description="When an administrator assigns you to a group departure, it appears here." />
      )}

      {!loading && !error && departures.length > 0 && visible.length === 0 && (
        <EmptyState icon={LuFilter} title="No departures match these filters" description="Clear the search or widen the dates." />
      )}

      {!loading && !error && visible.length > 0 && (
        <>
          <p className="text-sm text-text-muted">Showing {visible.length} of {departures.length} departures</p>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(dep => {
              const status = departureStatus(dep, now);
              const warnings = departureWarnings(dep, now);
              const assigned = (dep.operators || []).some(op => String(op.operatorId?._id || op.operatorId) === String(operatorId));
              const percent = dep.totalSeats > 0 ? Math.min(100, Math.round((dep.bookedSeats / dep.totalSeats) * 100)) : 0;
              return (
                <li key={dep._id} className={`glass flex flex-col gap-4 rounded-2xl p-5 ${warnings.includes('OVERBOOKED') ? 'border-danger/50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-semibold text-text">{dep.packageId?.title || 'Untitled tour'}</p>
                      <p className="truncate text-sm text-text-muted">{dep.packageId?.destination || 'No destination set'} · {tourType(dep)}</p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>

                  <p className="text-sm text-text">{shortDate(dep.startDate)} – {shortDate(dep.endDate)}</p>

                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 font-semibold text-text"><LuUsers aria-hidden="true" className="h-3.5 w-3.5" />Seats booked</span>
                      <span className={dep.bookedSeats > dep.totalSeats ? 'font-semibold text-danger' : 'text-text-muted'}>{dep.bookedSeats}/{dep.totalSeats} · {percent}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted" role="presentation">
                      <div className={`h-full rounded-full ${dep.bookedSeats > dep.totalSeats ? 'bg-danger' : 'bg-brand'}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {assigned && <Badge tone="success">You are assigned</Badge>}
                    {warnings.map(label => (
                      <span key={label} className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
                        <LuTriangleAlert aria-hidden="true" className="h-3 w-3" />{label}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex justify-end border-t border-border pt-4">
                    <Button size="md" variant="secondary" onClick={() => setSelectedDeparture(dep)}>Open departure</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default MyDepartures;
