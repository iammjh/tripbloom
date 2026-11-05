import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { LuCalendarCheck, LuClock, LuHeart, LuMapPin, LuSearch, LuUser, LuUsers } from 'react-icons/lu';

import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import IconButton from './ui/IconButton.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { inputClass } from './ui/FormField.jsx';
import { BackIcon, PlaneIcon } from './ui/icons.js';
import TourDetailModal from './TourDetailModal';
import { getAvailableDepartures } from '../api/catalog';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=400&fit=crop';

// Destination keyword -> photo. The first key found in the destination name wins.
const IMAGE_BY_PLACE = {
  bangladesh: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
  cox: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=400&fit=crop',
  sundarbans: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=800&h=400&fit=crop',
  sylhet: 'https://images.unsplash.com/photo-1563622797-cc703a4b2921?w=800&h=400&fit=crop',
  bandarban: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
  rangamati: 'https://images.unsplash.com/photo-1540202404-a2f29016b523?w=800&h=400&fit=crop',
  'saint martin': 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=400&fit=crop',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=400&fit=crop',
  thailand: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800&h=400&fit=crop',
  malaysia: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&h=400&fit=crop',
  maldives: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&h=400&fit=crop',
  nepal: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&h=400&fit=crop',
  singapore: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&h=400&fit=crop',
  turkey: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&h=400&fit=crop',
  bhutan: 'https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=800&h=400&fit=crop',
};

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'GROUP', label: 'Group' },
];

// Copy for each page. Keys match the type filter values.
const HEADINGS = {
  '': {
    eyebrow: 'All packages',
    title: 'Browse tour packages',
    description: 'Personal and group tours from TripBloom, in one place.',
  },
  PERSONAL: {
    eyebrow: 'Personal tours',
    title: 'Plan a tour around you',
    description: 'Private itineraries for your own group of travellers. Customise the plan before you book.',
  },
  GROUP: {
    eyebrow: 'Group tours',
    title: 'Join a scheduled departure',
    description: 'Fixed departure dates with a set group. Pick a date and check how many seats are left.',
  },
};

const PILL = 'inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur';

// Same icon as LuHeart, filled, shown on saved packages.
const FilledHeart = (props) => <LuHeart {...props} fill="currentColor" />;

function packageImage(pkg) {
  if (pkg.photos?.length > 0) return pkg.photos[0];
  const firstDest = pkg.destinations?.[0];
  if (!firstDest) return FALLBACK_IMAGE;
  const place = (firstDest.country || firstDest.city || firstDest.name || '').toLowerCase();
  const match = Object.keys(IMAGE_BY_PLACE).find((key) => place.includes(key));
  return match ? IMAGE_BY_PLACE[match] : FALLBACK_IMAGE;
}

function formatDestinations(destinations) {
  if (!destinations || destinations.length === 0) return 'Various locations';
  return destinations
    .map((d) => d.name || d.city || d.country)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ') + (destinations.length > 3 ? '...' : '');
}

function formatDepartureDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Photo that swaps to a branded field if the image cannot load.
function PackageImage({ pkg, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div aria-hidden="true" className={`bg-gradient-to-br from-brand-strong via-surface to-info/40 ${className}`} />;
  }
  return (
    <img
      src={packageImage(pkg)}
      alt={pkg.title}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

function DepartureList({ departures }) {
  if (!departures || departures.length === 0) {
    return (
      <p className="mb-5 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-text-muted">
        No upcoming departures scheduled yet. Contact us for custom dates.
      </p>
    );
  }
  const shown = departures.slice(0, 3);
  const more = departures.length - shown.length;
  return (
    <div className="mb-5 rounded-lg border border-border bg-surface-muted p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-text">
        <LuCalendarCheck aria-hidden="true" className="h-4 w-4 text-brand" />
        Upcoming departures
      </p>
      <ul className="mt-2 divide-y divide-border">
        {shown.map((dep) => {
          const seatsLeft = dep.totalSeats - dep.bookedSeats;
          const isFull = seatsLeft <= 0;
          const tone = isFull ? 'text-danger' : seatsLeft <= 5 ? 'text-warning' : 'text-success';
          return (
            <li key={dep._id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 text-text">
                {formatDepartureDate(dep.startDate)}
                {dep.endDate && <span className="text-text-muted"> to {formatDepartureDate(dep.endDate)}</span>}
              </span>
              <span className={`shrink-0 font-semibold ${tone}`}>{isFull ? 'Full' : `${seatsLeft} seats left`}</span>
            </li>
          );
        })}
      </ul>
      {more > 0 && (
        <p className="mt-2 text-xs font-semibold text-brand">+{more} more departure{more > 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

function PackageCard({ pkg, departures, saved, onView, onToggleSave }) {
  const isGroup = pkg.type === 'GROUP';
  return (
    <article
      onClick={() => onView(pkg)}
      className="glass flex cursor-pointer flex-col overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-1 hover:shadow-2xl"
    >
      <div className="relative h-44 overflow-hidden bg-surface-muted">
        <PackageImage pkg={pkg} className="h-full w-full transition-transform duration-300 hover:scale-105" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className={PILL}>
            {isGroup ? <LuUsers aria-hidden="true" className="h-3.5 w-3.5" /> : <LuUser aria-hidden="true" className="h-3.5 w-3.5" />}
            {isGroup ? 'Group' : 'Personal'}
          </span>
          {pkg.isInternational && (
            <span className={PILL}>
              <PlaneIcon aria-hidden="true" className="h-3.5 w-3.5" />
              International
            </span>
          )}
          {pkg.category && <span className={PILL}>{pkg.category}</span>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-text">{pkg.title}</h3>
        {pkg.description && <p className="mt-2 line-clamp-2 text-sm text-text-muted">{pkg.description}</p>}

        <ul className="mb-5 mt-4 space-y-2 text-sm text-text-muted">
          {pkg.destinations?.length > 0 && (
            <li className="flex items-center gap-2">
              <LuMapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate">{formatDestinations(pkg.destinations)}</span>
            </li>
          )}
          <li className="flex items-center gap-2">
            <LuClock aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
            <span>{pkg.defaultDays} Days / {pkg.defaultNights} Nights</span>
          </li>
        </ul>

        {isGroup && <DepartureList departures={departures} />}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-5">
          <div className="min-w-0">
            <p className="text-xs text-text-muted">{isGroup ? 'Per person' : 'Starting from'}</p>
            <p className="whitespace-nowrap font-display text-xl font-bold text-brand sm:text-2xl">BDT {Number(pkg.basePrice || 0).toLocaleString()}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              label={saved ? 'Remove from saved packages' : 'Save package'}
              icon={saved ? FilledHeart : LuHeart}
              variant={saved ? 'danger' : 'ghost'}
              onClick={(e) => { e.stopPropagation(); onToggleSave(pkg); }}
            />
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onView(pkg); }}>View Details</Button>
          </div>
        </div>
      </div>
    </article>
  );
}

const BrowsePackages = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [suggestedPackages, setSuggestedPackages] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [savedPackageIds, setSavedPackageIds] = useState(new Set());
  const [groupDepartures, setGroupDepartures] = useState({});

  // Filters. Price range is applied on Search, not on every keystroke.
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [scopeFilter, setScopeFilter] = useState(searchParams.get('scope') || '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Lets a slower earlier request finish without overwriting a newer result.
  const requestRef = useRef(0);

  const currentFilters = () => ({
    type: typeFilter,
    scope: scopeFilter,
    category: categoryFilter,
    minPrice,
    maxPrice,
    search: searchTerm,
  });

  const loadGroupDepartures = async (pkgs) => {
    const departuresData = {};
    const groupPackages = pkgs.filter((pkg) => pkg.type === 'GROUP');
    await Promise.all(
      groupPackages.map(async (pkg) => {
        try {
          const departures = await getAvailableDepartures(pkg._id);
          const upcoming = (departures || [])
            .filter((dep) => new Date(dep.startDate) > new Date())
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
          if (upcoming.length > 0) departuresData[pkg._id] = upcoming;
        } catch (err) {
          console.error(`Failed to fetch departures for package ${pkg._id}:`, err);
        }
      })
    );
    return departuresData;
  };

  const runSearch = async (filters) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const params = {};
      if (filters.type) params.type = filters.type;
      if (filters.scope) params.scope = filters.scope;
      if (filters.category) params.category = filters.category;
      if (filters.minPrice) params.minPrice = filters.minPrice;
      if (filters.maxPrice) params.maxPrice = filters.maxPrice;
      if (filters.search) params.search = filters.search;

      const response = await axios.get('/api/packages/search', { params });
      if (requestId !== requestRef.current) return;
      if (!response.data?.success) throw new Error('Package search returned no results');

      const found = response.data.packages || [];
      const departures = await loadGroupDepartures(found);
      if (requestId !== requestRef.current) return;
      setPackages(found);
      setGroupDepartures(departures);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      console.error('[BrowsePackages] Failed to fetch packages:', error);
      setPackages([]);
      setGroupDepartures({});
      setLoadError(true);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };

  // Scroll to top when the page opens.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Re-run the search when a filter that is applied immediately changes.
  useEffect(() => {
    runSearch(currentFilters());
  }, [typeFilter, categoryFilter, searchTerm, scopeFilter]);

  // Follow the ?type= link when the page is already open, for example from the navbar.
  useEffect(() => {
    setTypeFilter(searchParams.get('type') || '');
  }, [searchParams]);

  // Load saved packages for a logged-in customer.
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const userRole = localStorage.getItem('userRole');
        const userId = localStorage.getItem('userId');
        if (userRole === 'customer' && userId) {
          const res = await axios.get(`/api/users/${userId}/saved`);
          if (res.data && res.data.packages) {
            setSavedPackageIds(new Set(res.data.packages.map((p) => p._id)));
          }
        }
      } catch (err) {
        console.debug('Failed to load saved packages', err?.message || err);
      }
    };
    loadSaved();
  }, []);

  // When nothing matches, suggest other tours of the same type.
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (loading || packages.length > 0) return;
      try {
        setLoadingSuggestions(true);
        const res = await axios.get('/api/packages/search', { params: typeFilter ? { type: typeFilter } : {} });
        if (res && res.data && Array.isArray(res.data.packages)) {
          setSuggestedPackages(res.data.packages.slice(0, 6));
        }
      } catch (err) {
        console.error('Failed to load suggested packages', err);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, [loading, packages.length, typeFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    runSearch(currentFilters());
  };

  const selectType = (value) => {
    setTypeFilter(value);
    if (value === 'GROUP') setCategoryFilter(''); // group departures have no category
    const next = new URLSearchParams(searchParams);
    if (value) next.set('type', value);
    else next.delete('type');
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setScopeFilter('');
    setCategoryFilter('');
    setMinPrice('');
    setMaxPrice('');
    setSearchTerm('');
    runSearch({ type: typeFilter, scope: '', category: '', minPrice: '', maxPrice: '', search: '' });
  };

  const handleViewDetails = (pkg) => {
    setSelectedPackage(pkg);
    setShowModal(true);
  };

  const toggleSaved = async (pkg) => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      localStorage.setItem('afterLoginGoto', window.location.pathname);
      window.dispatchEvent(new CustomEvent('openAuthModal'));
      return;
    }
    const pkgId = pkg._id;
    const wasSaved = savedPackageIds.has(pkgId);
    const apply = (next, id, saved) => {
      const copy = new Set(next);
      if (saved) copy.add(id); else copy.delete(id);
      return copy;
    };
    // Optimistic update, rolled back if the request fails.
    setSavedPackageIds((prev) => apply(prev, pkgId, !wasSaved));
    try {
      if (wasSaved) await axios.delete(`/api/users/${userId}/save/${pkgId}`);
      else await axios.post(`/api/users/${userId}/save/${pkgId}`);
    } catch (err) {
      setSavedPackageIds((prev) => apply(prev, pkgId, wasSaved));
      console.error('Failed to toggle saved package', err);
    }
  };

  const heading = HEADINGS[typeFilter] || HEADINGS[''];

  return (
    <div className="dark mesh-bg min-h-screen text-text">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8">
          <Button variant="ghost" size="sm" icon={BackIcon} onClick={() => navigate('/')} className="-ml-3 mb-3">
            Back to home
          </Button>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">{heading.eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-text sm:text-4xl">{heading.title}</h1>
          <p className="mt-3 max-w-2xl text-base text-text-muted">{heading.description}</p>
        </header>

        <div role="group" aria-label="Tour type" className="glass mb-5 inline-flex max-w-full flex-wrap gap-1 rounded-full p-1">
          {TYPE_TABS.map((tab) => {
            const active = typeFilter === tab.value;
            return (
              <button
                key={tab.label}
                type="button"
                aria-pressed={active}
                onClick={() => selectType(tab.value)}
                className={`min-h-[40px] rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${
                  active ? 'bg-brand text-on-brand' : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearch} aria-label="Search and filter tours" className="glass rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <LuSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                aria-label="Search tours"
                placeholder="Search destination or title"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${inputClass} pl-10`}
              />
            </div>
            <Button type="submit" icon={LuSearch} className="md:min-w-40">Search</Button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <select aria-label="Region" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)} className={inputClass}>
              <option value="">All regions</option>
              <option value="DOMESTIC">Domestic</option>
              <option value="INTERNATIONAL">International</option>
            </select>

            <select
              aria-label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              disabled={typeFilter === 'GROUP'}
              className={inputClass}
            >
              <option value="">All categories</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
              <option value="PLATINUM">Platinum</option>
              <option value="DIAMOND">Diamond Elite</option>
            </select>

            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-muted">BDT</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                aria-label="Minimum price in BDT"
                placeholder="Min price"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className={`${inputClass} pl-12`}
              />
            </div>

            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-muted">BDT</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                aria-label="Maximum price in BDT"
                placeholder="Max price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className={`${inputClass} pl-12`}
              />
            </div>

            <Button variant="secondary" onClick={clearFilters} className="col-span-2 lg:col-span-1">Clear filters</Button>
          </div>
        </form>

        <p role="status" aria-live="polite" className="mb-5 mt-6 text-sm text-text-muted">
          {loading && 'Loading packages…'}
          {!loading && loadError && 'Packages could not be shown.'}
          {!loading && !loadError && (
            <>Found <span className="font-semibold text-brand">{packages.length}</span> {packages.length === 1 ? 'package' : 'packages'}</>
          )}
        </p>

        {loading && (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass overflow-hidden rounded-2xl">
                <Skeleton className="h-44 w-full rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && loadError && (
          <ErrorState
            title="Packages could not be loaded"
            message="Check your connection and try again."
            onRetry={() => runSearch(currentFilters())}
          />
        )}

        {!loading && !loadError && packages.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {packages.map((pkg) => (
              <PackageCard
                key={pkg._id}
                pkg={pkg}
                departures={groupDepartures[pkg._id]}
                saved={savedPackageIds.has(pkg._id)}
                onView={handleViewDetails}
                onToggleSave={toggleSaved}
              />
            ))}
          </div>
        )}

        {!loading && !loadError && packages.length === 0 && (
          <div className="space-y-10">
            <EmptyState
              title="No packages match these filters"
              description="Try another search term, or clear the filters to see every tour of this type."
              action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
            />

            <section aria-labelledby="suggestions-heading">
              <h2 id="suggestions-heading" className="font-display text-xl font-bold text-text">Try these tours instead</h2>
              {loadingSuggestions && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
                </div>
              )}
              {!loadingSuggestions && suggestedPackages.length === 0 && (
                <p className="mt-2 text-sm text-text-muted">No suggestions available right now.</p>
              )}
              {!loadingSuggestions && suggestedPackages.length > 0 && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {suggestedPackages.map((pkg) => (
                    <article
                      key={pkg._id}
                      onClick={() => handleViewDetails(pkg)}
                      className="glass cursor-pointer overflow-hidden rounded-xl transition duration-200 hover:-translate-y-1"
                    >
                      <PackageImage pkg={pkg} className="h-32 w-full" />
                      <div className="p-4">
                        <h3 className="font-semibold text-text">{pkg.title}</h3>
                        <p className="mt-1 text-sm text-text-muted">
                          {pkg.defaultDays} Days • {formatDestinations(pkg.destinations)}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="font-display font-bold text-brand">BDT {Number(pkg.basePrice || 0).toLocaleString()}</span>
                          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleViewDetails(pkg); }}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {showModal && selectedPackage && (
        <TourDetailModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          packageData={selectedPackage}
          userRole="CUSTOMER"
        />
      )}
    </div>
  );
};

export default BrowsePackages;
