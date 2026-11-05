import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LuBus, LuCalendarDays, LuTriangleAlert, LuUsers } from 'react-icons/lu';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import { homeFigures } from '../utils/operatorFigures.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_TONE = { OPEN: 'success', FULL: 'warning', CLOSED: 'neutral', CANCELLED: 'danger' };

const shortDate = value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Summary tile: one figure with its label. Every value is computed from the operator's departures.
function Tile({ icon: Icon, label, value, footnote }) {
  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/10">
          <Icon aria-hidden="true" className="h-5 w-5 text-brand" />
        </span>
        <p className="text-sm font-medium text-text-muted">{label}</p>
      </div>
      <p className="font-display text-3xl font-semibold text-text">{value}</p>
      {footnote && <p className="text-xs text-text-muted">{footnote}</p>}
    </div>
  );
}

// The operator's home: greeting, figures, the next seven days, today's departures and alerts.
export default function OperatorHome({ onOpenSection }) {
  const operatorId = localStorage.getItem('userId');
  const [departures, setDepartures] = useState([]);
  const [operatorName, setOperatorName] = useState(localStorage.getItem('userName') || 'Operator');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/operator/${operatorId}/dashboard`);
      if (!response.ok) throw new Error(`Dashboard request failed with status ${response.status}`);
      const data = await response.json();
      if (data.profile?.fullName) {
        setOperatorName(data.profile.fullName);
        localStorage.setItem('userName', data.profile.fullName);
      }
      setDepartures(Array.isArray(data.groupDepartures) ? data.groupDepartures : []);
    } catch (failure) {
      console.error('Failed to load operator home:', failure);
      setError('Your departures could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const figures = useMemo(() => homeFigures(departures, now), [departures]);
  const weekTotal = figures.week.reduce((sum, day) => sum + day.count, 0);
  const firstName = (operatorName || 'Operator').split(' ')[0];

  // Alerts use the same rules as before; each one opens the section where the operator can act on it.
  const alerts = useMemo(() => {
    const list = [];
    const within24h = departures.filter(d => {
      const ahead = new Date(d.startDate) - new Date();
      return ahead > 0 && ahead < DAY_MS;
    });
    if (within24h.length) list.push({ id: 'soon', tone: 'warning', message: `${within24h.length} departure(s) start within 24 hours. Check the itinerary is ready.`, section: 'departures' });
    const cancelledToday = figures.todayDepartures.filter(d => d.status === 'CANCELLED');
    if (cancelledToday.length) list.push({ id: 'cancelled', tone: 'danger', message: `${cancelledToday.length} departure(s) cancelled today by the administrator.`, section: 'departures' });
    const lowToday = figures.todayDepartures.filter(d => d.totalSeats > 0 && d.bookedSeats < d.totalSeats * 0.3);
    if (lowToday.length) list.push({ id: 'low', tone: 'info', message: `${lowToday.length} departure(s) today are under 30% booked.`, section: 'departures' });
    return list;
  }, [departures, figures.todayDepartures]);

  if (loading) {
    return (
      <div className="space-y-6" aria-live="polite">
        <p className="sr-only">Loading your dashboard…</p>
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}</div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) return <ErrorState title="Dashboard unavailable" message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold text-text sm:text-3xl">Welcome back, {firstName}</h2>
        <p className="mt-1 text-sm text-text-muted">Here is your schedule for today and the next seven days.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile icon={LuCalendarDays} label="Departures today" value={figures.todayDepartures.length} />
        <Tile icon={LuUsers} label="Next seven days" value={weekTotal} footnote="Departures starting in the next seven days" />
        <Tile icon={LuBus} label="Assigned departures" value={figures.assignedCount} />
      </div>

      {alerts.length > 0 && (
        <section aria-labelledby="operator-alerts-heading" className="space-y-3">
          <h3 id="operator-alerts-heading" className="font-display text-base font-semibold text-text">Needs your attention</h3>
          <ul className="space-y-2">
            {alerts.map(alert => (
              <li key={alert.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                <p className="flex items-start gap-3 text-sm text-text">
                  <LuTriangleAlert aria-hidden="true" className={`mt-0.5 h-4 w-4 flex-none ${alert.tone === 'danger' ? 'text-danger' : alert.tone === 'warning' ? 'text-warning' : 'text-info'}`} />
                  <span>{alert.message}</span>
                </p>
                <Button size="sm" variant="secondary" onClick={() => onOpenSection && onOpenSection(alert.section)}>Open departures</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="operator-week-heading" className="space-y-3">
        <h3 id="operator-week-heading" className="font-display text-base font-semibold text-text">Next seven days</h3>
        <ol className="grid grid-cols-7 gap-2">
          {figures.week.map((day, index) => (
            <li key={day.key} className={`glass flex flex-col items-center rounded-2xl p-2 text-center ${index === 0 ? 'ring-1 ring-brand/50' : ''}`}>
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{day.date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="mt-1 font-display text-base font-semibold text-text">{day.date.getDate()}</span>
              <span className={`mt-1 text-xs font-semibold ${day.count ? 'text-brand' : 'text-text-muted'}`}>{day.count}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="operator-today-heading" className="space-y-3">
        <h3 id="operator-today-heading" className="font-display text-base font-semibold text-text">Today</h3>
        {figures.todayDepartures.length === 0 ? (
          <EmptyState title="No departures today" description="Your upcoming departures are listed under My Departures." />
        ) : (
          <ul className="space-y-2">
            {figures.todayDepartures.map(dep => (
              <li key={dep._id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text">{dep.packageId?.title || 'Group departure'}</p>
                  <p className="text-sm text-text-muted">{shortDate(dep.startDate)} – {shortDate(dep.endDate || dep.startDate)} · {dep.bookedSeats ?? 0}/{dep.totalSeats ?? 0} seats booked</p>
                </div>
                <Badge tone={STATUS_TONE[dep.status] || 'neutral'}>{dep.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
