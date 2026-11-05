import { GroupDeparture } from '../model/groupDeparture.model.js';

export const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const INCIDENT_MAX_LENGTH = 1000;

// Checks an incident before it is stored. Returns { value } or { error }.
export function validateIncidentInput(input = {}) {
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!description) return { error: 'Describe the incident before saving.' };
  if (description.length > INCIDENT_MAX_LENGTH) return { error: `Keep the description to ${INCIDENT_MAX_LENGTH} characters or fewer.` };
  const severity = typeof input.severity === 'string' ? input.severity.trim().toUpperCase() : '';
  if (!INCIDENT_SEVERITIES.includes(severity)) return { error: 'Choose a valid severity.' };
  return { value: { description, severity } };
}

// Appends one incident to a departure and returns the updated departure.
export async function addDepartureIncident({ departureId, incident, reportedBy }) {
  const updated = await GroupDeparture.findByIdAndUpdate(
    departureId,
    { $push: { incidents: { ...incident, reportedBy, reportedAt: new Date() } } },
    { new: true, runValidators: true }
  )
    .populate('packageId')
    .populate('operators.operatorId', 'fullName email phone roles availability isActive');
  if (!updated) return { error: 'Departure not found.' };
  return { departure: updated };
}
