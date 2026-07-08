// groupDeparture.controller.js
import {
  createGroupDeparture,
  updateGroupDeparture,
  listGroupDepartures,
  getGroupDepartureById,
  deleteGroupDeparture,
  setGroupDepartureStatus,
  checkDepartureAvailability,
  getAvailableDeparturesForPackage
} from '../service/groupDeparture.service.js';
import {
  assignOperatorsToDeparture,
  listOperatorsForDeparture,
  reassignOperatorForDeparture,
  findFutureDeparturesForOperator,
  removeOperatorFromFutureDepartures,
  addOperatorToDeparture,
  removeOperatorFromDeparture
} from '../service/groupDeparture.service.js';

export async function createGroupDepartureController(req, res) {
  // Accept operatorIds and assignedBy from frontend
  const { packageId, startDate, endDate, totalSeats, pricePerPerson, operatorIds, assignedBy } = req.body;
  const result = await createGroupDeparture({ packageId, startDate, endDate, totalSeats, pricePerPerson, operatorIds, assignedBy });
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, message: 'Group departure created successfully.', departure: result.departure });
}

// Helper to perform BOLA check: Admins bypass, operators must be assigned to the departure
function verifyDepartureAccess(departure, user) {
  if (!user) return false;
  const userRoles = user.roles || [];
  const rolesLower = userRoles.map(r => r.toLowerCase());
  
  if (rolesLower.includes('admin')) {
    return true;
  }
  
  // Must be a tour operator assigned to this departure
  const isAssigned = departure.operators && departure.operators.some(op => 
    (op.operatorId?._id || op.operatorId || '').toString() === user.id
  );
  return isAssigned;
}

export async function updateGroupDepartureController(req, res) {
  const { departureId } = req.params;
  const departureResult = await getGroupDepartureById({ departureId });
  if (departureResult.error || !departureResult.departure) {
    return res.status(404).json({ success: false, message: departureResult.error || 'Departure not found.' });
  }
  if (!verifyDepartureAccess(departureResult.departure, req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden: you are not assigned to this departure.' });
  }

  const { startDate, endDate, totalSeats, pricePerPerson, status, operatorIds, assignedBy } = req.body;
  const result = await updateGroupDeparture({ departureId, startDate, endDate, totalSeats, pricePerPerson, status, operatorIds, assignedBy });
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, message: 'Group departure updated successfully.', departure: result.departure });
}

export async function listGroupDeparturesController(req, res) {
  const result = await listGroupDepartures(req.query);
  res.json({ success: true, message: 'Group departures listed successfully.', departures: result });
}

export async function getGroupDepartureByIdController(req, res) {
  const { departureId } = req.params;
  const result = await getGroupDepartureById({ departureId });
  if (result.error || !result.departure) return res.status(404).json({ success: false, message: result.error || 'Departure not found.' });

  if (!verifyDepartureAccess(result.departure, req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden: you are not assigned to this departure.' });
  }

  res.json({ success: true, message: 'Departure retrieved successfully.', departure: result.departure });
}

export async function deleteGroupDepartureController(req, res) {
  const { departureId } = req.params;
  const result = await deleteGroupDeparture({ departureId });
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, message: 'Departure deleted successfully.' });
}

export async function setGroupDepartureStatusController(req, res) {
  const { departureId } = req.params;
  const departureResult = await getGroupDepartureById({ departureId });
  if (departureResult.error || !departureResult.departure) {
    return res.status(404).json({ success: false, message: departureResult.error || 'Departure not found.' });
  }
  if (!verifyDepartureAccess(departureResult.departure, req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden: you are not assigned to this departure.' });
  }

  const { status } = req.body;
  const result = await setGroupDepartureStatus({ departureId, status });
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, message: `Departure status set to ${status}.`, departure: result.departure });
}

// Assign operators to a group departure
export async function assignOperatorsToDepartureController(req, res) {
  const { departureId } = req.params;
  const { operatorIds } = req.body;
  const result = await assignOperatorsToDeparture({ departureId, operatorIds });
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  const message = result.departure && result.departure.assignedOperators.length > 0
    ? 'Operators assigned successfully.'
    : 'No operators were assigned.';
  res.json({ success: true, message, departure: result.departure });
}

// List operators assigned to a group departure
export async function listOperatorsForDepartureController(req, res) {
  const { departureId } = req.params;
  const result = await listOperatorsForDeparture({ departureId });
  if (result.error) return res.status(404).json({ success: false, message: result.error });
  const message = result.operators.length === 0
    ? 'No operators assigned to this departure.'
    : 'Operators listed successfully.';
  res.json({ success: true, message, operators: result.operators });
}

// Reassign operator for a group departure
export async function reassignOperatorForDepartureController(req, res) {
  const { departureId } = req.params;
  const { oldOperatorId, newOperatorId } = req.body;
  const result = await reassignOperatorForDeparture({ departureId, oldOperatorId, newOperatorId });
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  const message = 'Operator reassigned successfully.';
  res.json({ success: true, message, departure: result.departure });
}

// Find future departures for operator (for deactivation/reassignment)
export async function findFutureDeparturesForOperatorController(req, res) {
  const { operatorId } = req.params;
  const result = await findFutureDeparturesForOperator({ operatorId });
  const message = result.length === 0
    ? 'No future departures found for this operator.'
    : 'Future departures found for this operator.';
  res.json({ success: true, message, departures: result });
}

// Remove operator from future departures (deactivation)
export async function removeOperatorFromFutureDeparturesController(req, res) {
  const { operatorId } = req.params;
  const result = await removeOperatorFromFutureDepartures({ operatorId });
  const message = result.updatedCount === 0
    ? 'No future departures were updated.'
    : `${result.updatedCount} future departures updated to remove operator.`;
  res.json({ success: true, message, updatedCount: result.updatedCount });
}

// Add a single operator to a departure
export async function addOperatorToDepartureController(req, res) {
  const { departureId } = req.params;
  const { operatorId } = req.body;
  
  if (!operatorId) {
    return res.status(400).json({ success: false, message: 'operatorId is required.' });
  }
  
  const result = await addOperatorToDeparture({ departureId, operatorId });
  if (result.error) {
    return res.status(400).json({ success: false, message: result.error });
  }
  
  res.json({ success: true, message: 'Operator added successfully.', departure: result.departure });
}

// Remove a single operator from a departure
export async function removeOperatorFromDepartureController(req, res) {
  const { departureId, operatorId } = req.params;
  
  const result = await removeOperatorFromDeparture({ departureId, operatorId });
  if (result.error) {
    return res.status(400).json({ success: false, message: result.error });
  }
  
  res.json({ success: true, message: 'Operator removed successfully.', departure: result.departure });
}

// Get seat map for a group departure
export async function getSeatMapController(req, res) {
  const { departureId } = req.params;
  const result = await getGroupDepartureById({ departureId });
  if (result.error || !result.departure) {
    return res.status(404).json({ success: false, message: 'Departure not found.' });
  }
  if (!verifyDepartureAccess(result.departure, req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden: you are not assigned to this departure.' });
  }
  res.json({ success: true, seatMap: result.departure.seatMap || [] });
}

// Update seat map for a group departure
export async function updateSeatMapController(req, res) {
  const { departureId } = req.params;
  const departureResult = await getGroupDepartureById({ departureId });
  if (departureResult.error || !departureResult.departure) {
    return res.status(404).json({ success: false, message: departureResult.error || 'Departure not found.' });
  }
  if (!verifyDepartureAccess(departureResult.departure, req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden: you are not assigned to this departure.' });
  }

  const { seatMap } = req.body;
  if (!Array.isArray(seatMap)) {
    return res.status(400).json({ success: false, message: 'seatMap must be an array.' });
  }
  const result = await updateGroupDeparture({ departureId, seatMap });
  if (result.error) {
    return res.status(400).json({ success: false, message: result.error });
  }
  res.json({ success: true, message: 'Seat map updated successfully.', seatMap: result.departure.seatMap });
}

// Check departure availability (customer-facing)
export async function checkDepartureAvailabilityController(req, res) {
  const { departureId } = req.params;

  const result = await checkDepartureAvailability(departureId);

  if (result.error) {
    return res.status(404).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    availability: result.availability
  });
}

// Get available departures for a package (customer-facing)
export async function getAvailableDeparturesForPackageController(req, res) {
  const { packageId } = req.params;

  const result = await getAvailableDeparturesForPackage(packageId);

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    departures: result.departures,
    count: result.departures.length
  });
}
