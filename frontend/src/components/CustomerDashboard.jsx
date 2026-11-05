import { LuCalendar, LuHeart, LuHistory, LuLogOut, LuMap, LuMessagesSquare, LuPlane, LuStar, LuUser } from 'react-icons/lu';
import { PiGlobeHemisphereWestDuotone, PiMapTrifoldDuotone, PiStarDuotone } from 'react-icons/pi';
import { BackIcon } from './ui/icons.js';
import { userMessage } from '../utils/errorMessage.js';
import { notify } from '../utils/notifyStore.js';
import { paymentTotals } from '../utils/paymentAccounting';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Bookings from './Bookings';
import { useAuth } from '../context/AuthContext';
import CustomerPackageModal from './CustomerPackageModal';
import MapModal from './MapModal';
import BookingDetailModal from './BookingDetailModal';
import OperatorChatModal from './OperatorChatModal';
import NotificationCenter from './NotificationCenter';
import AnnouncementBanner from './AnnouncementBanner';
import AdminChat from './AdminChat';
import ReviewModal from './ReviewModal';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import IconButton from './ui/IconButton.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { CustomerTabs } from './customer/CustomerPageFrame.jsx';
import TourDetailModal from './TourDetailModal';
import { bookingLabel } from '../utils/bookingCode.js';

const CustomerDashboard = () => {
  const navigate = useNavigate();
  // Get user's name from auth context or localStorage
  const { user, logout } = useAuth();
  const userName = (user && user.name) || localStorage.getItem('userName') || 'Traveler';
  const firstName = userName.split(' ')[0];
  const [upcomingTrips, setUpcomingTrips] = React.useState([]);
  const [loadingTrips, setLoadingTrips] = React.useState(true);
  const [packageModalOpen, setPackageModalOpen] = React.useState(false);
  const [packageModalData, setPackageModalData] = React.useState(null);
  const [packageModalTab, setPackageModalTab] = React.useState('overview');
  const [mapOpen, setMapOpen] = React.useState(false);
  const [mapCoords, setMapCoords] = React.useState(null);
  const [mapTitle, setMapTitle] = React.useState('');
  const [bookingModalOpen, setBookingModalOpen] = React.useState(false);
  const [bookingModalData, setBookingModalData] = React.useState(null);
  const [tripsError, setTripsError] = React.useState(null);
  const [chatModalOpen, setChatModalOpen] = React.useState(false);
  const [chatBooking, setChatBooking] = React.useState(null);
  const [chatOperator, setChatOperator] = React.useState(null);
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false);
  const [reviewTargetBooking, setReviewTargetBooking] = React.useState(null);
  const [reviewedPackages, setReviewedPackages] = React.useState(new Set());
  const [showSupportChat, setShowSupportChat] = React.useState(false);
  const [stats, setStats] = React.useState({
    totalTrips: 0,
    countriesVisited: 0,
    rewardPoints: 0
  });

  const checkPaymentStatus = (booking) => {
    const totalPaid = paymentTotals(booking).gross;
    const totalAmount = booking.finalAmount ?? booking.totalAmount ?? booking.amount ?? 0;
    const isPaid = totalPaid >= totalAmount;
    const startDate = booking.startDate ? new Date(booking.startDate) : null;
    const now = new Date();
    const daysUntilStart = startDate ? Math.ceil((startDate - now) / (1000 * 60 * 60 * 24)) : null;
    return { totalPaid, totalAmount, isPaid, daysUntilStart, startDate };
  };

  React.useEffect(() => {
    const load = async () => {
      const userId = (user && user.id) || localStorage.getItem('userId');
      if (!userId) {
        setUpcomingTrips([]);
        setLoadingTrips(false);
        return;
      }

      setLoadingTrips(true);
      setTripsError(null);
      try {
        const res = await fetch(`/api/bookings?customerId=${userId}`);
        if (!res.ok) {
          const text = await res.text();
          console.error('Dashboard bookings fetch error', res.status, text);
          setTripsError(`HTTP ${res.status}`);
          setUpcomingTrips([]);
          setLoadingTrips(false);
          return;
        }
        const data = await res.json();
        console.debug('[CustomerDashboard] bookings API response:', data);
        let bookings = [];
        if (Array.isArray(data)) bookings = data;
        else if (data && data.success && data.bookings) bookings = data.bookings;
        else if (data && data.message) setTripsError(data.message);

        // Filter upcoming and ongoing (include bookings where endDate is today or later)
        const now = new Date();
        const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const upcoming = bookings.filter(b => {
          const st = (b.status || '').toString().toUpperCase();
          if (st === 'CANCELLED' || st === 'COMPLETED') return false;
          const sd = b.startDate ? new Date(b.startDate) : null;
          const ed = b.endDate ? new Date(b.endDate) : sd;
          if (!sd && !ed) return true;
          const endDay = ed ? new Date(ed.getFullYear(), ed.getMonth(), ed.getDate()) : null;
          const startDay = sd ? new Date(sd.getFullYear(), sd.getMonth(), sd.getDate()) : null;
          // include if start is in the future, or the trip is ongoing (today between start and end)
          if (startDay && startDay >= todayDay) return true;
          if (startDay && endDay && todayDay >= startDay && todayDay <= endDay) return true;
          // also include if no start but end is in future
          if (!startDay && endDay && endDay >= todayDay) return true;
          return false;
        }).map(b => ({
          id: b._id || b.id,
          // backend populates package under `packageId`
          destination: b.packageId?.destination || b.packageId?.title || b.package?.destination || b.package?.title || b.packageTitle || 'Package',
          startDate: b.startDate,
          endDate: b.endDate,
          dateLabel: b.startDate ? `${new Date(b.startDate).toLocaleDateString()}${b.endDate ? ' - ' + new Date(b.endDate).toLocaleDateString() : ''}` : 'TBD',
          image: b.packageId?.photos?.[0] || b.package?.image || `https://source.unsplash.com/featured/?${encodeURIComponent((b.packageId?.destination || b.package?.destination || 'travel'))}`,
          status: b.status || 'PENDING',
          // determine if trip is currently ongoing
          isOngoing: (function() {
            try {
              // if booking already completed, do not treat as ongoing
              if (b.status === 'COMPLETED') return false;
              if (!b.startDate) return false;
              const sd = new Date(b.startDate);
              const ed = b.endDate ? new Date(b.endDate) : sd;
              const startDay = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate());
              const endDay = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
              const nowDay = new Date((new Date()).getFullYear(), (new Date()).getMonth(), (new Date()).getDate());
              return nowDay >= startDay && nowDay <= endDay;
            } catch (err) { return false; }
          })(),
          booking: {
            ...b,
            checkedIn: b.checkedIn || (localStorage.getItem(`checkedIn_${b._id || b.id}`) === 'true')
          }
        }));

        setUpcomingTrips(upcoming);
        console.debug('[CustomerDashboard] mapped upcomingTrips:', upcoming);
        console.debug('[CustomerDashboard] bookings with assignedOperator check:', 
          upcoming.map(t => ({
            id: t.id,
            hasOperator: !!t.booking?.assignedOperator,
            operator: t.booking?.assignedOperator
          }))
        );
        // detect if any trip is happening today (start <= today <= end)
        try {
          const today = new Date();
          const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

          // prefer bookings that are CONFIRMED and paid that start today
          const confirmedPaidToday = bookings.find(b => {
            const st = (b.status || '').toString().toUpperCase();
            if (st !== 'CONFIRMED') return false;
            try {
              const paymentInfo = (function() {
                // reuse local helper checkPaymentStatus if available
                try { return checkPaymentStatus(b); } catch (e) { return { isPaid: false }; }
              })();
              if (!paymentInfo.isPaid) return false;
            } catch (e) { return false; }
            if (!b.startDate) return false;
            const sd = new Date(b.startDate);
            const startDay = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate());
            return startDay.getTime() === todayDay.getTime();
          });

          let chosen = null;
          if (confirmedPaidToday) chosen = confirmedPaidToday;
          else {
            // look through all bookings (not only upcoming) to find ongoing trips
            const ongoing = bookings.find(b => {
              const st = (b.status || '').toString().toUpperCase();
              if (st === 'COMPLETED' || st === 'CANCELLED') return false;
              if (!b.startDate) return false;
              // Require booking to be either explicitly CONFIRMED or have been paid
              try {
                const paymentInfo = checkPaymentStatus(b);
                if (!paymentInfo.isPaid && st !== 'CONFIRMED') return false;
              } catch (e) { return false; }
              const sd = new Date(b.startDate);
              const ed = b.endDate ? new Date(b.endDate) : sd;
              const startDay = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate());
              const endDay = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
              return todayDay >= startDay && todayDay <= endDay;
            });
            chosen = ongoing;
          }

          if (chosen) {
            const t = {
              id: chosen._id || chosen.id,
              destination: chosen.packageId?.destination || chosen.packageId?.title || chosen.package?.destination || chosen.package?.title || chosen.packageTitle || 'Package',
              startDate: chosen.startDate,
              endDate: chosen.endDate,
              dateLabel: chosen.startDate ? `${new Date(chosen.startDate).toLocaleDateString()}${chosen.endDate ? ' - ' + new Date(chosen.endDate).toLocaleDateString() : ''}` : 'TBD',
              image: chosen.packageId?.photos?.[0] || chosen.package?.image || `https://source.unsplash.com/featured/?${encodeURIComponent((chosen.packageId?.destination || chosen.package?.destination || 'travel'))}`,
              status: chosen.status || 'PENDING',
              booking: {
                ...chosen,
                checkedIn: chosen.checkedIn || (localStorage.getItem(`checkedIn_${chosen._id || chosen.id}`) === 'true')
              }
            };
            setTodayTrip(t);
          } else {
            setTodayTrip(null);
          }
        } catch (err) {
          console.debug('Error detecting today trip', err);
        }
        
        // Calculate stats from bookings
        const totalTrips = bookings.filter(b => b.status === 'COMPLETED').length;
        
        // Get unique countries from completed bookings
        const countries = new Set();
        bookings.filter(b => b.status === 'COMPLETED').forEach(b => {
          const destinations = b.packageId?.destinations || b.package?.destinations || [];
          destinations.forEach(dest => {
            if (dest.country) countries.add(dest.country);
          });
        });
        
        setStats(prev => ({
          ...prev,
          totalTrips,
          countriesVisited: countries.size
        }));
        // After loading bookings, check which packages the customer already reviewed
        (async () => {
          try {
            const userId = (user && user.id) || localStorage.getItem('userId');
            if (!userId) return;
            const uniquePkgIds = Array.from(new Set(bookings.map(b => (b.packageId?._id || b.packageId || b.package?._id || b.package)))).filter(Boolean);
            const reviewed = new Set();
            await Promise.all(uniquePkgIds.map(async (pkgId) => {
              try {
                const res = await fetch(`/api/customers/${userId}/packages/${pkgId}/review`);
                if (!res.ok) return;
                const data = await res.json();
                if (data && data.success && data.review) reviewed.add(pkgId.toString());
              } catch (err) {
                // ignore
              }
            }));
            setReviewedPackages(new Set(Array.from(reviewed)));
          } catch (err) {
            // ignore
          }
        })();
      } catch (err) {
        console.error('Dashboard bookings error', err);
        setTripsError('Failed to load trips');
        setUpcomingTrips([]);
      }
      setLoadingTrips(false);
    };
    load();
    // listen for cross-component booking updates (e.g., marked completed elsewhere)
    const onBookingUpdated = (e) => {
      try {
        const updated = e && e.detail ? e.detail : null;
        if (!updated) return;
        const idRaw = updated._id || updated.id;
        if (!idRaw) return;
        const idStr = (idRaw && typeof idRaw.toString === 'function') ? idRaw.toString() : idRaw;
        const terminal = ['CANCELLED', 'REFUNDED', 'COMPLETED'].includes(updated.status);
        setUpcomingTrips(previous => previous.flatMap(trip => {
          if (String(trip.id || trip._id) !== idStr) return [trip];
          if (terminal) return [];
          return [{ ...trip, status: updated.status || trip.status, booking: { ...trip.booking, ...updated,
            packageId: typeof updated.packageId === 'string' ? trip.booking.packageId : updated.packageId } }];
        }));
        // update todayTrip if it matches
        setTodayTrip(prev => {
          if (!prev) return prev;
          const prevId = prev.id || prev._id || (prev.booking && (prev.booking._id || prev.booking.id));
          const prevIdStr = (prevId && typeof prevId.toString === 'function') ? prevId.toString() : prevId;
          if (prevIdStr === idStr) return ({ ...prev, booking: { ...prev.booking, ...updated }, status: updated.status || prev.status, isOngoing: terminal ? false : prev.isOngoing });
          return prev;
        });
      } catch (err) { /* ignore */ }
    };
    window.addEventListener('bookingUpdated', onBookingUpdated);
    return () => {
      window.removeEventListener('bookingUpdated', onBookingUpdated);
    };
  }, [user]);

  // Fetch user reward points
  React.useEffect(() => {
    const fetchRewardPoints = async () => {
      const userId = (user && user.id) || localStorage.getItem('userId');
      console.log('[CustomerDashboard] Fetching reward points for userId:', userId);
      if (userId) {
        try {
          const res = await fetch(`/api/users/${userId}`);
          const data = await res.json();
          console.log('[CustomerDashboard] User data response:', data);
          if (data.success && data.user) {
            console.log('[CustomerDashboard] Setting reward points:', data.user.rewardPoints);
            setStats(prev => ({
              ...prev,
              rewardPoints: data.user.rewardPoints || 0
            }));
          }
        } catch (err) {
          console.error('Failed to fetch reward points:', err);
        }
      }
    };
    fetchRewardPoints();
  }, [user]);

  // null while loading; the saved packages once fetched.
  const [savedTours, setSavedTours] = useState(null);
  const [savedDetail, setSavedDetail] = useState(null);
  const [todayTrip, setTodayTrip] = useState(null);
  const [checkedInBookings, setCheckedInBookings] = useState({});

  useEffect(() => {
    const loadSaved = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) { setSavedTours([]); return; }
        const res = await fetch(`/api/users/${userId}/saved`);
        const data = await res.json();
        setSavedTours(Array.isArray(data?.packages) ? data.packages : []);
      } catch (err) {
        console.error('Failed to load saved tours', err);
        setSavedTours([]);
      }
    };
    loadSaved();
  }, []);

  const handleCheckIn = async (trip) => {
    const bookingId = trip.id;
    const userId = (user && user.id) || localStorage.getItem('userId');
    try {
      // try a dedicated check-in endpoint first
      const res = await fetch(`/api/bookings/${bookingId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        setCheckedInBookings(prev => ({ ...prev, [bookingId]: true }));
        // persist fallback locally so a reload still shows checked-in if backend didn't save yet
        try { localStorage.setItem(`checkedIn_${bookingId}`, 'true'); } catch (e) { /* ignore */ }
        // fetch updated booking from server to reflect persisted state
        try {
          const refreshed = await fetch(`/api/bookings/${bookingId}`);
          if (refreshed.ok) {
            const rdata = await refreshed.json();
            const bk = rdata.booking || rdata;
                setUpcomingTrips(prev => prev.map(t => t.id === bookingId ? ({ ...t, booking: { ...t.booking, ...bk }, isOngoing: (bk.status === 'COMPLETED' ? false : t.isOngoing) }) : t));
                setTodayTrip(prev => (prev && prev.id === bookingId) ? ({ ...prev, booking: { ...prev.booking, ...bk }, isOngoing: (bk.status === 'COMPLETED' ? false : (prev.isOngoing)) }) : prev);
          } else {
            // fallback optimistic update
                setUpcomingTrips(prev => prev.map(t => t.id === bookingId ? ({ ...t, booking: { ...t.booking, checkedIn: true }, isOngoing: t.isOngoing }) : t));
                setTodayTrip(prev => (prev && prev.id === bookingId) ? ({ ...prev, booking: { ...prev.booking, checkedIn: true }, isOngoing: prev.isOngoing }) : prev);
          }
        } catch (err) {
          setUpcomingTrips(prev => prev.map(t => t.id === bookingId ? ({ ...t, booking: { ...t.booking, checkedIn: true }, isOngoing: t.isOngoing }) : t));
        }
        notify.message('You are checked in for today\'s tour.');
        return;
      }
      // fallback: try to patch booking (if backend supports)
      const res2 = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedIn: true })
      });
      if (res2.ok) {
        setCheckedInBookings(prev => ({ ...prev, [bookingId]: true }));
        try { localStorage.setItem(`checkedIn_${bookingId}`, 'true'); } catch (e) { /* ignore */ }
        try {
          const refreshed = await fetch(`/api/bookings/${bookingId}`);
          if (refreshed.ok) {
            const rdata = await refreshed.json();
            const bk = rdata.booking || rdata;
            setUpcomingTrips(prev => prev.map(t => t.id === bookingId ? ({ ...t, booking: { ...t.booking, ...bk }, isOngoing: (bk.status === 'COMPLETED' ? false : t.isOngoing) }) : t));
            setTodayTrip(prev => (prev && prev.id === bookingId) ? ({ ...prev, booking: { ...prev.booking, ...bk }, isOngoing: (bk.status === 'COMPLETED' ? false : (prev.isOngoing)) }) : prev);
          } else {
            setUpcomingTrips(prev => prev.map(t => t.id === bookingId ? ({ ...t, booking: { ...t.booking, checkedIn: true }, isOngoing: t.isOngoing }) : t));
            setTodayTrip(prev => (prev && prev.id === bookingId) ? ({ ...prev, booking: { ...prev.booking, checkedIn: true } }) : prev);
          }
        } catch (err) {
          setUpcomingTrips(prev => prev.map(t => t.id === bookingId ? ({ ...t, booking: { ...t.booking, checkedIn: true }, isOngoing: t.isOngoing }) : t));
        }
        notify.message('You are checked in for today\'s tour.');
        return;
      }
      const txt = await res.text();
      notify.error(userMessage(txt, 'Check-in failed. Please try again.'));
    } catch (err) {
      console.error('Check-in error', err);
      notify.message('Check-in failed, please try again later.');
    }
  };

  const handleEndTour = async (trip) => {
    const bookingId = trip.id;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, { method: 'POST' });
      if (!res.ok) {
        const txt = await res.text();
        notify.error(userMessage(txt, 'The tour could not be marked as completed. Please try again.'));
        return;
      }
      const data = await res.json();
      const updated = data.booking || data;
      // remove from upcomingTrips and update todayTrip
      setUpcomingTrips(prev => prev.filter(t => t.id !== bookingId));
      setTodayTrip(prev => (prev && prev.id === bookingId) ? ({ ...prev, booking: { ...prev.booking, ...updated }, status: updated.status || 'COMPLETED', isOngoing: false }) : prev);
      // notify other components (e.g., Bookings) to refresh/move the booking
      try { window.dispatchEvent(new CustomEvent('bookingUpdated', { detail: updated })); } catch (e) { /* ignore */ }
      notify.message('Tour marked as completed. You can now write a review.');
      // open review modal for the completed booking
      setReviewTargetBooking(updated);
      setReviewModalOpen(true);
    } catch (err) {
      console.error('End tour error', err);
      notify.message('Failed to end tour, please try again later.');
    }
  };

  const todayChecked = todayTrip ? ((todayTrip.booking && (todayTrip.booking.checkedIn || todayTrip.booking.checkedInByUser)) || checkedInBookings[todayTrip.id]) : false;

  // Opens the package behind a booking, falling back to the trip itself.
  const openTripPackage = (trip) => {
    const pkg = trip.booking?.packageId || trip.booking?.package || trip;
    setPackageModalData(pkg);
    setPackageModalTab('overview');
    setPackageModalOpen(true);
  };

  const openOperatorChat = (trip) => {
    if (!trip.booking?.assignedOperator) {
      notify.message('No operator assigned to this tour yet. Please contact support.');
      return;
    }
    setChatBooking(trip.booking);
    setChatOperator(trip.booking.assignedOperator);
    setChatModalOpen(true);
  };

  // Shows the tour on a map. Uses the package's own location, else a known destination; otherwise the destinations tab.
  const openTripMap = (trip) => {
    const pkg = trip.booking?.packageId || trip.booking?.package || trip;
    let coords = null;
    if (pkg.mapLocation && pkg.mapLocation.lat && pkg.mapLocation.lng) {
      coords = { lat: pkg.mapLocation.lat, lng: pkg.mapLocation.lng, zoom: pkg.mapLocation.zoom || 12 };
    } else {
      const destinationCoords = {
        'sajek valley': { lat: 23.3817, lng: 92.2938, zoom: 13 },
        'bandarban': { lat: 22.1953, lng: 92.2184, zoom: 12 },
        'cox\'s bazar': { lat: 21.4272, lng: 92.0058, zoom: 12 },
        'coxs bazar': { lat: 21.4272, lng: 92.0058, zoom: 12 },
        'rangamati': { lat: 22.6533, lng: 92.1753, zoom: 12 },
        'sylhet': { lat: 24.8949, lng: 91.8687, zoom: 12 },
        'sundarbans': { lat: 21.9497, lng: 89.1833, zoom: 11 },
        'kuakata': { lat: 21.8167, lng: 90.1167, zoom: 13 },
        'srimangal': { lat: 24.3065, lng: 91.7296, zoom: 13 },
        'saint martin': { lat: 20.6274, lng: 92.3233, zoom: 14 },
        'dhaka': { lat: 23.8103, lng: 90.4125, zoom: 11 }
      };
      if (pkg.destinations && Array.isArray(pkg.destinations)) {
        const mainDest = pkg.destinations.find((d, idx) => idx > 0 && d.name) || pkg.destinations[0];
        if (mainDest && mainDest.name) {
          const destName = mainDest.name.toLowerCase();
          const cityName = mainDest.city?.toLowerCase();
          coords = destinationCoords[destName] || destinationCoords[cityName];
          if (!coords) {
            for (const [key, value] of Object.entries(destinationCoords)) {
              if (destName.includes(key) || key.includes(destName) ||
                  (cityName && (cityName.includes(key) || key.includes(cityName)))) {
                coords = value;
                break;
              }
            }
          }
          if (coords) coords = { ...coords, label: mainDest.name };
        }
      }
    }
    if (coords) {
      setMapCoords(coords);
      setMapTitle(pkg.title || trip.destination || 'Location');
      setMapOpen(true);
      return;
    }
    setPackageModalData(pkg);
    setPackageModalTab('destinations');
    setPackageModalOpen(true);
  };

  // One upcoming trip card: photo, status, and the actions that apply to its state.
  const renderTrip = (trip, index) => {
    const pkgId = trip.booking?.packageId?._id || trip.booking?.packageId || (trip.booking?.package?._id || trip.booking?.package);
    const reviewed = Boolean(pkgId && reviewedPackages && reviewedPackages.has(pkgId.toString()));
    const hasOperator = Boolean(trip.booking?.assignedOperator);
    return (
      <article key={trip.id || index} data-booking-id={trip.id} className="glass flex flex-col overflow-hidden rounded-2xl">
        <div className="relative h-44 overflow-hidden bg-surface-muted">
          <TripPhoto src={trip.image} alt={trip.destination} />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <p className="text-xs font-semibold tracking-wide text-white/80">{bookingLabel(trip.booking)}</p>
              <h3 className="font-display text-xl font-bold">{trip.destination}</h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-white/85">
              <LuCalendar aria-hidden="true" className="h-4 w-4 flex-none" />
              {trip.dateLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge value={trip.status} />
            {trip.isOngoing && <Badge tone="brand">Ongoing</Badge>}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button size="sm" onClick={() => openTripPackage(trip)}>View Details</Button>
            <IconButton
              label={hasOperator ? 'Chat with tour operator' : 'No operator assigned yet'}
              icon={LuMessagesSquare}
              onClick={() => openOperatorChat(trip)}
            />
            {(trip.booking?.status === 'CONFIRMED' || trip.booking?.status === 'CHECKED_IN') && trip.isOngoing && (
              <Button size="sm" variant="secondary" onClick={() => handleEndTour(trip)}>End tour</Button>
            )}
            {trip.booking?.status === 'COMPLETED' && (reviewed ? (
              <Button size="sm" variant="secondary" onClick={() => navigate('/customer/reviews')}>View review</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => { setReviewTargetBooking(trip.booking); setReviewModalOpen(true); }}>Write review</Button>
            ))}
            <IconButton label="Show on map" icon={LuMap} className="border border-border" onClick={() => openTripMap(trip)} />
          </div>
        </div>
      </article>
    );
  };

  const stats_cards = [
    { label: 'Total trips', value: stats.totalTrips, Icon: PiMapTrifoldDuotone },
    { label: 'Countries visited', value: stats.countriesVisited, Icon: PiGlobeHemisphereWestDuotone },
    { label: 'Reward points', value: Number(stats.rewardPoints || 0).toLocaleString(), Icon: PiStarDuotone },
  ];

  return (
    <div className="dark mesh-bg min-h-screen text-text">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" icon={BackIcon} onClick={() => navigate('/')} className="-ml-3 mb-2">Back to home</Button>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">Your account</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-text sm:text-4xl">Welcome back, {firstName}</h1>
            <p className="mt-2 text-base text-text-muted">Your next adventure awaits.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NotificationCenter
              userId={(user && user.id) || localStorage.getItem('userId')}
              userRole="CUSTOMER"
              onOpenChat={(booking, operator) => {
                setChatBooking(booking);
                setChatOperator(operator);
                setChatModalOpen(true);
              }}
            />
            <Button variant="secondary" icon={LuLogOut} onClick={() => { logout(); navigate('/'); }}>Log out</Button>
          </div>
        </header>

        <AnnouncementBanner userRole="CUSTOMERS" />

        <section aria-label="Travel summary" className="grid gap-4 sm:grid-cols-3">
          {stats_cards.map(({ label, value, Icon }) => (
            <div key={label} className="glass flex items-center gap-4 rounded-2xl p-5">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand/10">
                <Icon aria-hidden="true" className="h-7 w-7 text-brand" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-text-muted">{label}</p>
                <p className="font-display text-3xl font-bold text-text">{value}</p>
              </div>
            </div>
          ))}
        </section>

        <CustomerTabs active="trips" />

        {todayTrip && (
          <section aria-labelledby="today-heading" className="glass rounded-2xl p-5 ring-1 ring-brand/40 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-wider text-brand">Today's tour</p>
                <h2 id="today-heading" className="mt-1 font-display text-2xl font-bold text-text">{todayTrip.destination}</h2>
                <p className="mt-1 text-sm text-text-muted">
                  {todayTrip.dateLabel} · Operator: {todayTrip.booking?.assignedOperator?.name || 'TBD'}
                </p>
              </div>
              <Button size="lg" variant={todayChecked ? 'secondary' : 'primary'} disabled={todayChecked} onClick={() => handleCheckIn(todayTrip)}>
                {todayChecked ? 'Checked in' : 'Check in'}
              </Button>
            </div>
          </section>
        )}

        <section aria-labelledby="upcoming-heading" className="space-y-5">
          <h2 id="upcoming-heading" className="flex items-center gap-2 font-display text-2xl font-bold text-text">
            <LuCalendar aria-hidden="true" className="h-6 w-6 text-brand" />
            Upcoming trips
          </h2>
          {loadingTrips && (
            <div className="grid gap-6 md:grid-cols-2" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="glass overflow-hidden rounded-2xl">
                  <Skeleton className="h-44 w-full rounded-none" />
                  <div className="space-y-3 p-5"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
                </div>
              ))}
            </div>
          )}
          {!loadingTrips && tripsError && (
            <ErrorState
              title="Your trips could not be loaded"
              message="Please refresh the page. If it keeps happening, contact support."
              onRetry={() => window.location.reload()}
            />
          )}
          {!loadingTrips && !tripsError && upcomingTrips.length === 0 && (
            <EmptyState
              title="No upcoming trips"
              description="Book a tour and it will appear here."
              action={<Button onClick={() => navigate('/browse-packages')}>Browse tours</Button>}
            />
          )}
          {!loadingTrips && !tripsError && upcomingTrips.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              {upcomingTrips.map(renderTrip)}
            </div>
          )}
        </section>

        {packageModalOpen && packageModalData && (
          <CustomerPackageModal
            isOpen={packageModalOpen}
            onClose={() => setPackageModalOpen(false)}
            packageData={packageModalData}
            initialTab={packageModalTab}
          />
        )}

        {bookingModalOpen && bookingModalData && (
          <BookingDetailModal booking={bookingModalData} onClose={() => setBookingModalOpen(false)} onUpdate={updated => {
            setBookingModalData(previous => ({ ...previous, ...updated, packageId: typeof updated.packageId === 'string' ? previous.packageId : updated.packageId }));
            window.dispatchEvent(new CustomEvent('bookingUpdated', { detail: updated }));
          }} />
        )}

        {mapOpen && (
          <MapModal isOpen={mapOpen} onClose={() => setMapOpen(false)} coords={mapCoords} title={mapTitle} />
        )}

        {chatModalOpen && chatBooking && (
          <OperatorChatModal
            isOpen={chatModalOpen}
            onClose={() => {
              setChatModalOpen(false);
              setChatBooking(null);
              setChatOperator(null);
            }}
            booking={chatBooking}
            operator={chatOperator}
          />
        )}

        {reviewModalOpen && reviewTargetBooking && (
          <ReviewModal
            isOpen={reviewModalOpen}
            booking={reviewTargetBooking}
            onClose={() => { setReviewModalOpen(false); setReviewTargetBooking(null); }}
            onSubmitted={(booking) => {
              const pkgId = booking.packageId?._id || booking.packageId || (booking.package?._id || booking.package);
              if (pkgId) setReviewedPackages(prev => {
                const copy = new Set(Array.from(prev));
                copy.add(pkgId.toString());
                return copy;
              });
              // mark upcomingTrips and todayTrip locally as reviewed so UI updates
              try {
                setUpcomingTrips(prev => prev.map(t => {
                  const bid = t.booking?._id || t.booking?.id;
                  if (bid && (bid === (booking._id || booking.id))) {
                    return { ...t, booking: { ...t.booking, _reviewed: true } };
                  }
                  return t;
                }));
                setTodayTrip(prev => {
                  if (!prev) return prev;
                  const bid = prev.booking?._id || prev.booking?.id;
                  if (bid && (bid === (booking._id || booking.id))) return { ...prev, booking: { ...prev.booking, _reviewed: true } };
                  return prev;
                });
              } catch (err) { /* ignore */ }
            }}
          />
        )}

        <section aria-label="Bookings">
          <Bookings />
        </section>

        <section aria-labelledby="saved-heading" className="space-y-5">
          <h2 id="saved-heading" className="flex items-center gap-2 font-display text-2xl font-bold text-text">
            <LuHeart aria-hidden="true" className="h-6 w-6 text-danger" />
            Saved tours
          </h2>
          {savedTours === null && (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
            </div>
          )}
          {savedTours !== null && savedTours.length === 0 && (
            <EmptyState
              title="No saved tours yet"
              description="Save a tour from the browse page to find it here later."
              action={<Button variant="secondary" onClick={() => navigate('/browse-packages')}>Browse tours</Button>}
            />
          )}
          {savedTours !== null && savedTours.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {savedTours.map((tour) => (
                <article key={tour._id} className="glass flex flex-col gap-3 rounded-2xl p-5">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-text">{tour.title}</h3>
                    <p className="mt-1 text-sm text-text-muted">{tour.defaultDays} Days / {tour.defaultNights} Nights</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="font-display text-xl font-bold text-brand">BDT {Number(tour.basePrice || 0).toLocaleString()}</p>
                    <Button size="sm" onClick={() => setSavedDetail(tour)}>View Details</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {savedDetail && (
          <TourDetailModal
            isOpen={Boolean(savedDetail)}
            onClose={() => setSavedDetail(null)}
            packageData={savedDetail}
            userRole="CUSTOMER"
          />
        )}
      </div>

      {/* Support chat */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setShowSupportChat((open) => !open)}
          aria-label="Open support chat"
          title="Support"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg transition-transform hover:scale-105"
        >
          <LuMessagesSquare aria-hidden="true" size={20} />
        </button>
      </div>
      {showSupportChat && (
        <div className="glass fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl">
          <AdminChat currentUserId={(user && user.id) || localStorage.getItem('userId')} />
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;

// Photo for a trip card. Shows a branded field when there is no photo or the photo fails to load.
function TripPhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-brand-strong via-surface to-info/40" />;
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
