import test from 'node:test';
import assert from 'node:assert/strict';
import { chartValues } from '../src/utils/dashboardPresentation.js';
test('chart filters select actual receipts and matching refunds', () => {
 const series = [{ date: '2026-11-04', group: 100, personal: 200, refunds: 60, groupRefunds: 50, personalRefunds: 10 }];
 assert.equal(chartValues(series)[0].net, 240);
 assert.equal(chartValues(series, 'group')[0].net, 50);
 assert.equal(chartValues(series, 'personal')[0].net, 190);
 assert.deepEqual(chartValues([], 'all'), []);
});
