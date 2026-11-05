import React, { useState, useEffect, useRef, useId } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { LuCalendar, LuMapPin, LuSearch, LuArrowRight, LuUsers } from 'react-icons/lu';
import Button from './ui/Button.jsx';

const HISTORY_KEY = 'tripbloom_search_history';
const todayString = () => new Date().toISOString().split('T')[0];
const fieldClass = 'min-h-[44px] w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus';

const Hero = () => {
  const navigate = useNavigate();
  const ids = { destination: useId(), type: useId(), dates: useId(), list: useId() };
  const [searchData, setSearchData] = useState({ destination: '', type: 'personal', dates: '' });

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  // Separate refs: the field wrapper and the portalled list are different elements.
  const fieldRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const MAPBOX_TOKEN = typeof import.meta !== 'undefined' ? import.meta.env.VITE_MAPBOX_TOKEN : undefined;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setSearchHistory(JSON.parse(raw));
    } catch {
      // ignore unreadable history
    }
  }, []);

  // Close suggestions when the user clicks anywhere outside both the field and the list.
  useEffect(() => {
    const onPointerDown = event => {
      const inside = (fieldRef.current && fieldRef.current.contains(event.target)) || (listRef.current && listRef.current.contains(event.target));
      if (!inside) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const handleSearch = event => {
    event.preventDefault();
    const destination = (searchData.destination || '').trim();
    const tourType = searchData.type || 'personal';
    // A past date is normalised to today without mutating state in place.
    const dates = searchData.dates && searchData.dates < todayString() ? todayString() : searchData.dates;
    if (dates !== searchData.dates) setSearchData(current => ({ ...current, dates }));

    if (destination) {
      const updated = [destination, ...searchHistory.filter(entry => entry.toLowerCase() !== destination.toLowerCase())].slice(0, 10);
      setSearchHistory(updated);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // storage can be unavailable (private mode); the search still works
      }
      setShowSuggestions(false);
    }

    const params = new URLSearchParams();
    if (destination) params.set('search', destination);
    if (tourType && tourType !== 'all') params.set('type', tourType.toUpperCase());
    const query = params.toString();
    navigate(`/browse-packages${query ? `?${query}` : ''}`);
  };

  const updateSuggestions = value => {
    const query = value.trim();
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
    if (!query) {
      setFilteredSuggestions(searchHistory.slice(0, 6));
      setShowSuggestions(true);
      setActiveSuggestionIndex(-1);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const encoded = encodeURIComponent(query);
        let suggestions = [];
        if (MAPBOX_TOKEN) {
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=8`;
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error('Mapbox error');
          const data = await response.json();
          suggestions = (data.features || []).map(feature => feature.place_name);
        } else {
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&addressdetails=1&limit=8`;
          const response = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
          if (!response.ok) throw new Error('Nominatim error');
          const data = await response.json();
          suggestions = (data || []).map(item => item.display_name);
        }
        const historyMatches = searchHistory.filter(entry => entry.toLowerCase().startsWith(query.toLowerCase()));
        setFilteredSuggestions([...new Set([...historyMatches, ...suggestions])].slice(0, 8));
        setShowSuggestions(true);
        setActiveSuggestionIndex(-1);
      } catch (error) {
        if (error.name === 'AbortError') return;
        setFilteredSuggestions(searchHistory.slice(0, 6));
        setShowSuggestions(true);
      } finally {
        abortRef.current = null;
      }
    }, 300);
  };

  const handleDestinationChange = event => {
    const value = event.target.value;
    setSearchData(current => ({ ...current, destination: value }));
    updateSuggestions(value);
  };

  const chooseSuggestion = value => {
    setSearchData(current => ({ ...current, destination: value }));
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  };

  const handleDestinationKeyDown = event => {
    if (!showSuggestions) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex(index => Math.min(index + 1, filteredSuggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && filteredSuggestions[activeSuggestionIndex]) {
        event.preventDefault();
        chooseSuggestion(filteredSuggestions[activeSuggestionIndex]);
      }
    } else if (event.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const scrollToPackages = event => {
    event.preventDefault();
    document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section id="home" aria-labelledby="hero-heading" className="relative isolate flex min-h-[calc(100vh-4rem)] items-center overflow-hidden pt-16">
      {/* Photo with a layered scrim so the text stays readable in both modes. */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/75" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-strong/70 via-transparent to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center text-white">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur">
            <LuUsers aria-hidden="true" className="h-4 w-4" />
            Personal and group tours
          </p>
          <h1 id="hero-heading" className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Where every journey blossoms
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/90 sm:text-xl">
            Plan a personal tour around your dates, or join a group departure with everything arranged for you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#packages" onClick={scrollToPackages} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-brand px-6 text-base font-semibold text-on-brand shadow-lg transition-colors hover:opacity-90">
              Explore packages
              <LuArrowRight aria-hidden="true" className="h-5 w-5" />
            </a>
            <button type="button" onClick={() => navigate('/browse-packages?type=GROUP')} className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/50 bg-white/10 px-6 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/20">
              Group departures
            </button>
          </div>
        </div>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          role="search"
          aria-label="Find a tour"
          className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 rounded-2xl glass p-4 text-text shadow-2xl sm:p-5 md:grid-cols-12"
        >
          <div ref={fieldRef} className="relative md:col-span-5">
            <label htmlFor={ids.destination} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
              <LuMapPin aria-hidden="true" className="h-4 w-4 text-brand" />
              Destination
            </label>
            <input
              ref={inputRef}
              id={ids.destination}
              type="text"
              autoComplete="off"
              placeholder="Where to?"
              value={searchData.destination}
              onChange={handleDestinationChange}
              onKeyDown={handleDestinationKeyDown}
              onFocus={() => updateSuggestions(searchData.destination || '')}
              className={fieldClass}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions && filteredSuggestions.length > 0}
              aria-controls={ids.list}
              aria-activedescendant={activeSuggestionIndex >= 0 ? `${ids.list}-${activeSuggestionIndex}` : undefined}
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor={ids.type} className="mb-1.5 block text-sm font-medium text-text">Tour type</label>
            <select
              id={ids.type}
              value={searchData.type}
              onChange={event => setSearchData(current => ({ ...current, type: event.target.value }))}
              className={fieldClass}
            >
              <option value="personal">Personal tour</option>
              <option value="group">Group tour</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor={ids.dates} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
              <LuCalendar aria-hidden="true" className="h-4 w-4 text-brand" />
              Dates
            </label>
            <input
              id={ids.dates}
              type="date"
              value={searchData.dates}
              min={todayString()}
              onChange={event => {
                const value = event.target.value;
                setSearchData(current => ({ ...current, dates: value && value < todayString() ? todayString() : value }));
              }}
              className={fieldClass}
            />
          </div>

          <div className="flex items-end md:col-span-2">
            <Button type="submit" size="lg" icon={LuSearch} className="w-full">Search</Button>
          </div>
        </form>
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && ReactDOM.createPortal(
        <ul
          id={ids.list}
          ref={listRef}
          role="listbox"
          className="fixed z-[10000] max-h-60 overflow-auto rounded-lg border border-border bg-surface text-text shadow-xl"
          style={{ top: `${dropdownPosition.top - window.scrollY + 8}px`, left: `${dropdownPosition.left - window.scrollX}px`, width: `${dropdownPosition.width}px` }}
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              id={`${ids.list}-${index}`}
              role="option"
              aria-selected={index === activeSuggestionIndex}
              onMouseDown={event => event.preventDefault()}
              onClick={() => chooseSuggestion(suggestion)}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
              className={`cursor-pointer px-4 py-3 text-sm ${index === activeSuggestionIndex ? 'bg-surface-muted' : 'hover:bg-surface-muted'}`}
            >
              {suggestion}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </section>
  );
};

export default Hero;
