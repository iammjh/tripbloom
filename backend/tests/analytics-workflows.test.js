import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard, receiptsByCurrency, reportBoundary } from '../service/analytics.service.js';
const now = new Date('2026-11-04T12:00:00Z');
const payment = (amount, method = 'BKASH', status = 'SUCCESS') => ({ amount, method, status, paidAt: now });
test('analytics distinguishes received, refunded, booked, pending and currency', () => {
 const bookings = [
 { packageId: 'p', bookingType: 'GROUP', status: 'CONFIRMED', createdAt: now, finalAmount: 800, currency: 'BDT', payments: [payment(800)] },
 { packageId: 'p', bookingType: 'PRIVATE', status: 'CANCELLED', createdAt: '2026-10-01', finalAmount: 500, payments: [payment(500), payment(200, 'REFUND')] },
 { status: 'PENDING', createdAt: now, finalAmount: 600, payments: [payment(600, 'CASH', 'PENDING')] },
 { status: 'CONFIRMED', createdAt: now, finalAmount: 100, currency: 'USD', payments: [payment(100)] }
 ];
 const result = buildDashboard({ bookings, packages: [{ _id: 'p', title: 'Verified package' }], reviews: [{ packageId: 'p', status: 'APPROVED', rating: 4 }, { packageId: 'p', status: 'PENDING', rating: 1 }], now });
 assert.equal(result.bookings.today, 3); assert.equal(result.bookings.confirmedByPeriod.today, 2);
 assert.equal(result.revenue.gross, 1300); assert.equal(result.revenue.refunded, 200); assert.equal(result.revenue.net, 1100);
 assert.equal(result.revenue.periods.today.booked, 1400); assert.equal(result.revenue.pending, 600);
 assert.equal(result.revenue.byCurrency.USD.net, 100);
 assert.equal(result.topPackages[0].rating, 4); assert.equal(result.revenueOverTime.at(-1).refunds, 200);
 assert.equal(receiptsByCurrency(bookings, new Date(+now + 1)).BDT.net, 0);
});
test('empty metrics have zero counts and thirty chronological buckets', () => {
 const result = buildDashboard({ now }); assert.equal(result.cancellationRate.total, 0); assert.equal(result.revenue.net, 0);
 assert.equal(result.revenueOverTime.length, 30); assert.equal(result.revenueOverTime.at(-1).date, '2026-11-04');
});
test('reporting days and months follow Asia/Dhaka rather than UTC', () => {
 const dhakaNow = new Date('2026-11-05T03:00:00Z'); // 09:00 on 5 Nov in Dhaka
 const lateNight = new Date('2026-11-04T20:00:00Z'); // 02:00 on 5 Nov in Dhaka, still 4 Nov in UTC
 const monthEdge = new Date('2026-10-31T19:00:00Z'); // 01:00 on 1 Nov in Dhaka, still 31 Oct in UTC
 const bookings = [
  { status: 'CONFIRMED', createdAt: lateNight, finalAmount: 300, payments: [{ amount: 300, method: 'BKASH', status: 'SUCCESS', paidAt: lateNight }] },
  { status: 'CONFIRMED', createdAt: monthEdge, finalAmount: 700, payments: [{ amount: 700, method: 'BKASH', status: 'SUCCESS', paidAt: monthEdge }] }
 ];
 const result = buildDashboard({ bookings, now: dhakaNow });
 assert.equal(result.timezone, 'Asia/Dhaka');
 assert.equal(result.periodStarts.today, '2026-11-04T18:00:00.000Z'); assert.equal(result.periodStarts.month, '2026-10-31T18:00:00.000Z');
 assert.equal(result.bookings.today, 1); assert.equal(result.bookings.month, 2);
 assert.equal(result.revenue.periods.month.net, 1000);
 assert.equal(result.revenueOverTime.at(-1).date, '2026-11-05'); assert.equal(result.revenueOverTime.at(-1).personal, 300);
});
test('date-only report inputs name Dhaka calendar days', () => {
 assert.equal(reportBoundary('2026-11-05').toISOString(), '2026-11-04T18:00:00.000Z');
 assert.equal(reportBoundary('2026-11-05', { endOfDay: true }).toISOString(), '2026-11-05T17:59:59.999Z');
 assert.equal(reportBoundary('2026-11-05T10:00:00Z').toISOString(), '2026-11-05T10:00:00.000Z');
 assert.ok(Number.isNaN(+reportBoundary('2026-02-30')));
});
