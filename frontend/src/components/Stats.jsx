import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PiGlobeHemisphereWestDuotone, PiMapTrifoldDuotone, PiStarDuotone, PiUsersThreeDuotone } from 'react-icons/pi';

// Platform counts from the backend. A value is shown only when it was actually received; otherwise a dash.
const ITEMS = [
  { key: 'totalPackages', label: 'Tour packages', icon: PiMapTrifoldDuotone },
  { key: 'happyTravelers', label: 'Happy travellers', icon: PiUsersThreeDuotone },
  { key: 'fiveStarReviews', label: '5-star reviews', icon: PiStarDuotone },
  { key: 'totalDestinations', label: 'Destinations', icon: PiGlobeHemisphereWestDuotone },
];

const Stats = () => {
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    axios.get('/api/stats/platform')
      .then(response => {
        if (!active) return;
        if (response.data?.success && response.data.stats) setStats(response.data.stats);
        else setFailed(true);
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const format = value => (typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—');

  return (
    <section aria-label="TripBloom in numbers" className="bg-brand-strong text-white">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
        {ITEMS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/30 via-teal-400/15 to-sky-400/25 ring-1 ring-inset ring-white/15 shadow-[0_0_32px_-6px_rgb(var(--brand)/0.7)] backdrop-blur">
              <Icon aria-hidden="true" className="h-9 w-9 text-emerald-200 drop-shadow-[0_0_10px_rgb(var(--brand)/0.8)]" />
            </span>
            <dt className="order-2 text-sm font-medium text-white/80">{label}</dt>
            <dd className="order-1 font-display text-3xl font-bold tabular-nums sm:text-4xl">
              {failed ? '—' : format(stats?.[key])}
            </dd>
          </div>
        ))}
      </dl>
      {failed && <p className="pb-6 text-center text-xs text-white/80">Platform figures are unavailable right now.</p>}
    </section>
  );
};

export default Stats;
