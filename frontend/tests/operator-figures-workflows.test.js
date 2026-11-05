import test from 'node:test';
import assert from 'node:assert/strict';
import { localDayKey, departuresOnDay, sevenDayStrip, homeFigures } from '../src/utils/operatorFigures.js';

const NOW = new Date(2026, 10, 6, 10, 0); // 6 Nov 2026, local time
const dep = (y, m, d, h = 9) => ({ _id: `${y}-${m}-${d}-${h}`, startDate: new Date(y, m, d, h, 0), endDate: new Date(y, m, d + 2, 12, 0), status: 'OPEN' });

test('localDayKey uses the local calendar day', () => {
  assert.equal(localDayKey(new Date(2026, 10, 6, 23, 30)), '2026-11-06');
  assert.equal(localDayKey(new Date(2026, 10, 7, 0, 5)), '2026-11-07');
});

test('departuresOnDay counts only departures starting that local day', () => {
  const list = [dep(2026, 10, 6), dep(2026, 10, 6, 20), dep(2026, 10, 7)];
  assert.equal(departuresOnDay(list, '2026-11-06').length, 2);
  assert.equal(departuresOnDay(list, '2026-11-08').length, 0);
});

test('a departure at 23:30 today counts as today', () => {
  const late = dep(2026, 10, 6, 23);
  assert.equal(departuresOnDay([late], localDayKey(NOW)).length, 1);
});

test('the seven-day strip has seven days starting today with the right counts', () => {
  const list = [dep(2026, 10, 6), dep(2026, 10, 9), dep(2026, 10, 9, 15), dep(2026, 10, 14)];
  const strip = sevenDayStrip(list, NOW);
  assert.equal(strip.length, 7);
  assert.equal(strip[0].key, '2026-11-06');
  assert.equal(strip[0].count, 1);
  assert.equal(strip[3].key, '2026-11-09');
  assert.equal(strip[3].count, 2);
  assert.equal(strip.reduce((sum, day) => sum + day.count, 0), 3);
});

test('home figures are zero with no departures', () => {
  const figures = homeFigures([], NOW);
  assert.equal(figures.todayDepartures.length, 0);
  assert.equal(figures.assignedCount, 0);
  assert.ok(figures.week.every(day => day.count === 0));
});

test('a departure with an invalid start date is ignored, not counted as a number', () => {
  const broken = { _id: 'x', startDate: 'not-a-date', status: 'OPEN' };
  const figures = homeFigures([broken, dep(2026, 10, 6)], NOW);
  assert.equal(figures.todayDepartures.length, 1);
  assert.ok(figures.week.every(day => Number.isFinite(day.count)));
});

test('assigned count equals the number of departures given', () => {
  assert.equal(homeFigures([dep(2026, 10, 20), dep(2026, 11, 1)], NOW).assignedCount, 2);
});
