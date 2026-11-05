import Booking from '../model/booking.model.js';
import { GroupDeparture } from '../model/groupDeparture.model.js';
import { User } from '../model/user.model.js';
import { domainError } from './reservation.service.js';
export const isAdmin = actor => actor?.roles?.some(role => role.toLowerCase() === 'admin');
export const userId = value => String(value?._id || value || '');
export async function bookingParticipants(booking) {
  const participants = [userId(booking.customerId)];
  if (!booking.groupDepartureId && booking.assignedOperator) participants.push(userId(booking.assignedOperator));
  if (booking.groupDepartureId) {
    const departure = await GroupDeparture.findById(booking.groupDepartureId).select('operators');
    for (const operator of departure?.operators || []) participants.push(userId(operator.operatorId));
  }
  return participants;
}
export async function requireBookingAccess(bookingId, actor) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw domainError('Booking not found.', 404);
  if (!isAdmin(actor) && !(await bookingParticipants(booking)).includes(actor.id)) throw domainError('Booking access denied.', 403);
  return booking;
}
export async function requireDepartureAccess(departureId, actor) {
  const departure = await GroupDeparture.findById(departureId);
  if (!departure) throw domainError('Departure not found.', 404);
  const assigned = departure.operators.some(op => userId(op.operatorId) === actor.id);
  const customer = !assigned && !isAdmin(actor) && await Booking.exists({ groupDepartureId: departureId, customerId: actor.id, status: { $in: ['PENDING', 'CONFIRMED', 'COMPLETED'] } });
  if (!isAdmin(actor) && !assigned && !customer) throw domainError('Departure access denied.', 403);
  return { departure, assigned };
}
export async function requireSupportPair(actor, otherId) {
  const other = await User.findById(otherId).select('roles isActive');
  if (!other || !other.isActive) throw domainError('Recipient is unavailable.', 404);
  if (!isAdmin(actor) && !isAdmin(other)) throw domainError('Select a support administrator, or open the conversation through its booking/departure.', 403);
}
