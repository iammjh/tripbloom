import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LuArrowLeft, LuBus, LuClipboardCheck, LuClock, LuMapPin, LuPlay, LuCircleCheck, LuUsers } from 'react-icons/lu';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import { confirmAction } from '../utils/confirmStore.js';
import { notify } from '../utils/notifyStore.js';
import { departureStatus, tourType } from '../utils/operatorDepartures.js';
import { EMPTY_SAFETY, attendanceCounts, isSafetyComplete, passengerRows } from '../utils/operatorDeparture.js';
import { buildSeatRows, toSeatPayload } from './departureState';
import PassengerList from './departure/PassengerList.jsx';
import SeatMapPanel from './departure/SeatMapPanel.jsx';
import ItineraryPanel from './departure/ItineraryPanel.jsx';
import SafetyPanel from './departure/SafetyPanel.jsx';

const TABS = [
  { id: 'passengers', label: 'Passengers', icon: LuUsers },
  { id: 'seats', label: 'Seat map', icon: LuBus },
  { id: 'itinerary', label: 'Itinerary', icon: LuMapPin },
  { id: 'safety', label: 'Safety & incidents', icon: LuClipboardCheck }
];

const dateTime = value => value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

function Stat({ label, value, tone = 'text-text' }) {
  return (
    <div className="glass rounded-2xl px-5 py-3 text-center">
      <p className={`font-display text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

// One departure: passengers, seat map, itinerary, safety checks and incidents, with the tour controls.
const DepartureDetailPage = ({ departure: initialDeparture, onBack }) => {
  const [record, setRecord] = useState(initialDeparture);
  const [tab, setTab] = useState('passengers');
  const [bookings, setBookings] = useState([]);
  const [loadingPassengers, setLoadingPassengers] = useState(true);
  const [passengerError, setPassengerError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const departureId = record._id;

  const loadPassengers = useCallback(async () => {
    setLoadingPassengers(true);
    setPassengerError('');
    try {
      const res = await fetch(`/api/bookings?groupDepartureId=${departureId}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Passenger list request failed.');
      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch (failure) {
      console.error('Error loading passengers:', failure);
      setPassengerError('The passenger list could not be loaded right now.');
    } finally {
      setLoadingPassengers(false);
    }
  }, [departureId]);

  useEffect(() => { loadPassengers(); }, [loadPassengers]);

  // The seat map is saved on the departure; refresh it so the view matches the server.
  useEffect(() => {
    let active = true;
    fetch(`/api/group-departure/${departureId}/seat-map`)
      .then(async res => { const data = await res.json(); if (!res.ok || !data.success) throw new Error(data.message || 'Unable to load seat map.'); return data; })
      .then(data => { if (active) setRecord(current => ({ ...current, seatMap: data.seatMap || [] })); })
      .catch(error => { if (active) setSaveError(error.message); });
    return () => { active = false; };
  }, [departureId]);

  const passengers = useMemo(() => passengerRows(bookings), [bookings]);
  const seatRows = useMemo(
    () => buildSeatRows(record.totalSeats || 0, passengers, record.seatMap || [], record.bookedSeats || 0),
    [record.totalSeats, record.bookedSeats, record.seatMap, passengers]
  );
  const checkedIn = useMemo(() => {
    const map = {};
    seatRows.flat().forEach(seat => { if (seat?.passenger) map[seat.passenger.id] = Boolean(seat.checkedIn); });
    return map;
  }, [seatRows]);
  const counts = useMemo(() => {
    const seated = passengers.filter(passenger => passenger.seatNumber !== null);
    return { ...attendanceCounts(seated, checkedIn), booked: passengers.length };
  }, [passengers, checkedIn]);
  const checklist = { ...EMPTY_SAFETY, ...(record.safetyChecklist || {}) };
  const status = departureStatus(record, new Date());

  const saveDepartureUpdates = async payload => {
    setSaveError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/group-departures/${departureId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.departure) throw new Error(data.message || 'Unable to save departure updates.');
      setRecord(current => ({ ...current, ...data.departure }));
      return data.departure;
    } catch (failure) {
      setSaveError(failure.message || 'Unable to save departure updates.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const toggleCheckIn = passenger => {
    if (saving || passenger.seatNumber === null) return;
    const present = !checkedIn[passenger.id];
    const rows = seatRows.map(row => row.map(seat => (seat?.passenger?.id !== passenger.id ? seat : { ...seat, checkedIn: present, status: present ? 'booked-checked' : 'booked' })));
    saveDepartureUpdates({ seatMap: toSeatPayload(rows), seatMapChecked: true });
  };

  const markAllPresent = async () => {
    if (saving || !(await confirmAction({ message: 'Mark every passenger with a seat as checked in?' }))) return;
    const rows = seatRows.map(row => row.map(seat => (seat?.passenger && seat.status !== 'blocked' ? { ...seat, checkedIn: true, status: 'booked-checked' } : seat)));
    saveDepartureUpdates({ seatMap: toSeatPayload(rows), seatMapChecked: true });
  };

  const toggleSafety = key => {
    if (saving) return;
    saveDepartureUpdates({ safetyChecklist: { ...checklist, [key]: !checklist[key] } });
  };

  const toggleStop = (dayIndex, stopIndex) => {
    if (saving) return;
    const next = (record.itinerary || []).map((day, index) => index !== dayIndex ? day : {
      ...day,
      stops: day.stops.map((stop, idx) => idx !== stopIndex ? stop : { ...stop, status: stop.status === 'completed' ? 'pending' : 'completed' })
    });
    saveDepartureUpdates({ itinerary: next });
  };

  const logIncident = async incident => {
    if (saving) return false;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/group-departure/${departureId}/incidents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(incident)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to log the incident.');
      setRecord(current => ({ ...current, incidents: data.departure?.incidents || current.incidents }));
      notify.message('Incident logged.');
      return true;
    } catch (failure) {
      setSaveError(failure.message || 'Unable to log the incident.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startTour = async () => {
    if (!isSafetyComplete(checklist)) {
      notify.message('Complete the safety checks before starting the tour.');
      setTab('safety');
      return;
    }
    if (saving || !(await confirmAction({ message: 'Mark this tour as started?' }))) return;
    const saved = await saveDepartureUpdates({ safetyChecklist: checklist, tourStarted: true });
    if (saved) notify.message('Tour started.');
  };

  const completeTour = async () => {
    if (saving || !(await confirmAction({ message: 'Mark this tour as completed? The departure will be closed.' }))) return;
    const saved = await saveDepartureUpdates({ tourStarted: false, status: 'CLOSED' });
    if (saved) { notify.message('Tour completed.'); onBack(); }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" icon={LuArrowLeft} onClick={onBack}>Back to My Departures</Button>

      <header className="glass-strong flex flex-wrap items-start justify-between gap-6 rounded-3xl p-6">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone="neutral">{tourType(record)}</Badge>
            {record.tourStarted && <Badge tone="info" icon={LuPlay}>Tour in progress</Badge>}
          </div>
          <h2 className="font-display text-2xl font-semibold text-text sm:text-3xl">{record.packageId?.title || 'Group departure'}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="inline-flex items-center gap-2"><LuClock aria-hidden="true" className="h-4 w-4" />{dateTime(record.startDate)} – {dateTime(record.endDate)}</span>
            <span className="inline-flex items-center gap-2"><LuMapPin aria-hidden="true" className="h-4 w-4" />{record.packageId?.destination || 'Destination not set'}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Booked" value={counts.booked} />
          <Stat label="Checked in" value={counts.checkedIn} tone="text-success" />
          <Stat label="Not checked in" value={counts.noShow} tone={counts.noShow ? 'text-warning' : 'text-text'} />
        </div>
      </header>

      {saveError && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{saveError}</p>
      )}

      <section className="glass rounded-3xl">
        <div role="tablist" aria-label="Departure sections" className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {TABS.map(item => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={active}
                aria-controls={`panel-${item.id}`}
                onClick={() => setTab(item.id)}
                className={`inline-flex min-h-[44px] flex-none items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${active ? 'bg-brand/15 text-text ring-1 ring-inset ring-brand/30' : 'text-text-muted hover:bg-surface-muted hover:text-text'}`}
              >
                <item.icon aria-hidden="true" className="h-4 w-4" />{item.label}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-5 sm:p-6">
          {tab === 'passengers' && (
            loadingPassengers ? <Skeleton className="h-48 w-full rounded-2xl" />
              : passengerError ? <ErrorState title="Passengers unavailable" message={passengerError} onRetry={loadPassengers} />
              : <PassengerList passengers={passengers} checkedIn={checkedIn} disabled={saving} onToggle={toggleCheckIn} onMarkAll={markAllPresent} />
          )}
          {tab === 'seats' && <SeatMapPanel seatRows={seatRows} />}
          {tab === 'itinerary' && <ItineraryPanel itinerary={record.itinerary || []} disabled={saving} onToggleStop={toggleStop} />}
          {tab === 'safety' && (
            <SafetyPanel
              checklist={checklist}
              incidents={record.incidents || []}
              disabled={saving}
              onToggle={toggleSafety}
              onLogIncident={logIncident}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="tour-controls-heading" className="glass rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="tour-controls-heading" className="font-display text-lg font-semibold text-text">Tour control</h2>
            <p className="text-sm text-text-muted">
              {record.tourStarted ? 'The tour is running. Close it when every stop is done.' : 'Start the tour once the safety checks are complete.'}
            </p>
          </div>
          {record.tourStarted ? (
            <Button icon={LuCircleCheck} onClick={completeTour} loading={saving}>Mark tour completed</Button>
          ) : (
            <Button icon={LuPlay} onClick={startTour} loading={saving}>Start tour</Button>
          )}
        </div>
      </section>
    </div>
  );
};

export default DepartureDetailPage;
