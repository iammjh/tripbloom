import React from 'react';
import { LuBed, LuCar, LuUserCog, LuUtensils } from 'react-icons/lu';
import { CheckIcon, MailIcon, PhoneIcon, SparklesIcon } from '../ui/icons.js';

const DEFAULT_DESCRIPTION = 'Embark on an unforgettable journey filled with amazing experiences, cultural discoveries, and breathtaking scenery. This carefully curated tour package offers the perfect blend of adventure and relaxation.';

// Section heading with a consistent divider above every section after the first.
function Section({ id, title, className = '', children }) {
  return (
    <section aria-labelledby={id} className={`space-y-4 border-t border-border pt-6 ${className}`}>
      <h3 id={id} className="font-display text-lg font-semibold text-text">{title}</h3>
      {children}
    </section>
  );
}

// Tour details below the photos: description, route, inclusions, special features and the group operator.
export default function TourInfo({ packageData }) {
  const stops = [...(packageData.destinations || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const inclusions = packageData.inclusions || {};
  const included = [
    inclusions.transport && { key: 'transport', label: 'Transportation', value: inclusions.transport, Icon: LuCar },
    inclusions.hotel && { key: 'hotel', label: 'Accommodation', value: inclusions.hotel, Icon: LuBed },
    inclusions.meals && { key: 'meals', label: 'Meals', value: inclusions.meals, Icon: LuUtensils },
    inclusions.guide && { key: 'guide', label: 'Tour guide', value: 'Expert local guide included', Icon: LuUserCog },
  ].filter(Boolean);
  const operators = packageData.type === 'GROUP' ? (packageData.assignedOperators || []) : [];

  return (
    <div className="space-y-6">
      <section aria-labelledby="about-heading" className="space-y-3">
        <h3 id="about-heading" className="font-display text-lg font-semibold text-text">About this tour</h3>
        <p className="text-base leading-relaxed text-text-muted">{packageData.description || DEFAULT_DESCRIPTION}</p>
      </section>

      {stops.length > 0 && (
        <Section id="journey-heading" title="Your journey">
          <p className="-mt-2 text-sm text-text-muted">{stops.length} {stops.length === 1 ? 'stop' : 'stops'}</p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {stops.map((dest, index) => (
              <li key={`${dest.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-surface-muted p-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand">
                  {dest.order || index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{dest.name}</p>
                  <p className="truncate text-xs text-text-muted">{[dest.city, dest.country].filter(Boolean).join(', ')}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {included.length > 0 && (
        <Section id="included-heading" title="What's included">
          <ul className="divide-y divide-border">
            {included.map(({ key, label, value, Icon }) => (
              <li key={key} className="flex items-center gap-3 py-3">
                <Icon aria-hidden="true" className="h-4 w-4 flex-none text-brand" />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
                  <p className="text-sm text-text">{value}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {packageData.extras && packageData.extras.length > 0 && (
        <Section id="extras-heading" title="Special features">
          <ul className="flex flex-wrap gap-2">
            {packageData.extras.map((extra, index) => (
              <li key={`${extra}-${index}`} className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-sm font-medium text-text ring-1 ring-inset ring-brand/30">
                <SparklesIcon aria-hidden="true" className="h-3.5 w-3.5 text-brand" />
                {extra}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {operators.length > 0 && (
        <Section id="operator-heading" title="Tour operator">
          <ul className="space-y-3">
            {operators.map((operator, index) => (
              <li key={operator._id || index} className="space-y-1 rounded-xl bg-surface-muted p-4">
                <p className="flex items-center gap-2 font-semibold text-text">
                  <CheckIcon aria-hidden="true" className="h-4 w-4 text-brand" />
                  {operator.fullName || 'Tour operator'}
                </p>
                {operator.phone && (
                  <p className="flex items-center gap-2 text-sm text-text-muted">
                    <PhoneIcon aria-hidden="true" className="h-4 w-4" />
                    <a href={`tel:${operator.phone}`} className="text-brand underline-offset-2 hover:underline">{operator.phone}</a>
                  </p>
                )}
                {operator.email && (
                  <p className="flex items-center gap-2 text-sm text-text-muted">
                    <MailIcon aria-hidden="true" className="h-4 w-4" />
                    <a href={`mailto:${operator.email}`} className="break-all text-brand underline-offset-2 hover:underline">{operator.email}</a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
