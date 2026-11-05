import React from 'react';
import { LuClock, LuMapPin } from 'react-icons/lu';
import { BusIcon, PlaneIcon, SparklesIcon, StarIcon } from '../ui/icons.js';

// Key facts about the tour in a compact row: duration, tour type, region and category when set.
export default function TourFacts({ packageData, isGroupTour }) {
  const facts = [
    { label: 'Duration', value: packageData.defaultDays ? `${packageData.defaultDays} days, ${packageData.defaultNights ?? 0} nights` : 'Not set', Icon: LuClock },
    { label: 'Tour type', value: isGroupTour ? 'Group departure' : 'Personal tour', Icon: isGroupTour ? BusIcon : SparklesIcon },
    { label: 'Region', value: packageData.isInternational ? 'International' : 'Domestic', Icon: packageData.isInternational ? PlaneIcon : LuMapPin },
  ];
  if (packageData.category) facts.push({ label: 'Category', value: packageData.category, Icon: StarIcon });

  return (
    // Two columns keep labels such as "Tour type" from wrapping in the narrow main column. With three facts,
    // the last one spans the row on phones and takes its own column from the small breakpoint up.
    <dl className={`grid grid-cols-2 gap-3 ${facts.length === 3 ? 'sm:grid-cols-3' : ''}`}>
      {facts.map(({ label, value, Icon }) => (
        <div key={label} className={`rounded-xl bg-surface-muted p-3 ${facts.length === 3 ? 'last:col-span-2 sm:last:col-span-1' : ''}`}>
          <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            <Icon aria-hidden="true" className="h-4 w-4 flex-none text-brand" />
            {label}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
