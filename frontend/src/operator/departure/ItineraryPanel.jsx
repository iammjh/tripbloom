import React from 'react';
import { LuCircleCheck, LuClipboardList, LuMapPin } from 'react-icons/lu';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

// Day-by-day stops. Operators can mark a stop complete or undo it; the itinerary itself is edited on Checklists.
export default function ItineraryPanel({ itinerary, disabled, onToggleStop }) {
  if (!itinerary.length) {
    return <EmptyState icon={LuClipboardList} title="No itinerary yet" description="Add the day-by-day plan on the Checklists page." />;
  }

  return (
    <div className="space-y-5">
      {itinerary.map((day, dayIndex) => (
        <section key={day.day ?? dayIndex} aria-labelledby={`day-${dayIndex}`} className="space-y-3">
          <h3 id={`day-${dayIndex}`} className="font-display text-base font-semibold text-text">Day {day.day}</h3>
          <ul className="space-y-2">
            {(day.stops || []).map((stop, stopIndex) => {
              const done = stop.status === 'completed';
              return (
                <li key={stopIndex} className={`glass flex flex-wrap items-start justify-between gap-3 rounded-2xl p-4 ${done ? 'ring-1 ring-success/40' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-brand">{stop.time || '--:--'}</span>
                      <p className="font-semibold text-text">{stop.name || 'Untitled stop'}</p>
                      {done && <Badge tone="success" icon={LuCircleCheck}>Done</Badge>}
                    </div>
                    {stop.location && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                        <LuMapPin aria-hidden="true" className="h-3.5 w-3.5" />{stop.location}
                      </p>
                    )}
                    {stop.notes && <p className="mt-1 text-sm italic text-text-muted">{stop.notes}</p>}
                  </div>
                  <Button size="sm" variant={done ? 'ghost' : 'secondary'} disabled={disabled} onClick={() => onToggleStop(dayIndex, stopIndex)}>
                    {done ? 'Undo' : 'Mark complete'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
