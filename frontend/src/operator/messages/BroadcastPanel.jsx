import React, { useState } from 'react';
import { LuCalendarDays, LuMegaphone } from 'react-icons/lu';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import { confirmAction } from '../../utils/confirmStore.js';
import { MESSAGE_LIMIT, idOf } from '../../utils/operatorMessages.js';

const EXAMPLES = [
  'Weather update: rain is expected tomorrow. Please bring umbrellas.',
  'Meeting point has moved to the hotel main entrance at 9 AM.',
  'Please bring your ID and booking confirmation.',
  'The tour leaves 1 hour later today, at 10 AM.'
];

const dateLabel = value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Writes one announcement to every traveller on a departure. The message is saved to the departure; no email or SMS is sent.
export default function BroadcastPanel({ departures, onSend }) {
  const [tourId, setTourId] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const chosen = departures.find(tour => idOf(tour) === tourId);
  const ready = Boolean(chosen) && content.trim().length > 0 && !sending;

  const send = async event => {
    event.preventDefault();
    if (!ready) {
      setError(!chosen ? 'Choose a departure first.' : 'Write the announcement before sending.');
      return;
    }
    const title = chosen.packageId?.title || 'this departure';
    if (!(await confirmAction({ message: `Send this announcement to every traveller on ${title}?` }))) return;
    setSending(true);
    setError('');
    try {
      await onSend(tourId, content.trim());
      setContent('');
    } catch (failure) {
      setError(failure.message || 'The announcement could not be sent.');
    } finally {
      setSending(false);
    }
  };

  if (departures.length === 0) {
    return <EmptyState icon={LuCalendarDays} title="No departures to announce to" description="You can send announcements once you are assigned to a departure." />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <form onSubmit={send} noValidate className="glass space-y-5 rounded-2xl p-5">
        <FormField id="broadcast-departure" label="Departure" required>
          <select id="broadcast-departure" value={tourId} onChange={event => setTourId(event.target.value)} className={inputClass}>
            <option value="">Choose a departure</option>
            {departures.map(tour => (
              <option key={idOf(tour)} value={idOf(tour)}>
                {tour.packageId?.title || 'Group departure'} · {dateLabel(tour.startDate)} · {tour.bookedSeats ?? 0} booked
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="broadcast-content" label="Announcement" required error={error || undefined} hint={`Up to ${MESSAGE_LIMIT} characters. Saved to the departure for every traveller.`}>
          <textarea
            id="broadcast-content"
            rows={6}
            maxLength={MESSAGE_LIMIT}
            value={content}
            onChange={event => setContent(event.target.value)}
            className={inputClass}
          />
        </FormField>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => { setContent(''); setTourId(''); setError(''); }} disabled={sending}>Clear</Button>
          <Button type="submit" icon={LuMegaphone} loading={sending} disabled={!ready}>Send announcement</Button>
        </div>
      </form>

      <aside className="glass h-fit space-y-3 rounded-2xl p-5">
        <h3 className="font-display text-base font-semibold text-text">Examples</h3>
        <ul className="space-y-2">
          {EXAMPLES.map(example => (
            <li key={example}>
              <button
                type="button"
                onClick={() => setContent(example)}
                className="w-full rounded-xl bg-surface-muted/60 p-3 text-left text-sm text-text-muted transition-colors hover:text-text"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
