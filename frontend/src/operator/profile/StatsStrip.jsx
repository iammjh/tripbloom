import React from 'react';
import { LuCalendarCheck, LuUsers } from 'react-icons/lu';

// Figures the server computes from your assigned departures.
export default function StatsStrip({ completedTours, totalTravelers }) {
  const tiles = [
    { label: 'Completed departures', value: completedTours, icon: LuCalendarCheck, note: 'Departures whose end date has passed' },
    { label: 'Travellers across your departures', value: totalTravelers, icon: LuUsers, note: 'Booked seats on departures you are assigned to' }
  ];
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {tiles.map(tile => (
        <div key={tile.label} className="glass flex items-start gap-4 rounded-2xl p-5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/10">
            <tile.icon aria-hidden="true" className="h-5 w-5 text-brand" />
          </span>
          <div className="min-w-0">
            <dt className="text-sm font-medium text-text-muted">{tile.label}</dt>
            <dd className="font-display text-3xl font-semibold text-text">{tile.value ?? 0}</dd>
            <dd className="text-xs text-text-muted">{tile.note}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
