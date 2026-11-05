import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validateIncidentInput, INCIDENT_MAX_LENGTH } from '../service/departureIncident.service.js';
import { GroupDeparture } from '../model/groupDeparture.model.js';

test('incident needs a description and a known severity', () => {
  assert.equal(validateIncidentInput({ description: '   ', severity: 'LOW' }).error, 'Describe the incident before saving.');
  assert.equal(validateIncidentInput({ description: 'Bus delay', severity: 'URGENT' }).error, 'Choose a valid severity.');
  assert.equal(validateIncidentInput({}).error, 'Describe the incident before saving.');
});

test('incident severity is normalised and the description is trimmed', () => {
  const result = validateIncidentInput({ description: '  Flat tyre near Sylhet  ', severity: ' high ' });
  assert.deepEqual(result.value, { description: 'Flat tyre near Sylhet', severity: 'HIGH' });
});

test('incident description is capped at the stored length', () => {
  const tooLong = 'x'.repeat(INCIDENT_MAX_LENGTH + 1);
  assert.equal(validateIncidentInput({ description: tooLong, severity: 'LOW' }).error, `Keep the description to ${INCIDENT_MAX_LENGTH} characters or fewer.`);
  assert.ok(validateIncidentInput({ description: 'x'.repeat(INCIDENT_MAX_LENGTH), severity: 'LOW' }).value);
});

test('departure model stores incidents with a reporter and rejects unknown severities', async () => {
  const doc = new GroupDeparture({
    packageId: new mongoose.Types.ObjectId(), startDate: '2027-01-01', endDate: '2027-01-03', totalSeats: 3, pricePerPerson: 500,
    incidents: [{ description: 'Guest feeling unwell', severity: 'MEDIUM', reportedBy: new mongoose.Types.ObjectId() }]
  });
  await doc.validate();
  assert.equal(doc.incidents[0].severity, 'MEDIUM');
  assert.ok(doc.incidents[0].reportedAt instanceof Date);

  const bad = new GroupDeparture({
    packageId: new mongoose.Types.ObjectId(), startDate: '2027-01-01', endDate: '2027-01-03', totalSeats: 3, pricePerPerson: 500,
    incidents: [{ description: 'Guest feeling unwell', severity: 'URGENT', reportedBy: new mongoose.Types.ObjectId() }]
  });
  await assert.rejects(bad.validate());
});
