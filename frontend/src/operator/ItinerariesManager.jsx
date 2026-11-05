import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuCalendarDays, LuClipboardList, LuPlus, LuSave, LuTrash2 } from 'react-icons/lu';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import { inputClass } from '../components/ui/FormField.jsx';
import IconButton from '../components/ui/IconButton.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import { confirmAction } from '../utils/confirmStore.js';
import { addDay, addStop, itineraryErrors, removeStop, sameItinerary, updateStop } from '../utils/operatorItinerary.js';
import { toEditorItinerary, toStoredItinerary } from './departureState';

const longDate = value => new Date(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

// Day-by-day itinerary for the operator's upcoming departures. Saves replace the departure's itinerary.
const ItinerariesManager = () => {
  const operatorId = localStorage.getItem('userId');
  const [departures, setDepartures] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState({ days: [] });
  const [loadingItinerary, setLoadingItinerary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ tone: '', message: '' });
  const loadRequest = useRef(0);

  const loadDepartures = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await fetch(`/api/operator/${operatorId}/dashboard`);
      if (!res.ok) throw new Error(`Departures request failed with status ${res.status}`);
      const data = await res.json();
      const upcoming = (data.groupDepartures || [])
        .filter(dep => new Date(dep.startDate) > new Date())
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      setDepartures(upcoming);
    } catch (failure) {
      console.error('Error loading departures for the itinerary:', failure);
      setListError('Your upcoming departures could not be loaded right now.');
    } finally {
      setListLoading(false);
    }
  }, [operatorId]);

  useEffect(() => { loadDepartures(); }, [loadDepartures]);

  const savedStored = useMemo(
    () => (selected ? toStoredItinerary(toEditorItinerary(selected.itinerary || [], selected.startDate)) : null),
    [selected]
  );
  const dirty = Boolean(selected) && !sameItinerary(toStoredItinerary(editor), savedStored);

  const openDeparture = async departure => {
    const requestId = ++loadRequest.current;
    setStatus({ tone: '', message: '' });
    setSelected(null);
    setLoadingItinerary(true);
    try {
      const res = await fetch(`/api/admin/group-departures/${departure._id}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to load the itinerary.');
      if (requestId !== loadRequest.current) return;
      setSelected(data.departure);
      setEditor(toEditorItinerary(data.departure.itinerary || [], data.departure.startDate));
    } catch (failure) {
      if (requestId === loadRequest.current) setStatus({ tone: 'error', message: failure.message });
    } finally {
      if (requestId === loadRequest.current) setLoadingItinerary(false);
    }
  };

  const saveItinerary = async () => {
    if (!selected || saving || !dirty) return;
    const problems = itineraryErrors(editor);
    if (problems.length) { setStatus({ tone: 'error', message: problems[0] }); return; }
    if (!(await confirmAction({ message: 'Save this itinerary for the departure?' }))) return;
    setSaving(true);
    setStatus({ tone: '', message: '' });
    try {
      const res = await fetch(`/api/admin/group-departures/${selected._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary: toStoredItinerary(editor) })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.departure) throw new Error(data.message || 'Unable to save the itinerary.');
      setSelected(current => ({ ...current, ...data.departure }));
      setDepartures(previous => previous.map(item => (item._id === data.departure._id ? { ...item, ...data.departure } : item)));
      setEditor(toEditorItinerary(data.departure.itinerary || [], data.departure.startDate));
      setStatus({ tone: 'success', message: 'Itinerary saved.' });
    } catch (failure) {
      setStatus({ tone: 'error', message: failure.message || 'Unable to save the itinerary.' });
    } finally {
      setSaving(false);
    }
  };

  const inputFor = (label, value, onChange, props = {}) => (
    <input aria-label={label} value={value} onChange={event => onChange(event.target.value)} className={inputClass} {...props} />
  );

  return (
    <div className="space-y-6">
      <header className="glass-strong rounded-3xl p-6">
        <h2 className="font-display text-2xl font-semibold text-text sm:text-3xl">Itinerary</h2>
        <p className="mt-1 text-sm text-text-muted">Plan the day-by-day stops for your upcoming departures. Saving replaces the departure's itinerary.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <section aria-labelledby="upcoming-heading" className="space-y-3">
          <h3 id="upcoming-heading" className="font-display text-base font-semibold text-text">Upcoming departures</h3>
          {listLoading && <Skeleton className="h-24 w-full rounded-2xl" />}
          {!listLoading && listError && <ErrorState title="Departures unavailable" message={listError} onRetry={loadDepartures} />}
          {!listLoading && !listError && departures.length === 0 && (
            <EmptyState icon={LuCalendarDays} title="No upcoming departures" description="Departures you are assigned to and that have not started appear here." />
          )}
          {!listLoading && !listError && departures.length > 0 && (
            <ul className="space-y-2">
              {departures.map(dep => {
                const active = selected?._id === dep._id;
                return (
                  <li key={dep._id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      disabled={saving}
                      onClick={() => openDeparture(dep)}
                      className={`glass w-full rounded-2xl p-4 text-left transition-colors disabled:opacity-60 ${active ? 'ring-1 ring-brand/50' : 'hover:bg-surface-muted'}`}
                    >
                      <span className="block truncate font-semibold text-text">{dep.packageId?.title || 'Group departure'}</span>
                      <span className="mt-1 block text-sm text-text-muted">{longDate(dep.startDate)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="editor-heading" className="glass min-w-0 rounded-3xl p-5 sm:p-6">
          {!selected && !loadingItinerary && (
            <EmptyState icon={LuClipboardList} title="Choose a departure" description="Pick an upcoming departure to plan its days and stops." />
          )}
          {loadingItinerary && <Skeleton className="h-64 w-full rounded-2xl" />}

          {selected && !loadingItinerary && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 id="editor-heading" className="font-display text-lg font-semibold text-text">{selected.packageId?.title || 'Group departure'}</h3>
                  <p className="text-sm text-text-muted">Starts {longDate(selected.startDate)}</p>
                  {dirty && <div className="mt-2"><Badge tone="warning">Unsaved changes</Badge></div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" icon={LuPlus} onClick={() => setEditor(current => addDay(current, selected.startDate))} disabled={saving}>Add day</Button>
                  <Button icon={LuSave} onClick={saveItinerary} loading={saving} disabled={!dirty || saving}>Save itinerary</Button>
                </div>
              </div>

              {status.message && (
                <p role={status.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm ${status.tone === 'error' ? 'border border-danger/40 bg-danger/10 text-danger' : 'border border-success/40 bg-success/10 text-success'}`}>
                  {status.message}
                </p>
              )}

              {editor.days.length === 0 ? (
                <EmptyState
                  icon={LuCalendarDays}
                  title="No days planned yet"
                  description="Add the first day, then the stops for that day."
                  action={<Button icon={LuPlus} onClick={() => setEditor(current => addDay(current, selected.startDate))}>Add first day</Button>}
                />
              ) : (
                <div className="space-y-5">
                  {editor.days.map((day, dayIndex) => (
                    <section key={day.dayNumber} aria-labelledby={`day-heading-${dayIndex}`} className="rounded-2xl border border-border p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h4 id={`day-heading-${dayIndex}`} className="font-display text-base font-semibold text-text">
                          Day {day.dayNumber} <span className="ml-2 text-sm font-normal text-text-muted">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </h4>
                        <Button size="sm" variant="secondary" icon={LuPlus} disabled={saving} onClick={() => setEditor(current => addStop(current, dayIndex))}>Add stop</Button>
                      </div>

                      {day.activities.length === 0 ? (
                        <p className="text-sm text-text-muted">No stops yet for this day.</p>
                      ) : (
                        <ul className="space-y-3">
                          {day.activities.map((stop, stopIndex) => {
                            const label = `Day ${day.dayNumber}, stop ${stopIndex + 1}`;
                            return (
                              <li key={stopIndex} className="grid gap-3 rounded-xl bg-surface-muted/60 p-3 sm:grid-cols-[7rem_1fr_1fr] xl:grid-cols-[7rem_1fr_1fr_1fr_auto]">
                                {inputFor(`${label} time`, stop.time || '', value => setEditor(current => updateStop(current, dayIndex, stopIndex, 'time', value)), { type: 'time', disabled: saving })}
                                {inputFor(`${label} name`, stop.name || '', value => setEditor(current => updateStop(current, dayIndex, stopIndex, 'name', value)), { placeholder: 'Stop name', disabled: saving })}
                                {inputFor(`${label} location`, stop.location || '', value => setEditor(current => updateStop(current, dayIndex, stopIndex, 'location', value)), { placeholder: 'Location', disabled: saving })}
                                {inputFor(`${label} notes`, stop.notes || '', value => setEditor(current => updateStop(current, dayIndex, stopIndex, 'notes', value)), { placeholder: 'Notes', disabled: saving })}
                                <IconButton
                                  variant="danger"
                                  icon={LuTrash2}
                                  label={`Remove ${label}`}
                                  disabled={saving}
                                  onClick={() => setEditor(current => removeStop(current, dayIndex, stopIndex))}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ItinerariesManager;
