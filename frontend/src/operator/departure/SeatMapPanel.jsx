import React from 'react';
import { LuBus, LuUsers } from 'react-icons/lu';
import EmptyState from '../../components/ui/EmptyState.jsx';

const SEAT_STYLE = {
  blocked: 'bg-danger text-white',
  'booked-checked': 'bg-success text-white',
  booked: 'bg-brand text-on-brand',
  free: 'border border-border bg-surface-muted text-text-muted'
};

const LEGEND = [
  { status: 'booked-checked', label: 'Booked and checked in' },
  { status: 'booked', label: 'Booked, not checked in' },
  { status: 'free', label: 'Free' },
  { status: 'blocked', label: 'Blocked' }
];

// Bus layout: rows of four seats with an aisle between the pairs. Seat states come from the saved seat map.
export default function SeatMapPanel({ seatRows }) {
  if (seatRows.length === 0) {
    return <EmptyState icon={LuBus} title="No seat map yet" description="The seat map appears once the departure has seats." />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div className="glass overflow-x-auto rounded-2xl p-5">
        <div className="mx-auto w-max space-y-3">
          <div className="flex justify-end pb-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand" aria-label="Driver">
              <LuBus aria-hidden="true" className="h-5 w-5" />
            </span>
          </div>
          {seatRows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-3">
              {row.map((seat, colIndex) => (
                <React.Fragment key={colIndex}>
                  {colIndex === 2 && <span className="w-6" aria-hidden="true" />}
                  {seat ? (
                    <div
                      title={seat.passenger ? `${seat.passenger.name} (${seat.passenger.bookingLabel || seat.passenger.bookingId})` : 'Free'}
                      className={`flex h-12 w-12 items-center justify-center rounded-lg text-sm font-semibold ${SEAT_STYLE[seat.status] || SEAT_STYLE.free}`}
                    >
                      {seat.number}
                    </div>
                  ) : <span className="h-12 w-12" aria-hidden="true" />}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>

      <aside className="glass h-fit rounded-2xl p-5">
        <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-text">
          <LuUsers aria-hidden="true" className="h-4 w-4 text-brand" />Legend
        </h3>
        <ul className="space-y-2">
          {LEGEND.map(item => (
            <li key={item.status} className="flex items-center gap-3 text-sm text-text">
              <span className={`h-6 w-6 flex-none rounded ${SEAT_STYLE[item.status]}`} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
