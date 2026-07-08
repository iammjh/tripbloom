// groupDeparture.service.js
import mongoose from 'mongoose';
import { GroupDeparture, DEPARTURE_STATUS_ENUM } from '../model/groupDeparture.model.js';
import { User } from '../model/user.model.js';

// Create group departure
export async function createGroupDeparture({ packageId, startDate, endDate, totalSeats, pricePerPerson, operatorIds, assignedBy }) {
  if (!packageId || !startDate || !endDate || typeof totalSeats !== 'number' || typeof pricePerPerson !== 'number') {
    return { error: 'packageId, startDate, endDate, totalSeats, and pricePerPerson are required.' };
  }
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

// Update group departure
export async function updateGroupDeparture({ departureId, startDate, endDate, totalSeats, pricePerPerson, status, operatorIds, assignedBy }) {
  const departure = await GroupDeparture.findById(departureId);
  if (!departure) return { error: 'Departure not found.' };
  if (typeof totalSeats === 'number' && totalSeats < departure.bookedSeats) {
    return { error: 'totalSeats cannot be less than bookedSeats.' };
  }
  if (startDate) departure.startDate = startDate;
  if (endDate) departure.endDate = endDate;
  if (typeof totalSeats === 'number') departure.totalSeats = totalSeats;
  if (typeof pricePerPerson === 'number') departure.pricePerPerson = pricePerPerson;
  if (typeof arguments[0].bookedSeats === 'number') departure.bookedSeats = arguments[0].bookedSeats;
  if (status && DEPARTURE_STATUS_ENUM.includes(status)) departure.status = status;
  // Update seatMap if provided
  if (Array.isArray(arguments[0].seatMap)) {
    departure.seatMap = arguments[0].seatMap;
  }
  // Update checked flag for seat map quickly
  if (typeof arguments[0].seatMapChecked === 'boolean') {
    departure.seatMapChecked = arguments[0].seatMapChecked;
  }
  // Update safety checklist if provided
  if (arguments[0].safetyChecklist && typeof arguments[0].safetyChecklist === 'object') {
    departure.safetyChecklist = { ...departure.safetyChecklist, ...arguments[0].safetyChecklist };
  }
  // Update itinerary if provided
  if (Array.isArray(arguments[0].itinerary)) {
    departure.itinerary = arguments[0].itinerary;
  }
  // Update tourStarted flag
  if (typeof arguments[0].tourStarted === 'boolean') {
    departure.tourStarted = arguments[0].tourStarted;
  }
  // Update operators if operatorIds provided
  if (Array.isArray(operatorIds)) {
    // Remove all existing operators and add new ones
    departure.operators = [];
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
  return await GroupDeparture.find(query).populate('packageId').populate('operators.operatorId');
}

// Get a single departure by ID with populated data
export async function getGroupDepartureById({ departureId }) {
  const departure = await GroupDeparture.findById(departureId)
    .populate('packageId')
    .populate('operators.operatorId');
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

    const availableSeats = departure.totalSeats - departure.bookedSeats;
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
      .filter(dep => dep.bookedSeats < dep.totalSeats)
      .map(dep => ({
        departureId: dep._id,
        startDate: dep.startDate,
        endDate: dep.endDate,
        totalSeats: dep.totalSeats,
        bookedSeats: dep.bookedSeats,
        availableSeats: dep.totalSeats - dep.bookedSeats,
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
export async function setGroupDepartureStatus({ departureId, status }) {
  const departure = await GroupDeparture.findById(departureId);
  if (!departure) return { error: 'Departure not found.' };
  if (!DEPARTURE_STATUS_ENUM.includes(status)) return { error: 'Invalid status.' };
  departure.status = status;
  await departure.save();

  // If status is CANCELLED, cancel all associated bookings and trigger refunds
  if (status === 'CANCELLED') {
    try {
      const Booking = mongoose.model('Booking');
      const bookings = await Booking.find({
        groupDepartureId: departureId,
        status: { $in: ['PENDING', 'CONFIRMED'] }
      });

      for (const booking of bookings) {
        const totalPaid = booking.payments
          .filter(p => p.status === 'SUCCESS' || p.status === 'COMPLETED' || p.status === 'CONFIRMED')
          .reduce((sum, p) => sum + (p.amount || 0), 0);

        booking.status = 'CANCELLED';
        booking.cancellation = {
          isCancelled: true,
          reason: 'Tour group departure was cancelled by operator/admin',
          cancelledAt: new Date(),
          refundAmount: totalPaid,
          refundProcessed: false
        };

        if (totalPaid > 0) {
          booking.payments.push({
            amount: totalPaid,
            method: 'REFUND',
            status: 'PENDING',
            transactionRef: `REFUND-${booking._id}-${Date.now()}`
          });
        }

        await booking.save();
      }
    } catch (err) {
      console.error(`Error cancelling bookings for group departure ${departureId}:`, err);
    }
  }

  return { departure };
}

// Assign operators to a group departure
export async function assignOperatorsToDeparture({ departureId, operatorIds, assignedBy }) {
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
  await departure.populate('operators.operatorId');
  return { departure };
}

// List operators assigned to a group departure
export async function listOperatorsForDeparture({ departureId }) {
  const departure = await GroupDeparture.findById(departureId).populate('operators.operatorId');
  if (!departure) return { error: 'Departure not found.' };
  return { operators: departure.operators };
}

// Reassign operator for a group departure
export async function reassignOperatorForDeparture({ departureId, oldOperatorId, newOperatorId, assignedBy }) {
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
  await departure.populate('operators.operatorId');
  return { departure };
}

// Find future departures for operator (for deactivation/reassignment)
export async function findFutureDeparturesForOperator({ operatorId, fromDate = new Date() }) {
  return await GroupDeparture.find({
    'operators.operatorId': operatorId,
    startDate: { $gte: fromDate }
  })
    .populate('packageId')
    .populate('operators.operatorId');
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
  await departure.populate('operators.operatorId');
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
  await departure.populate('operators.operatorId');
  return { departure };
}

