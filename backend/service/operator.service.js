
import { GroupDeparture } from '../model/groupDeparture.model.js';
import { User } from '../model/user.model.js';

// Fetch group departures assigned to a specific operator
import mongoose from 'mongoose';
export async function getAssignedGroupDepartures(operatorId) {
	// Ensure operatorId is ObjectId for query
	const opId = mongoose.Types.ObjectId.isValid(operatorId) ? new mongoose.Types.ObjectId(operatorId) : operatorId;
	const result = await GroupDeparture.find({
		'operators.operatorId': opId
	})
		.populate('packageId')
		.populate('operators.operatorId', '-passwordHash')
		.exec();
	console.log('DEBUG: getAssignedGroupDepartures for', operatorId, 'found', result.length, 'departures');
	return result;
}

// Fetch operator profile info
export async function getOperatorProfile(operatorId) {
	return User.findById(operatorId).select('-passwordHash').exec();
}

// Update operator profile
export async function updateOperatorProfile(operatorId, updateData) {
  const allowedFields = ['fullName', 'email', 'phone', 'availability'];
  const filteredData = {};
  for (const field of allowedFields) {
    if (updateData[field] === undefined) continue;
    if (typeof updateData[field] !== 'string') throw new Error(`${field} must be text.`);
    filteredData[field] = updateData[field].trim();
  }
  if (filteredData.fullName !== undefined && !filteredData.fullName) throw new Error('Full name is required.');
  if (filteredData.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(filteredData.email)) throw new Error('A valid email is required.');
  if (filteredData.availability !== undefined && !['AVAILABLE', 'UNAVAILABLE'].includes(filteredData.availability)) throw new Error('Invalid availability.');
  if (filteredData.availability === 'UNAVAILABLE') {
    const assigned = await GroupDeparture.findOne({ 'operators.operatorId': operatorId, endDate: { $gte: new Date() }, status: { $ne: 'CANCELLED' } }).select('_id');
    if (assigned) throw new Error('Complete or reassign your upcoming and ongoing departures before going unavailable.');
  }
  return User.findByIdAndUpdate(operatorId, { $set: filteredData }, { new: true, runValidators: true, select: '-passwordHash' }).exec();
}

// Get operator statistics
export async function getOperatorStats(operatorId) {
	const opId = mongoose.Types.ObjectId.isValid(operatorId) ? new mongoose.Types.ObjectId(operatorId) : operatorId;

	// Get all departures assigned to this operator
	const allDepartures = await GroupDeparture.find({
		'operators.operatorId': opId
	}).exec();

	// Calculate completed tours (end date in the past)
	const completedTours = allDepartures.filter(dep => new Date(dep.endDate) < new Date()).length;

	// Calculate total travelers
	const totalTravelers = allDepartures.reduce((sum, dep) => sum + (dep.bookedSeats || 0), 0);

	return {
		completedTours,
		totalTravelers,
		totalDepartures: allDepartures.length
	};
}
