import { cancelDepartureReservations } from './reservation.service.js';
// groupDeparture.service.js
import mongoose from 'mongoose';
import { GroupDeparture, DEPARTURE_STATUS_ENUM } from '../model/groupDeparture.model.js';
import { User } from '../model/user.model.js';

async function operatorAssignmentError(operatorIds) {
  if (!Array.isArray(operatorIds) || new Set(operatorIds.map(String)).size !== operatorIds.length || operatorIds.some(id => !mongoose.isValidObjectId(id))) return 'Provide unique valid operator IDs.';
  for (const operatorId of operatorIds) {
    const operator = await User.findById(operatorId).select('roles isActive availability');
    if (!operator || !operator.isActive || !operator.roles?.some(role => ['tour_operator', 'operator'].includes(role.toLowerCase())) || operator.availability === 'UNAVAILABLE') return 'Assigned users must be active, available tour operators.';
  }
}

// Create group departure
export async function createGroupDeparture({ packageId, startDate, endDate, totalSeats, pricePerPerson, operatorIds, assignedBy }) {
  if (!packageId || !startDate || !endDate || typeof totalSeats !== 'number' || typeof pricePerPerson !== 'number') {
    return { error: 'packageId, startDate, endDate, totalSeats, and pricePerPerson are required.' };
  }
  if (!mongoose.isValidObjectId(packageId) || !Number.isInteger(totalSeats) || totalSeats < 1 || !Number.isFinite(pricePerPerson) || pricePerPerson <= 0 || !Number.isFinite(+new Date(startDate)) || new Date(endDate) <= new Date(startDate)) return { error: 'Provide valid dates, capacity and price.' };
  const packageRecord = await mongoose.model('TourPackage').findById(packageId);
  if (!packageRecord || packageRecord.type !== 'GROUP') return { error: 'Choose an existing group package.' };
  const assignmentError = await operatorAssignmentError(operatorIds || []);
  if (assignmentError) return { error: assignmentError };
  const departure = new GroupDeparture({ packageId, startDate, endDate, totalSeats, pricePerPerson });
  // Assign operators if provided
  if (Array.isArray(operatorIds) && operatorIds.length > 0) {
    for (const opId of operatorIds) {
      departure.operators.push({
        operatorId: opId,
        assignedBy: assignedBy || opId,
        assignedAt: new Date()
      });
    }
  }
  await departure.save();
  return { departure };
}

// Update a departure only after validating the complete patch. Controllers enforce ownership.
export async function updateGroupDeparture(updates) {
  const { departureId, startDate, endDate, totalSeats, pricePerPerson, status, operatorIds,
    assignedBy, seatMap, seatMapChecked, safetyChecklist, itinerary, tourStarted } = updates;
  if (status === 'CANCELLED') return cancelDepartureReservations({ departureId, userId: assignedBy });
  const departure = await GroupDeparture.findById(departureId);
  if (!departure) return { error: 'Departure not found.' };
  const safetyKeys = ['firstAid', 'vehicleDocs', 'foodHygiene', 'emergencyContacts', 'routePlanned'];
  const own = key => Object.prototype.hasOwnProperty.call(updates, key);
  if (own('totalSeats') && (!Number.isInteger(totalSeats) || totalSeats < 1 || totalSeats < departure.bookedSeats + (departure.seatMap || []).filter(seat => seat.status === 'BLOCKED').length)) {
    return { error: 'totalSeats must be a positive integer and cannot be less than bookedSeats.' };
  }
  if (own('pricePerPerson') && (!Number.isFinite(pricePerPerson) || pricePerPerson < 0)) {
    return { error: 'pricePerPerson must be a non-negative number.' };
  }
  if (own('status') && !DEPARTURE_STATUS_ENUM.includes(status)) return { error: 'Invalid departure status.' };
  const from = startDate !== undefined ? new Date(startDate) : departure.startDate;
  const until = endDate !== undefined ? new Date(endDate) : departure.endDate;
  if (!Number.isFinite(from?.getTime()) || !Number.isFinite(until?.getTime()) || until <= from) {
    return { error: 'Valid dates are required; end date must be after start date.' };
  }
  for (const key of ['seatMapChecked', 'tourStarted']) {
    if (own(key) && typeof updates[key] !== 'boolean') return { error: `${key} must be a boolean.` };
  }
  if (own('safetyChecklist') && (!safetyChecklist || typeof safetyChecklist !== 'object' || Array.isArray(safetyChecklist) ||
      Object.entries(safetyChecklist).some(([key, value]) => !safetyKeys.includes(key) || typeof value !== 'boolean'))) {
    return { error: 'Safety checklist must contain known boolean checks.' };
  }
  if (own('seatMap')) {
    if (!Array.isArray(seatMap) || seatMap.length > (totalSeats ?? departure.totalSeats)) return { error: 'Seat map must fit the departure capacity.' };
    const seats = new Set();
    for (const seat of seatMap) {
      if (!seat || typeof seat.seatNumber !== 'string' || !seat.seatNumber.trim() || seats.has(seat.seatNumber) ||
          !['AVAILABLE', 'BOOKED', 'BLOCKED'].includes(seat.status) ||
          (seat.checkedIn !== undefined && typeof seat.checkedIn !== 'boolean') ||
          (seat.checkedIn && seat.status !== 'BOOKED')) return { error: 'Invalid or duplicate seat map entry.' };
      for (const key of ['bookingId', 'bookedBy']) {
        if (seat[key] != null && !mongoose.isValidObjectId(seat[key])) return { error: `Invalid seat ${key}.` };
      }
      seats.add(seat.seatNumber);
    }
  }
  if (own('seatMap')) {
    if ((totalSeats ?? departure.totalSeats) - seatMap.filter(s => s.status === 'BLOCKED').length < departure.bookedSeats) return { error: 'Blocked seats cannot consume booked capacity.' };
    for (const prior of departure.seatMap || []) {
      if (prior.status === 'BOOKED' && !seatMap.some(s => s.seatNumber === prior.seatNumber)) return { error: 'Cancel the booking before removing its reserved seat.' };
    }
    const Booking = mongoose.model('Booking');
    const bookings = await Booking.find({ groupDepartureId: departureId, status: { $in: ['PENDING', 'CONFIRMED', 'COMPLETED'] } });
    const assignedCounts = new Map();
    for (const seat of seatMap) {
      if (seat.status === 'BOOKED') {
        const booking = bookings.find(b => String(b._id) === String(seat.bookingId));
        const count = (assignedCounts.get(String(seat.bookingId)) || 0) + 1; assignedCounts.set(String(seat.bookingId), count);
        if (!booking || count > booking.numTravelers || String(booking.customerId) !== String(seat.bookedBy)) return { error: 'Booked seats must reference a booking and its customer on this departure.' };
      }
      const previous = departure.seatMap?.find(s => s.seatNumber === seat.seatNumber);
      if (previous?.status === 'BOOKED' && (seat.status !== 'BOOKED' || String(previous.bookingId) !== String(seat.bookingId))) return { error: 'Cancel the booking before releasing its reserved seat.' };
    }
  }
  if (own('itinerary')) {
    if (!Array.isArray(itinerary)) return { error: 'Itinerary must be an array.' };
    const days = new Set();
    for (const day of itinerary) {
      if (!day || !Number.isInteger(day.day) || day.day < 1 || days.has(day.day) || !Array.isArray(day.stops)) return { error: 'Itinerary days must be unique positive integers with stops.' };
      days.add(day.day);
      for (const stop of day.stops) {
        if (!stop || typeof stop.name !== 'string' || !stop.name.trim() ||
            ['time', 'location', 'notes'].some(key => stop[key] !== undefined && typeof stop[key] !== 'string') ||
            (stop.status !== undefined && !['pending', 'completed'].includes(stop.status))) return { error: 'Invalid itinerary stop.' };
      }
    }
  }
  if (own('operatorIds') && (!Array.isArray(operatorIds) || operatorIds.some(id => !mongoose.isValidObjectId(id)))) {
    return { error: 'operatorIds must be an array of valid user IDs.' };
  }
  const checks = Object.fromEntries(safetyKeys.map(key => [key, safetyChecklist?.[key] ?? departure.safetyChecklist?.[key] ?? false]));
  if (tourStarted === true && !safetyKeys.every(key => checks[key])) return { error: 'Complete all safety checks before starting the tour.' };
  if (startDate !== undefined) departure.startDate = from;
  if (endDate !== undefined) departure.endDate = until;
  for (const key of ['totalSeats', 'pricePerPerson', 'status', 'seatMap', 'seatMapChecked', 'itinerary', 'tourStarted']) {
    if (own(key)) departure[key] = updates[key];
  }
  if (own('safetyChecklist')) departure.safetyChecklist = checks;
  if (Array.isArray(operatorIds)) {
    const assignmentError = await operatorAssignmentError(operatorIds);
    if (assignmentError) return { error: assignmentError };
    departure.operators = operatorIds.map(operatorId => ({ operatorId, assignedBy: assignedBy || operatorId, assignedAt: new Date() }));
  }
  await departure.save();
  return { departure };
}

// List departures by package, date range, status
export async function listGroupDepartures({ packageId, startDate, endDate, status }) {
  const query = {};
  if (packageId) query.packageId = packageId;
  if (status) query.status = status;
  if (startDate || endDate) {
    query.startDate = {};
    if (startDate) query.startDate.$gte = new Date(startDate);
    if (endDate) query.startDate.$lte = new Date(endDate);
  }
  return await GroupDeparture.find(query).populate('packageId').populate('operators.operatorId', 'fullName email phone roles availability isActive');
}

// Get a single departure by ID with populated data
export async function getGroupDepartureById({ departureId }) {
  const departure = await GroupDeparture.findById(departureId)
    .populate('packageId')
    .populate('operators.operatorId', 'fullName email phone roles availability isActive');
  if (!departure) return { error: 'Departure not found.' };
  return { departure };
}

// Delete a departure
export async function deleteGroupDeparture({ departureId }) {
  const departure = await GroupDeparture.findById(departureId);
  if (!departure) return { error: 'Departure not found.' };
  
  // Check if there are any bookings
  if (departure.bookedSeats > 0) {
    return { error: 'Cannot delete departure with existing bookings. Cancel the departure instead.' };
  }
  
  await GroupDeparture.findByIdAndDelete(departureId);
  return { success: true };
}

// Check availability for a group departure (customer-facing)
export async function checkDepartureAvailability(departureId) {
  try {
    const departure = await GroupDeparture.findById(departureId)
      .populate('packageId', 'title destination type basePrice');

    if (!departure) {
      return { error: 'Departure not found' };
    }

    const availableSeats = departure.totalSeats - departure.bookedSeats - (departure.seatMap || []).filter(s => s.status === 'BLOCKED').length;
    const isAvailable = departure.status === 'OPEN' && availableSeats > 0;

    return {
      availability: {
        departureId: departure._id,
        packageId: departure.packageId?._id,
        packageTitle: departure.packageId?.title,
        startDate: departure.startDate,
        endDate: departure.endDate,
        totalSeats: departure.totalSeats,
        bookedSeats: departure.bookedSeats,
        availableSeats,
        pricePerPerson: departure.pricePerPerson,
        status: departure.status,
        isAvailable,
        message: !isAvailable
          ? departure.status === 'CANCELLED'
            ? 'This departure has been cancelled'
            : departure.status === 'FULL'
            ? 'This departure is fully booked'
            : 'This departure is not available for booking'
          : `${availableSeats} seat(s) available`
      }
    };
  } catch (err) {
    console.error('Error checking departure availability:', err);
    return { error: 'Failed to check availability' };
  }
}

// Get available departures for a package (customer-facing)
export async function getAvailableDeparturesForPackage(packageId) {
  try {
    const now = new Date();

    const departures = await GroupDeparture.find({
      packageId,
      status: 'OPEN',
      startDate: { $gte: now } // Only future departures
    })
      .populate('packageId', 'title destination type basePrice')
      .sort({ startDate: 1 });

    const availableDepartures = departures
      .filter(dep => dep.bookedSeats < dep.totalSeats - (dep.seatMap || []).filter(s => s.status === 'BLOCKED').length)
      .map(dep => ({
        departureId: dep._id,
        startDate: dep.startDate,
        endDate: dep.endDate,
        totalSeats: dep.totalSeats,
        bookedSeats: dep.bookedSeats,
        availableSeats: dep.totalSeats - dep.bookedSeats - (dep.seatMap || []).filter(s => s.status === 'BLOCKED').length,
        pricePerPerson: dep.pricePerPerson,
        status: dep.status
      }));

    return { departures: availableDepartures };
  } catch (err) {
    console.error('Error fetching available departures:', err);
    return { error: 'Failed to fetch available departures' };
  }
}



// Close booking / mark full / cancel departure
export async function setGroupDepartureStatus({ departureId, status, assignedBy }) {
  if (!DEPARTURE_STATUS_ENUM.includes(status)) return { error: 'Invalid status.' };
  if (status === 'CANCELLED') return cancelDepartureReservations({ departureId, userId: assignedBy });
  const departure = await GroupDeparture.findById(departureId);
  if (!departure) return { error: 'Departure not found.' };
  if (departure.status === 'CANCELLED') return { error: 'A cancelled departure cannot be reopened; create a new departure.' };
  departure.status = status;
  await departure.save();
  return { departure };
}

// Assign operators to a group departure
export async function assignOperatorsToDeparture({ departureId, operatorIds, assignedBy }) {
  const assignmentError = await operatorAssignmentError(operatorIds);
  if (assignmentError) return { error: assignmentError };
  const departure = await GroupDeparture.findById(departureId);
  if (!departure) return { error: 'Departure not found.' };
  if (!Array.isArray(operatorIds) || operatorIds.length === 0) {
    return { error: 'operatorIds must be a non-empty array.' };
  }
  // Prevent duplicate assignments
  const currentOps = departure.operators.map(op => op.operatorId.toString());
  const newOps = operatorIds.filter(id => !currentOps.includes(id));
  if (newOps.length === 0) {
    return { error: 'All operators are already assigned.' };
  }
  // Add new operators with tracking
  for (const opId of newOps) {
    // Check availability
    const op = await User.findById(opId).select('availability');
    if (op && op.availability && op.availability.toString().toUpperCase() === 'UNAVAILABLE') {
      return { error: `Operator ${opId} is currently UNAVAILABLE and cannot be assigned.` };
    }
    departure.operators.push({ 
      operatorId: opId, 
      assignedBy: assignedBy || opId,
      assignedAt: new Date() 
    });
  }
  await departure.save();
  await departure.populate('operators.operatorId', 'fullName email phone roles availability isActive');
  return { departure };
}

// List operators assigned to a group departure
export async function listOperatorsForDeparture({ departureId }) {
  const departure = await GroupDeparture.findById(departureId).populate('operators.operatorId', 'fullName email phone roles availability isActive');
  if (!departure) return { error: 'Departure not found.' };
  return { operators: departure.operators };
}

// Reassign operator for a group departure
export async function reassignOperatorForDeparture({ departureId, oldOperatorId, newOperatorId, assignedBy }) {
  const assignmentError = await operatorAssignmentError([newOperatorId]);
  if (assignmentError) return { error: assignmentError };
  const departure = await GroupDeparture.findById(departureId);
  if (!departure) return { error: 'Departure not found.' };
  const idx = departure.operators.findIndex(op => op.operatorId.toString() === oldOperatorId);
  if (idx === -1) return { error: 'Old operator not assigned to this departure.' };
  // Prevent duplicate assignment
  if (departure.operators.some(op => op.operatorId.toString() === newOperatorId)) {
    return { error: 'New operator already assigned.' };
  }
  departure.operators[idx] = {
    operatorId: newOperatorId,
    assignedBy: assignedBy || newOperatorId,
    assignedAt: new Date()
  };
  await departure.save();
  await departure.populate('operators.operatorId', 'fullName email phone roles availability isActive');
  return { departure };
}

// Find future departures for operator (for deactivation/reassignment)
export async function findFutureDeparturesForOperator({ operatorId, fromDate = new Date() }) {
  return await GroupDeparture.find({
    'operators.operatorId': operatorId,
    startDate: { $gte: fromDate }
  })
    .populate('packageId')
    .populate('operators.operatorId', 'fullName email phone roles availability isActive');
}

// Remove (deactivate) operator from future departures
export async function removeOperatorFromFutureDepartures({ operatorId, fromDate = new Date() }) {
  const departures = await GroupDeparture.find({
    'operators.operatorId': operatorId,
    startDate: { $gte: fromDate }
  });
  for (const dep of departures) {
    dep.operators = dep.operators.filter(op => op.operatorId.toString() !== operatorId);
    await dep.save();
  }
  return { updatedCount: departures.length };
}

// Add a single operator to a departure
export async function addOperatorToDeparture({ departureId, operatorId, assignedBy }) {
  const assignmentError = await operatorAssignmentError([operatorId]);
  if (assignmentError) return { error: assignmentError };
  const departure = await GroupDeparture.findById(departureId);
  if (!departure) return { error: 'Departure not found.' };
  
  // Check if operator already assigned
  if (departure.operators.some(op => op.operatorId.toString() === operatorId)) {
    return { error: 'Operator is already assigned to this departure.' };
  }
  // Check operator availability
  const op = await User.findById(operatorId).select('availability');
  if (op && op.availability && op.availability.toString().toUpperCase() === 'UNAVAILABLE') {
    return { error: `Operator ${operatorId} is currently UNAVAILABLE and cannot be assigned.` };
  }
  
  departure.operators.push({ 
    operatorId, 
    assignedBy: assignedBy || operatorId,  // Use assignedBy if provided
    assignedAt: new Date() 
  });
  await departure.save();
  
  // Return populated departure
  await departure.populate('operators.operatorId', 'fullName email phone roles availability isActive');
  return { departure };
}

// Remove a single operator from a departure
export async function removeOperatorFromDeparture({ departureId, operatorId }) {
  const departure = await GroupDeparture.findById(departureId);
  if (!departure) return { error: 'Departure not found.' };
  
  // Check if this is the last operator
  if (departure.operators.length <= 1) {
    return { error: 'Cannot remove the last operator. A departure must have at least one operator assigned.' };
  }
  
  const originalLength = departure.operators.length;
  departure.operators = departure.operators.filter(op => op.operatorId.toString() !== operatorId);
  
  if (departure.operators.length === originalLength) {
    return { error: 'Operator not found on this departure.' };
  }
  
  await departure.save();
  
  // Return populated departure
  await departure.populate('operators.operatorId', 'fullName email phone roles availability isActive');
  return { departure };
}

