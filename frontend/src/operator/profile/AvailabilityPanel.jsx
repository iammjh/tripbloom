import React from 'react';
import { LuToggleLeft, LuToggleRight } from 'react-icons/lu';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';

// Availability decides whether administrators can assign you new departures.
export default function AvailabilityPanel({ available, saving, onToggle }) {
  return (
    <section aria-labelledby="availability-heading" className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 sm:p-6">
      <div className="min-w-0">
        <h2 id="availability-heading" className="font-display text-lg font-semibold text-text">Availability</h2>
        <p className="mt-1 text-sm text-text-muted">
          {available
            ? 'You can be assigned to new departures.'
            : 'You will not be assigned new departures. Finish or hand over your upcoming ones first.'}
        </p>
        <div className="mt-2"><Badge tone={available ? 'success' : 'danger'}>{available ? 'Available' : 'Unavailable'}</Badge></div>
      </div>
      <Button
        variant={available ? 'secondary' : 'primary'}
        icon={available ? LuToggleRight : LuToggleLeft}
        onClick={onToggle}
        loading={saving}
        aria-pressed={available}
      >
        {available ? 'Set unavailable' : 'Set available'}
      </Button>
    </section>
  );
}
