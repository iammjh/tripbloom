import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuArrowRight, LuBanknote, LuCalendarDays, LuClock, LuRefreshCw, LuTriangleAlert, LuUsers, LuWallet, LuCircleCheck } from 'react-icons/lu';
import { chartValues } from '../utils/dashboardPresentation';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import Skeleton from './ui/Skeleton.jsx';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'overall', label: 'Overall' },
];

const FUNNEL = [
  { key: 'pending', label: 'Pending', tone: 'bg-warning' },
  { key: 'confirmed', label: 'Confirmed', tone: 'bg-brand' },
  { key: 'completed', label: 'Completed', tone: 'bg-success' },
  { key: 'cancelled', label: 'Cancelled', tone: 'bg-danger' },
  { key: 'refunded', label: 'Refunded', tone: 'bg-info' },
];

const money = value => `BDT ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const count = value => Number(value || 0).toLocaleString();
const SEGMENT = 'min-h-[40px] rounded-full px-4 text-sm font-semibold transition-colors duration-150';

// Headline figure card. The label always has room; `action` sits in the bottom row beside the footer note.
function KpiCard({ icon: Icon, label, action, children, footer }) {
  return (
    <section className="glass flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/10">
          <Icon aria-hidden="true" className="h-5 w-5 text-brand" />
        </span>
        <h2 className="min-w-0 text-sm font-medium text-text-muted">{label}</h2>
      </div>
      <div>{children}</div>
      {(footer || action) && (
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          {footer && <p className="min-w-0 flex-1 text-xs text-text-muted">{footer}</p>}
          {action}
        </div>
      )}
    </section>
  );
}

// Net receipts per day as a line with a soft area, gridlines and hover values.
function ReceiptsChart({ series }) {
  const W = 800, H = 220, padL = 56, padR = 16, padT = 16, padB = 28;
  const low = Math.min(0, ...series.map(day => day.net));
  const high = Math.max(1, ...series.map(day => day.net));
  const span = high - low || 1;
  const x = index => padL + index * (W - padL - padR) / Math.max(1, series.length - 1);
  const y = value => padT + (high - value) / span * (H - padT - padB);
  const points = series.map((day, index) => `${x(index)},${y(day.net)}`).join(' ');
  const area = `${x(0)},${y(low)} ${points} ${x(series.length - 1)},${y(low)}`;
  const gridLevels = [high, (high + low) / 2, low];
  const zeroInside = low < 0 && high > 0;

  // On narrow screens the chart keeps a readable width and scrolls sideways instead of shrinking its labels.
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="min-w-[560px]">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily net receipts in BDT" className="h-56 w-full overflow-visible">
        {gridLevels.map((level, index) => (
          <g key={index}>
            <line x1={padL} x2={W - padR} y1={y(level)} y2={y(level)} className="stroke-border" strokeDasharray="4 6" />
            <text x={padL - 8} y={y(level) + 4} textAnchor="end" className="fill-text-muted text-[11px]">
              {Math.round(level).toLocaleString()}
            </text>
          </g>
        ))}
        {zeroInside && <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} className="stroke-text-muted" strokeWidth="1" />}
        <polygon points={area} style={{ fill: 'rgb(var(--brand))', opacity: 0.12 }} />
        <polyline fill="none" style={{ stroke: 'rgb(var(--brand))' }} strokeWidth="2.5" strokeLinejoin="round" points={points} />
        {series.map((day, index) => (
          <circle key={day.date} cx={x(index)} cy={y(day.net)} r="3.5" style={{ fill: 'rgb(var(--brand))' }}>
            <title>{`${day.date}: ${money(day.net)} net · ${money(day.received)} received · ${money(day.refunded)} refunded`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex justify-between pl-14 text-xs text-text-muted">
        <span>{series[0]?.date}</span>
        <span>{series[Math.floor((series.length - 1) / 2)]?.date}</span>
        <span>{series.at(-1)?.date}</span>
      </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dark text-text space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-10 w-64 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeFilter, setTimeFilter] = useState('month');
  const [bookingsFilter, setBookingsFilter] = useState('all');
  const [revenueFilter, setRevenueFilter] = useState('received');
  const [chartFilter, setChartFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json();
      if (!response.ok || !data.success || !data.dashboard) throw new Error(data.message || 'Unable to load dashboard metrics.');
      setDashboard(data.dashboard);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !dashboard) return <DashboardSkeleton />;
  if (!dashboard) {
    return (
      <div className="dark text-text">
        <ErrorState title="The dashboard could not be loaded" message={error || 'Please try again in a moment.'} onRetry={load} />
      </div>
    );
  }

  const period = dashboard.revenue.periods[timeFilter];
  const bookingTotal = bookingsFilter === 'all' ? dashboard.bookings[timeFilter] : dashboard.bookings.confirmedByPeriod[timeFilter];
  const revenueValue = revenueFilter === 'received' ? period.net : period.booked;
  const series = chartValues(dashboard.revenueOverTime, chartFilter);
  const chartNet = series.reduce((sum, day) => sum + day.net, 0);
  const chartReceived = series.reduce((sum, day) => sum + day.received, 0);
  const chartRefunded = series.reduce((sum, day) => sum + day.refunded, 0);
  const chartEmpty = series.every(day => day.received === 0 && day.refunded === 0);
  const funnelMax = Math.max(1, ...FUNNEL.map(row => dashboard.bookingFunnel[row.key] || 0));
  const otherCurrencies = Object.entries(dashboard.revenue.byCurrency || {}).filter(([currency]) => currency !== 'BDT');

  return (
    <div className="dark text-text space-y-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">Overview</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-text">Dashboard</h1>
          <p className="mt-2 text-sm text-text-muted">
            Measured from recorded activity · periods in Asia/Dhaka time · updated {new Date(dashboard.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Dashboard period" className="glass inline-flex flex-wrap gap-1 rounded-full p-1">
            {PERIODS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={timeFilter === value}
                onClick={() => setTimeFilter(value)}
                className={`${SEGMENT} ${timeFilter === value ? 'bg-brand text-on-brand' : 'text-text-muted hover:text-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="secondary" icon={LuRefreshCw} onClick={load} loading={loading}>
            {loading ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
          <LuTriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-warning" />
          {error} Showing the last loaded figures.
        </p>
      )}

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={LuWallet}
          label={revenueFilter === 'received' ? 'Net receipts' : 'Booked value'}
          action={(
            <button
              type="button"
              onClick={() => setRevenueFilter(value => value === 'received' ? 'booked' : 'received')}
              className="flex-none text-xs font-semibold text-brand underline-offset-4 hover:underline"
            >
              {revenueFilter === 'received' ? 'Show booked value' : 'Show net receipts'}
            </button>
          )}
          footer={`Gross ${money(period.gross)} · refunds ${money(period.refunded)}`}
        >
          <p data-testid="receipt-total" className="font-display text-3xl font-bold text-text">{money(revenueValue)}</p>
        </KpiCard>

        <KpiCard
          icon={LuCalendarDays}
          label="Bookings"
          action={(
            <button
              type="button"
              aria-pressed={bookingsFilter === 'confirmed'}
              onClick={() => setBookingsFilter(value => value === 'confirmed' ? 'all' : 'confirmed')}
              className={`flex-none rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors ${
                bookingsFilter === 'confirmed' ? 'bg-brand text-on-brand ring-brand' : 'text-text-muted ring-border hover:text-text'
              }`}
            >
              Confirmed only
            </button>
          )}
          footer={bookingsFilter === 'confirmed' ? 'Confirmed or completed bookings' : 'All bookings created in this period'}
        >
          <p data-testid="booking-count" className="font-display text-3xl font-bold text-text">{count(bookingTotal)}</p>
        </KpiCard>

        <KpiCard icon={LuClock} label="Outstanding balance" footer="Active bookings created in this period">
          <p className="font-display text-3xl font-bold text-text">{money(period.outstanding)}</p>
        </KpiCard>

        <KpiCard
          icon={LuUsers}
          label="Customers"
          footer={`${count(dashboard.totalOperators)} tour operators · ${count(dashboard.pendingContacts)} unanswered contact messages`}
        >
          <p className="font-display text-3xl font-bold text-text">{count(dashboard.totalUsers)}</p>
          <p className="mt-1 text-sm text-text-muted">{count(dashboard.activeUsers)} active</p>
        </KpiCard>
      </section>

      {otherCurrencies.length > 0 && (
        <p className="text-sm text-text-muted">
          {otherCurrencies.map(([currency, values]) => (
            <span key={currency} className="mr-4">{currency} net receipts: {Number(values.net).toLocaleString()} (excluded from BDT totals)</span>
          ))}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="chart-heading" className="glass rounded-2xl p-5 xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="chart-heading" className="font-display text-lg font-semibold text-text">Net receipts · last 30 days</h2>
              <p className="mt-1 text-sm text-text-muted">Received payments minus completed refunds, by day (Dhaka time).</p>
            </div>
            <select
              aria-label="Chart booking type"
              value={chartFilter}
              onChange={e => setChartFilter(e.target.value)}
              className="min-h-[40px] rounded-lg border border-border bg-surface px-3 text-sm text-text"
            >
              <option value="all">All tours</option>
              <option value="personal">Personal / custom</option>
              <option value="group">Group</option>
            </select>
          </div>

          <div className="mt-6">
            {chartEmpty ? (
              <p className="flex h-56 items-center justify-center text-sm text-text-muted">No received payments or completed refunds in this period.</p>
            ) : (
              <ReceiptsChart series={series} />
            )}
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-4 text-sm">
            <div>
              <dt className="text-text-muted">Net</dt>
              <dd className="mt-1 font-semibold text-text">{money(chartNet)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Received</dt>
              <dd className="mt-1 font-semibold text-text">{money(chartReceived)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Refunded</dt>
              <dd className="mt-1 font-semibold text-text">{money(chartRefunded)}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="funnel-heading" className="glass rounded-2xl p-5">
          <h2 id="funnel-heading" className="font-display text-lg font-semibold text-text">Booking status</h2>
          <ul className="mt-5 space-y-4">
            {FUNNEL.map(({ key, label, tone }) => {
              const value = dashboard.bookingFunnel[key] || 0;
              return (
                <li key={key}>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-text">{label}</span>
                    <span className="font-semibold text-text">{count(value)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted" role="presentation">
                    <div className={`h-full rounded-full ${tone}`} style={{ width: `${(value / funnelMax) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 gap-3">
              <span className="text-text-muted">Pending over 24 hours</span>
              {dashboard.bookingFunnel.stuck > 0
                ? <Badge tone="warning">{count(dashboard.bookingFunnel.stuck)} need attention</Badge>
                : <span className="font-semibold text-text">{count(dashboard.bookingFunnel.stuck)}</span>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 gap-3">
              <span className="text-text-muted">Cancellation rate</span>
              <span className="font-semibold text-text">{dashboard.cancellationRate.total}% · {count(dashboard.cancellationRate.count)} bookings</span>
            </div>
            <p className="text-xs text-text-muted">
              Of cancelled bookings, {dashboard.cancellationRate.withRefund}% have a recorded refund and {dashboard.cancellationRate.withoutRefund}% do not.
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="departures-heading" className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 gap-3">
            <h2 id="departures-heading" className="font-display text-lg font-semibold text-text">Upcoming departures</h2>
            <span className="text-xs text-text-muted">Next 7 days</span>
          </div>
          {dashboard.upcomingDepartures.length === 0 ? (
            <EmptyState icon={LuCalendarDays} title="No departures this week" description="Group departures starting in the next 7 days appear here." className="mt-4" />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {dashboard.upcomingDepartures.map(departure => {
                const fill = departure.totalSeats ? Math.min(100, (departure.bookedSeats / departure.totalSeats) * 100) : 0;
                return (
                  <li key={departure._id}>
                    <button type="button" onClick={() => navigate('/admin/departures')} className="flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-surface-muted/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-text">{departure.packageId?.title || 'Departure'}</p>
                        <p className="mt-1 text-sm text-text-muted">
                          {new Date(departure.startDate).toLocaleDateString()} · {count(departure.operators?.length || 0)} operators
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted" role="presentation">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${fill}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-text-muted">{departure.bookedSeats}/{departure.totalSeats} seats booked</p>
                      </div>
                      {departure.isLowOccupancy && <Badge tone="warning">Low occupancy</Badge>}
                      <LuArrowRight aria-hidden="true" className="h-4 w-4 flex-none text-text-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="alerts-heading" className="glass rounded-2xl p-5">
          <h2 id="alerts-heading" className="font-display text-lg font-semibold text-text">Needs attention</h2>
          {dashboard.alerts.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-text-muted">
              <LuCircleCheck aria-hidden="true" className="h-4 w-4 text-success" /> Nothing needs attention in the current records.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {dashboard.alerts.map(alert => (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => navigate(alert.path)}
                    className="flex w-full items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-left text-sm text-text transition-colors hover:bg-warning/10"
                  >
                    <LuTriangleAlert aria-hidden="true" className="h-4 w-4 flex-none text-warning" />
                    <span className="flex-1">{alert.message}</span>
                    <LuArrowRight aria-hidden="true" className="h-4 w-4 flex-none text-text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="packages-heading" className="glass rounded-2xl p-5">
        <h2 id="packages-heading" className="font-display text-lg font-semibold text-text">Top performing packages</h2>
        {dashboard.topPackages.length === 0 ? (
          <EmptyState title="No packages yet" description="Package performance appears here once tours have bookings." className="mt-4" />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-text-muted">
                <tr className="border-b border-border">
                  <th scope="col" className="py-3 pr-4 font-semibold">Package</th>
                  <th scope="col" className="py-3 pr-4 text-right font-semibold">Bookings</th>
                  <th scope="col" className="py-3 pr-4 text-right font-semibold">Net receipts (BDT)</th>
                  <th scope="col" className="py-3 text-right font-semibold">Approved rating</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.topPackages.map(pkg => (
                  <tr key={pkg._id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                    <td className="py-3 pr-4">
                      <span className="font-medium text-text">{pkg.title}</span>
                      {pkg.isLowRatingHighVolume && <span className="ml-2 align-middle"><Badge tone="warning">Review quality</Badge></span>}
                    </td>
                    <td className="py-3 pr-4 text-right text-text">{count(pkg.bookings)}</td>
                    <td className="py-3 pr-4 text-right text-text">{Number(pkg.revenue || 0).toLocaleString()}</td>
                    <td className="py-3 text-right text-text">{pkg.rating === null ? <span className="text-text-muted">No reviews</span> : `${pkg.rating}/5 (${pkg.reviewCount})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dashboard.recentBookings && dashboard.recentBookings.length > 0 && (
        <section aria-labelledby="recent-heading" className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <LuBanknote aria-hidden="true" className="h-5 w-5 text-brand" />
            <h2 id="recent-heading" className="font-display text-lg font-semibold text-text">Recent bookings</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-text-muted">
                <tr className="border-b border-border">
                  <th scope="col" className="py-3 pr-4 font-semibold">Booked</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Customer</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Package</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Status</th>
                  <th scope="col" className="py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentBookings.map(booking => (
                  <tr key={booking._id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 text-text-muted">{new Date(booking.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 pr-4 text-text">{booking.customerId?.fullName || 'Unknown customer'}</td>
                    <td className="py-3 pr-4 text-text">{booking.packageId?.title || 'Package'}</td>
                    <td className="py-3 pr-4"><Badge value={booking.status || 'PENDING'} /></td>
                    <td className="py-3 text-right font-semibold text-text">{booking.currency || 'BDT'} {Number(booking.finalAmount ?? booking.totalAmount ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs leading-relaxed text-text-muted">
        New receipts require administrator verification. Historical SUCCESS records keep their original status; this dashboard does not independently verify bank settlement.
      </p>
    </div>
  );
}
