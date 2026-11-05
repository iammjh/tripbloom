import { User } from '../model/user.model.js';
import { GroupDeparture } from '../model/groupDeparture.model.js';
import Booking from '../model/booking.model.js';
import KYC from '../model/kyc.model.js';

export async function getSupportContacts() {
  const users = await User.find({ roles: { $in: ['admin', 'ADMIN'] }, isActive: true })
    .select('_id fullName roles')
    .sort({ fullName: 1, _id: 1 })
    .limit(20)
    .lean();

  // Keep this directory separate from the administrator's full user-management response.
  return users.map(({ _id, fullName, roles }) => ({ _id, fullName, roles }));
}

export async function getOperatorKycStatuses(operatorId, status) {
  const departureIds = await GroupDeparture.find({ 'operators.operatorId': operatorId })
    .distinct('_id');
  const customerIds = await Booking.find({
    $or: [
      { assignedOperator: operatorId, groupDepartureId: null },
      { groupDepartureId: { $in: departureIds } }
    ]
  }).distinct('customerId');

  if (customerIds.length === 0) return [];

  const filter = { user: { $in: customerIds } };
  if (status) filter.status = status;
  const kycs = await KYC.find(filter)
    .select('_id user userFullName status createdAt updatedAt verifiedAt')
    .sort({ updatedAt: -1 })
    .lean();

  // Operators need booking-related verification status, not identity documents or contact data.
  return kycs.map(({ _id, user, userFullName, status: state, createdAt, updatedAt, verifiedAt }) => ({
    _id, user, userFullName, status: state, createdAt, updatedAt, verifiedAt
  }));
}
