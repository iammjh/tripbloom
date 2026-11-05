import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LuBook, LuFilter, LuSearch, LuUsers } from 'react-icons/lu';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import FormField, { inputClass } from '../components/ui/FormField.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import BookingDetailModal from './BookingDetailModal';
import { bookingLabel } from '../utils/bookingCode.js';
import { filterOperatorBookings, operatorBookingsFor, withOperatorNotes } from '../utils/operatorBookings.js';

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All types' },
  { value: 'GROUP', label: 'Group' },
  { value: 'PRIVATE', label: 'Private' },
];
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
];
const STATUS_TONE = { PENDING: 'warning', CONFIRMED: 'success', COMPLETED: 'info', CANCELLED: 'danger', REFUNDED: 'neutral' };

const shortDate = value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Bookings on the operator's group departures, with search, type, status and date filters.
const MyBookings = () => {
  const operatorId = localStorage.getItem('userId');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const departuresResponse = await fetch(`/api/operator/${operatorId}/dashboard`);
      if (!departuresResponse.ok) throw new Error('Departures request failed');
      const departuresData = await departuresResponse.json();
      const bookingsResponse = await fetch('/api/bookings');
      if (!bookingsResponse.ok) throw new Error('Bookings request failed');
      const bookingsData = await bookingsResponse.json();
      const departureIds = (departuresData.groupDepartures || []).map(d => d._id);
      setBookings(operatorBookingsFor(bookingsData.bookings || [], departureIds, operatorId));
    } catch (failure) {
      console.error('Error fetching bookings:', failure);
      setError('Your bookings could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => filterOperatorBookings(bookings, { searchTerm, typeFilter, statusFilter, dateRange }),
    [bookings, searchTerm, typeFilter, statusFilter, dateRange]
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted">Bookings on your group departures. Open one to add operator notes.</p>

      <section aria-label="Filter bookings" className="glass grid gap-4 rounded-2xl p-4 md:grid-cols-2 xl:grid-cols-5">
        <FormField id="book-search" label="Search" className="xl:col-span-2">
          <div className="relative">
            <LuSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input id="book-search" type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Customer, tour or booking code" className={`${inputClass} pl-9`} />
          </div>
        </FormField>
        <FormField id="book-type" label="Type">
          <select id="book-type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={inputClass}>
            {TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormField>
        <FormField id="book-status" label="Status">
          <select id="book-status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputClass}>
            {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormField>
        <FormField id="book-from" label="Start from">
          <input id="book-from" type="date" value={dateRange.start} onChange={e => setDateRange(range => ({ ...range, start: e.target.value }))} className={inputClass} />
        </FormField>
        <FormField id="book-to" label="Start to">
          <input id="book-to" type="date" value={dateRange.end} onChange={e => setDateRange(range => ({ ...range, end: e.target.value }))} className={inputClass} />
        </FormField>
      </section>

      {loading && (
        <div className="space-y-3" aria-live="polite">
          <p className="sr-only">Loading bookings…</p>
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      )}

      {!loading && error && <ErrorState title="Bookings unavailable" message={error} onRetry={load} />}

      {!loading && !error && bookings.length === 0 && (
        <EmptyState icon={LuBook} title="No bookings yet" description="Bookings on your group departures appear here." />
      )}

      {!loading && !error && bookings.length > 0 && visible.length === 0 && (
        <EmptyState icon={LuFilter} title="No bookings match these filters" description="Clear the search or widen the dates." />
      )}

      {!loading && !error && visible.length > 0 && (
        <>
          <p className="text-sm text-text-muted">Showing {visible.length} of {bookings.length} bookings</p>
          <ul className="space-y-3">
            {visible.map(booking => (
              <li key={booking._id} className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-brand">{bookingLabel(booking)}</span>
                    <Badge tone={STATUS_TONE[booking.status] || 'neutral'}>{booking.status}</Badge>
                  </div>
                  <p className="mt-1 truncate font-semibold text-text">{booking.packageId?.title || 'Tour'}</p>
                  <p className="truncate text-sm text-text-muted">
                    {booking.customerId?.fullName || 'Customer'} · {shortDate(booking.startDate)}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-text-muted">
                  <span className="inline-flex items-center gap-1"><LuUsers aria-hidden="true" className="h-4 w-4" />{booking.numTravelers ?? 0}</span>
                  <Button size="sm" variant="secondary" onClick={() => setSelectedBooking(booking)}>Open</Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdateNotes={(notes) => {
            setBookings(current => withOperatorNotes(current, selectedBooking._id, notes));
            setSelectedBooking(current => (current ? { ...current, operatorNotes: notes } : current));
          }}
        />
      )}
    </div>
  );
};

export default MyBookings;
