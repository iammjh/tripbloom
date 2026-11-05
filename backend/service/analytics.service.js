import { paymentTotals, roundMoney } from './paymentAccounting.js';
const ref = value => String(value?._id || value || '');
const successfulDate = (payment, booking) => new Date(payment.paidAt || payment.verifiedAt || payment.createdAt || booking.createdAt);
const live = booking => !['CANCELLED', 'REFUNDED'].includes(booking.status);
// Reporting uses Asia/Dhaka days and months. Bangladesh is a fixed UTC+6 with no daylight saving, so fixed-offset arithmetic is exact.
export const REPORT_TIMEZONE = 'Asia/Dhaka';
const DAY_MS = 86400000;
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const dhakaWallClock = instant => new Date(+instant + DHAKA_OFFSET_MS);
export const reportDayKey = instant => dhakaWallClock(instant).toISOString().slice(0, 10);
export function reportDayStart(instant) {
  const wall = dhakaWallClock(instant);
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) - DHAKA_OFFSET_MS);
}
export function reportMonthStart(instant) {
  const wall = dhakaWallClock(instant);
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1) - DHAKA_OFFSET_MS);
}
// A YYYY-MM-DD input names a Dhaka calendar day: its start, or its last millisecond when used as an inclusive end.
export function reportBoundary(value, { endOfDay = false } = {}) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value);
  const [year, month, day] = value.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - DHAKA_OFFSET_MS);
  if (reportDayKey(start) !== value) return new Date(NaN);
  return endOfDay ? new Date(+start + DAY_MS - 1) : start;
}
export function receiptsByCurrency(bookings, from = new Date(0), until = new Date(8640000000000000)) {
  const currencies = {};
  for (const booking of bookings) {
    const currency = booking.currency || 'BDT';
    const totals = currencies[currency] ||= { gross: 0, refunded: 0, net: 0 };
    for (const payment of booking.payments || []) {
      const date = successfulDate(payment, booking);
      if (payment.status !== 'SUCCESS' || date < from || date > until || !Number.isFinite(date.getTime())) continue;
      totals[payment.method === 'REFUND' ? 'refunded' : 'gross'] += Number(payment.amount) || 0;
    }
  }
  for (const totals of Object.values(currencies)) { totals.gross = roundMoney(totals.gross); totals.refunded = roundMoney(totals.refunded); totals.net = roundMoney(totals.gross - totals.refunded); }
  return currencies;
}
export function buildDashboard({ bookings = [], packages = [], departures = [], reviews = [], now = new Date() }) {
  const today = reportDayStart(now);
  const month = reportMonthStart(now);
  const periods = { today, month, overall: new Date(0) };
  const counts = { confirmedByPeriod: {} }, revenue = { currency: 'BDT', periods: {} };
  const bdt = bookings.filter(b => !b.currency || b.currency === 'BDT');
  for (const [key, from] of Object.entries(periods)) {
    const selected = bookings.filter(b => new Date(b.createdAt) >= from && new Date(b.createdAt) <= now);
    counts[key] = selected.length; counts.confirmedByPeriod[key] = selected.filter(b => ['CONFIRMED', 'COMPLETED'].includes(b.status)).length;
    const money = receiptsByCurrency(bdt, from, now).BDT || { gross: 0, refunded: 0, net: 0 };
    const created = bdt.filter(b => new Date(b.createdAt) >= from && new Date(b.createdAt) <= now && live(b));
    revenue.periods[key] = { ...money, booked: roundMoney(created.reduce((sum, b) => sum + Number(b.finalAmount ?? b.totalAmount ?? 0), 0)), outstanding: roundMoney(created.reduce((sum, b) => sum + paymentTotals(b).remaining, 0)) };
  }
  counts.confirmed = counts.confirmedByPeriod.overall;
  revenue.byCurrency = receiptsByCurrency(bookings);
  Object.assign(revenue, revenue.periods.overall, { total: revenue.periods.overall.booked, confirmed: revenue.periods.overall.net, pending: revenue.periods.overall.outstanding });
  const cancelled = bookings.filter(b => ['CANCELLED', 'REFUNDED'].includes(b.status));
  const withRefund = cancelled.filter(b => paymentTotals(b).refunded > 0).length;
  const pct = (value, total) => total ? roundMoney(value * 100 / total) : 0;
  const bookingFunnel = Object.fromEntries(['pending', 'confirmed', 'completed', 'cancelled', 'refunded'].map(status => [status, bookings.filter(b => b.status === status.toUpperCase()).length]));
  bookingFunnel.stuck = bookings.filter(b => b.status === 'PENDING' && new Date(b.createdAt) < new Date(now - 86400000)).length;
  const upcomingDepartures = departures.filter(d => new Date(d.startDate) >= now && new Date(d.startDate) <= new Date(+now + 7 * 86400000) && d.status !== 'CANCELLED').sort((a, b) => new Date(a.startDate) - new Date(b.startDate)).map(d => ({ ...d, isLowOccupancy: d.totalSeats > 0 && d.bookedSeats / d.totalSeats < .3 }));
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(+today - (29 - index) * DAY_MS);
    return { date: reportDayKey(date), personal: 0, group: 0, refunds: 0, personalRefunds: 0, groupRefunds: 0 };
  });
  const byDay = new Map(days.map(day => [day.date, day]));
  for (const booking of bdt) for (const payment of booking.payments || []) {
    if (payment.status !== 'SUCCESS') continue;
    const date = successfulDate(payment, booking); if (!Number.isFinite(+date) || date > now) continue;
    const bucket = byDay.get(reportDayKey(date)); if (!bucket) continue;
    const group = booking.bookingType === 'GROUP'; const amount = Number(payment.amount) || 0;
    if (payment.method === 'REFUND') { bucket.refunds += amount; bucket[group ? 'groupRefunds' : 'personalRefunds'] += amount; }
    else bucket[group ? 'group' : 'personal'] += amount;
  }
  const topPackages = packages.map(pkg => {
    const selected = bookings.filter(b => ref(b.packageId) === ref(pkg._id));
    const ratings = reviews.filter(r => r.status === 'APPROVED' && ref(r.packageId) === ref(pkg._id));
    const rating = ratings.length ? roundMoney(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) : null;
    return { _id: pkg._id, title: pkg.title, bookings: selected.length, revenue: receiptsByCurrency(selected).BDT?.net || 0, currency: 'BDT', rating, reviewCount: ratings.length, isLowRatingHighVolume: rating !== null && rating < 3.5 && selected.length > 50 };
  }).sort((a, b) => b.revenue - a.revenue || b.bookings - a.bookings).slice(0, 5);
  const alerts = upcomingDepartures.flatMap(d => [
    ...(d.isLowOccupancy ? [{ id: `occupancy-${d._id}`, message: `Low occupancy: ${d.packageId?.title || 'Departure'} (${d.bookedSeats}/${d.totalSeats})`, path: '/admin/departures' }] : []),
    ...(!d.operators?.length ? [{ id: `operator-${d._id}`, message: 'Upcoming departure has no assigned operator.', path: '/admin/departures' }] : [])
  ]);
  if (bookingFunnel.stuck) alerts.push({ id: 'stuck', message: `${bookingFunnel.stuck} bookings pending over 24 hours.`, path: '/admin/payments' });
  return { generatedAt: now.toISOString(), timezone: REPORT_TIMEZONE, periodStarts: Object.fromEntries(Object.entries(periods).map(([key, date]) => [key, date.toISOString()])), bookings: counts, revenue, upcomingDepartures, cancellationRate: { total: pct(cancelled.length, bookings.length), withRefund: pct(withRefund, cancelled.length), withoutRefund: pct(cancelled.length - withRefund, cancelled.length), count: cancelled.length }, bookingFunnel, revenueOverTime: days, topPackages, alerts };
}
