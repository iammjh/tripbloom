import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { TourPackage } from '../model/tourPackage.model.js';
import { createTourPackage, getPublicTourPackage } from '../service/tourPackage.service.js';
import { getPublicTourPackageController, createTourPackageController } from '../controller/tourPackage.controller.js';

const packageId = new mongoose.Types.ObjectId().toString();
const basePackage = {
  title: 'Existing tour', type: 'PERSONAL', category: 'GOLD', basePrice: 900,
  defaultDays: 5, defaultNights: 4,
};

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

test('package creation retains existing photo, international, map, and active fields on reload', async (t) => {
  let stored;
  t.mock.method(TourPackage, 'exists', async () => null);
  t.mock.method(TourPackage.prototype, 'save', async function() {
    stored = this.toObject();
    return this;
  });
  const result = await createTourPackage({ ...basePackage,
    photos: ['https://example.invalid/tour.jpg'], isInternational: true, isActive: false,
    mapLocation: { lat: 0, lng: 90.4, zoom: 9 },
  });
  assert.equal(result.error, undefined);
  const reloaded = TourPackage.hydrate(stored);
  assert.deepEqual(reloaded.photos.toObject(), ['https://example.invalid/tour.jpg']);
  assert.equal(reloaded.isInternational, true);
  assert.equal(reloaded.isActive, false);
  assert.equal(reloaded.mapLocation.lat, 0);
  assert.equal(reloaded.mapLocation.lng, 90.4);
  assert.equal(reloaded.mapLocation.zoom, 9);
});

test('package creation preserves existing defaults when optional fields are omitted', async (t) => {
  t.mock.method(TourPackage, 'exists', async () => null);
  t.mock.method(TourPackage.prototype, 'save', async function() { return this; });
  const result = await createTourPackage(basePackage);
  assert.equal(result.package.isActive, true);
  assert.equal(result.package.isInternational, false);
  assert.deepEqual(result.package.photos.toObject(), []);
});

test('package creation rejects invalid newly connected form fields without saving', async (t) => {
  t.mock.method(TourPackage, 'exists', async () => null);
  const save = t.mock.method(TourPackage.prototype, 'save', async function() { return this; });
  for (const changes of [
    { isInternational: 'true' }, { isActive: 'false' }, { photos: 'not-an-array' },
    { photos: [123] }, { mapLocation: { lat: 91, lng: 10 } },
    { mapLocation: { lat: 10, lng: -181 } }, { mapLocation: { lat: 'north', lng: 10 } },
  ]) {
    const result = await createTourPackage({ ...basePackage, ...changes });
    assert.equal(typeof result.error, 'string');
  }
  assert.equal(save.mock.callCount(), 0);
});

test('public package read uses an active-only filter and excludes internal operator assignments', async (t) => {
  t.mock.method(TourPackage.Query.prototype, 'exec', async function() {
    assert.deepEqual(this.getFilter(), { _id: packageId, isActive: true });
    const projection = this.projection();
    assert.equal(projection.title, 1);
    assert.equal(projection.photos, 1);
    assert.equal(projection.isInternational, 1);
    assert.equal(projection.mapLocation, 1);
    assert.equal(projection.assignedOperators, undefined);
    return { _id: packageId, title: 'Visible tour', isActive: true };
  });
  const result = await getPublicTourPackage(packageId);
  assert.equal(result.package.title, 'Visible tour');
  assert.equal(result.package.assignedOperators, undefined);
});

test('public package detail returns 404 for inactive or missing packages', async (t) => {
  t.mock.method(TourPackage.Query.prototype, 'exec', async () => null);
  const res = response();
  await getPublicTourPackageController({ params: { packageId } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
});

test('public package detail rejects invalid IDs without a database query', async (t) => {
  const lookup = t.mock.method(TourPackage, 'findOne', () => { throw new Error('must not query'); });
  const res = response();
  await getPublicTourPackageController({ params: { packageId: 'invalid' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(lookup.mock.callCount(), 0);
});

test('public package detail converts a database rejection to an intentional error response', async (t) => {
  t.mock.method(TourPackage.Query.prototype, 'exec', async () => { throw new Error('offline'); });
  const res = response();
  await getPublicTourPackageController({ params: { packageId } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(JSON.stringify(res.body).includes('offline'), false);
});


test('package form receives an intentional failure when persistence rejects', async t => {
  t.mock.method(TourPackage.prototype, 'save', async () => { throw new Error('sensitive database diagnostic'); });
  const res = response();
  await createTourPackageController({ body: basePackage }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(JSON.stringify(res.body).includes('sensitive database diagnostic'), false);
});
