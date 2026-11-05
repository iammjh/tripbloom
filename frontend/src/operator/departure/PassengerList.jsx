import React from 'react';
import { LuCircleCheck, LuPhone, LuTriangleAlert, LuUsers } from 'react-icons/lu';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

// Travellers on the departure with check-in. A traveller without a reserved seat cannot be checked in.
export default function PassengerList({ passengers, checkedIn, disabled, onToggle, onMarkAll }) {
  if (passengers.length === 0) {
    return <EmptyState icon={LuUsers} title="No travellers yet" description="Confirmed and paid bookings on this departure appear here." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-text">Passenger list</h2>
        <Button size="sm" variant="secondary" icon={LuCircleCheck} onClick={onMarkAll} disabled={disabled}>Mark all present</Button>
      </div>

      <ul className="space-y-2">
        {passengers.map(passenger => {
          const present = Boolean(checkedIn[passenger.id]);
          const canCheckIn = passenger.seatNumber !== null && !disabled;
          return (
            <li key={passenger.id} className={`glass flex flex-wrap items-center gap-4 rounded-2xl p-4 ${present ? 'ring-1 ring-success/50' : ''}`}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={present}
                  disabled={!canCheckIn}
                  onChange={() => onToggle(passenger)}
                  aria-label={`Mark ${passenger.name} as checked in`}
                  className="h-5 w-5 flex-none"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-text">{passenger.name}</span>
                  <span className="block truncate font-mono text-xs text-text-muted">{passenger.bookingLabel}</span>
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                {passenger.phone && (
                  <a href={`tel:${passenger.phone}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-brand hover:underline">
                    <LuPhone aria-hidden="true" className="h-3.5 w-3.5" />{passenger.phone}
                  </a>
                )}
                <Badge tone={passenger.seatNumber === null ? 'warning' : 'neutral'}>
                  {passenger.seatNumber === null ? 'No seat' : `Seat ${passenger.seatNumber}`}
                </Badge>
                <Badge tone={passenger.paid ? 'success' : 'warning'}>{passenger.paymentLabel}</Badge>
                {passenger.emergencyContact ? (
                  <Badge tone="success">Emergency contact</Badge>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                    <LuTriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />No emergency contact
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
