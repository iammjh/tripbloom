import React, { useState, useEffect } from 'react';
import { LuBed, LuCalendarDays, LuCar, LuClock, LuMapPin, LuPencil, LuSparkles, LuTriangleAlert, LuUserCog, LuUsers, LuUtensils } from 'react-icons/lu';
import axios from 'axios';
import { PlaneIcon } from './ui/icons.js';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import EmptyState from './ui/EmptyState.jsx';
import Skeleton from './ui/Skeleton.jsx';
import StarRating from './ui/StarRating.jsx';
import { AdminTable, tdClass, thClass } from './admin/AdminPrimitives.jsx';
import { bookingLabel } from '../utils/bookingCode.js';

const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const money = (amount) => `BDT ${Number(amount || 0).toLocaleString()}`;

const BOOKING_TONE = { PENDING: 'warning', CONFIRMED: 'success', CANCELLED: 'danger', COMPLETED: 'info', REFUNDED: 'neutral' };
const DEPARTURE_TONE = { OPEN: 'success', FULL: 'warning', CLOSED: 'neutral', CANCELLED: 'danger' };

// Summary tile used in the overview.
function Stat({ icon: Icon, label, value, children }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand/10">
          <Icon aria-hidden="true" className="h-4 w-4 text-brand" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-text-muted">{label}</p>
          <p className="font-display text-xl font-semibold text-text">{value}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// Package details for administrators: overview, destinations, bookings and group departures.
const PackageDetailModal = ({ isOpen, onClose, packageData, onEdit, initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [bookings, setBookings] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [ratingStats, setRatingStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // Each time the dialog opens, start on the requested tab.
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab || 'overview');
  }, [isOpen, initialTab, packageData?._id]);

  useEffect(() => {
    if (!isOpen || !packageData) return;
    if (activeTab === 'bookings') fetchBookings();
    else if (activeTab === 'departures' && packageData.type === 'GROUP') fetchDepartures();
  }, [isOpen, packageData, activeTab]);

  // Approved-review rating for this package; empty when unavailable.
  useEffect(() => {
    if (!isOpen || !packageData?._id) return;
    axios.get(`/api/packages/${packageData._id}/rating-stats`)
      .then(res => setRatingStats(res.data.stats))
      .catch(() => setRatingStats(null));
  }, [isOpen, packageData?._id]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/bookings', { params: { packageId: packageData._id } });
      setBookings(res.data.bookings || []);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setBookings([]);
    }
    setLoading(false);
  };

  const fetchDepartures = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/group-departures', { params: { packageId: packageData._id } });
      setDepartures(res.data.departures || []);
    } catch (err) {
      console.error('Failed to fetch departures:', err);
    }
    setLoading(false);
  };

  if (!packageData) return null;

  const isGroup = packageData.type === 'GROUP';
  const nights = packageData.defaultNights;
  const activeBookingsCount = bookings.filter(b => ['PENDING', 'CONFIRMED'].includes(b.status)).length;
  const totalBookings = packageData.bookingsCount ?? bookings.length;
  const averageRating = ratingStats?.totalReviews ? Number(ratingStats.averageRating) : null;
  const destinations = [...(packageData.destinations || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const extras = Array.isArray(packageData.extras) ? packageData.extras : [];

  const inclusions = [
    { key: 'transport', icon: LuCar, label: 'Transport', text: packageData.inclusions?.transport },
    { key: 'hotel', icon: LuBed, label: 'Accommodation', text: packageData.inclusions?.hotel },
    { key: 'meals', icon: LuUtensils, label: 'Meals', text: packageData.inclusions?.meals },
    { key: 'guide', icon: LuUserCog, label: 'Tour guide', text: packageData.inclusions?.guide ? 'Professional guide included' : '' },
  ].filter(item => item.text);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'destinations', label: 'Destinations', count: destinations.length },
    { id: 'bookings', label: 'Bookings', count: bookings.length },
    ...(isGroup ? [{ id: 'departures', label: 'Departures', count: departures.length }] : []),
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={packageData.title || 'Tour package'}
      description={`${isGroup ? 'Group tour' : 'Personal tour'} · ${packageData.defaultDays} days, ${nights} nights`}
      size="xl"
      rootClassName="dark"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="secondary" icon={LuPencil} onClick={() => onEdit && onEdit(packageData)}>Edit package</Button>
        </>
      )}
    >
      <div className="space-y-6">
        {/* Summary */}
        <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isGroup ? 'info' : 'brand'}>{isGroup ? 'Group tour' : 'Personal tour'}</Badge>
            {packageData.category && <Badge tone="neutral">{packageData.category}</Badge>}
            {packageData.isInternational && <Badge tone="info" icon={PlaneIcon}>International</Badge>}
            <Badge tone={packageData.isActive === false ? 'neutral' : 'success'}>{packageData.isActive === false ? 'Hidden from customers' : 'Visible to customers'}</Badge>
            {packageData.code && <Badge tone="neutral">Code {packageData.code}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
              <LuClock aria-hidden="true" className="h-4 w-4" />
              {packageData.defaultDays}D / {nights}N
            </span>
            <div className="text-right">
              <p className="text-xs text-text-muted">Base price</p>
              <p className="font-display text-2xl font-semibold text-brand">{money(packageData.basePrice)}</p>
            </div>
          </div>
        </div>

        {activeBookingsCount > 0 && (
          <p role="alert" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
            <LuTriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-warning" />
            <span>This package has {activeBookingsCount} active booking(s). Changes apply to future bookings only.</span>
          </p>
        )}

        {/* Tabs */}
        <div role="tablist" aria-label="Package sections" className="glass flex flex-wrap gap-1 rounded-full p-1">
          {tabs.map(tab => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${selected ? 'bg-brand text-on-brand shadow-sm' : 'text-text-muted hover:text-text'}`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && <span className={`rounded-full px-2 text-xs ${selected ? 'bg-on-brand/20' : 'bg-surface-muted'}`}>{tab.count}</span>}
              </button>
            );
          })}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat icon={LuUsers} label="Total bookings" value={totalBookings ?? '—'} />
              <Stat icon={LuSparkles} label="Average rating" value={averageRating !== null ? averageRating.toFixed(1) : '—'}>
                {averageRating !== null && (
                  <div className="mt-2 flex items-center gap-2">
                    <StarRating value={averageRating} />
                    <span className="text-xs text-text-muted">{ratingStats.totalReviews} review{ratingStats.totalReviews === 1 ? '' : 's'}</span>
                  </div>
                )}
              </Stat>
              <Stat icon={LuCalendarDays} label="Extras included" value={extras.length} />
            </div>

            <section aria-labelledby="package-description-heading" className="space-y-2">
              <h3 id="package-description-heading" className="font-display text-base font-semibold text-text">Description</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">{packageData.description || 'No description yet.'}</p>
            </section>

            <section aria-labelledby="package-inclusions-heading" className="space-y-3">
              <h3 id="package-inclusions-heading" className="font-display text-base font-semibold text-text">Inclusions</h3>
              {inclusions.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {inclusions.map(item => (
                    <div key={item.key} className="glass flex items-start gap-3 rounded-2xl p-4">
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand/10">
                        <item.icon aria-hidden="true" className="h-4 w-4 text-brand" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text">{item.label}</p>
                        <p className="text-sm text-text-muted">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">Nothing listed as included.</p>
              )}
            </section>

            {extras.length > 0 && (
              <section aria-labelledby="package-extras-heading" className="space-y-3">
                <h3 id="package-extras-heading" className="font-display text-base font-semibold text-text">Extras</h3>
                <ul className="flex flex-wrap gap-2">
                  {extras.map((extra, index) => (
                    <li key={index}><Badge tone="neutral">{extra}</Badge></li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* Destinations */}
        {activeTab === 'destinations' && (
          destinations.length > 0 ? (
            <ol className="relative space-y-4 border-l-2 border-border pl-8">
              {destinations.map((dest, index) => (
                <li key={index} className="relative">
                  <span className="absolute -left-[2.875rem] top-4 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand ring-4 ring-surface">
                    {dest.order || index + 1}
                  </span>
                  <div className="glass flex items-start justify-between gap-3 rounded-2xl p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-text">{dest.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-text-muted">
                        <LuMapPin aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
                        {[dest.city, dest.country].filter(Boolean).join(', ') || 'Location not set'}
                      </p>
                    </div>
                    <Badge tone="brand">Day {dest.order || index + 1}</Badge>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No destinations yet" description="Add the places this tour visits in the package editor." />
          )
        )}

        {/* Bookings */}
        {activeTab === 'bookings' && (
          loading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : bookings.length === 0 ? (
            <EmptyState title="No bookings for this package" description="Bookings made for this package appear here." />
          ) : (
            <AdminTable label="Package bookings" minWidth={760}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Booking</th>
                  <th scope="col" className={thClass}>Customer</th>
                  <th scope="col" className={thClass}>Travellers</th>
                  <th scope="col" className={thClass}>Start</th>
                  <th scope="col" className={thClass}>Amount</th>
                  <th scope="col" className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(booking => (
                  <tr key={booking._id}>
                    <td className={`${tdClass} font-semibold text-brand`}>{bookingLabel(booking)}</td>
                    <td className={tdClass}>{booking.customerId?.fullName || 'N/A'}</td>
                    <td className={tdClass}>{booking.numTravelers}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDate(booking.startDate)}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{money(booking.totalAmount)}</td>
                    <td className={tdClass}><Badge tone={BOOKING_TONE[booking.status] || 'neutral'}>{booking.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )
        )}

        {/* Group departures */}
        {activeTab === 'departures' && isGroup && (
          loading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : departures.length === 0 ? (
            <EmptyState title="No departures scheduled" description="Group departures for this package appear here." />
          ) : (
            <ul className="space-y-3">
              {departures.map(departure => (
                <li key={departure._id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">{formatDate(departure.startDate)} – {formatDate(departure.endDate)}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-text-muted">
                      <span>Seats {departure.bookedSeats}/{departure.totalSeats}</span>
                      <span>Operators {departure.operators?.length || 0}</span>
                    </p>
                  </div>
                  <Badge tone={DEPARTURE_TONE[departure.status] || 'neutral'}>{departure.status}</Badge>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </Modal>
  );
};

export default PackageDetailModal;
