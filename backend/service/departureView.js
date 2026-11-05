import { isAdmin } from './access.service.js';

// Who may read an operator's phone and email on a departure:
//  - administrators: every operator
//  - an operator: their own details only (other operators are shown by name and role)
//  - a customer: the lead operator (first on the departure), who is the person they contact about their booking
//  - anyone else: nothing beyond name and role
const OPERATOR_ROLES = ['tour_operator', 'operator'];

const idOf = value => String(value?._id || value || '');

function plain(value) {
  if (!value || typeof value !== 'object') return value;
  return typeof value.toObject === 'function' ? value.toObject() : { ...value };
}

const isOperatorActor = actor => (actor?.roles || []).some(role => OPERATOR_ROLES.includes(String(role).toLowerCase()));

export function canSeeOperatorContact({ index, operatorId, actor }) {
  if (isAdmin(actor)) return true;
  if (idOf(operatorId) === String(actor?.id)) return true;
  return !isOperatorActor(actor) && index === 0;
}

// Removes phone and email from a populated operator unless the actor may see them.
export function operatorForActor(operator, { index, actor }) {
  const value = plain(operator);
  if (!value || typeof value !== 'object' || !value._id) return value;
  if (canSeeOperatorContact({ index, operatorId: value._id, actor })) return value;
  const { email, phone, ...nameAndRole } = value;
  return nameAndRole;
}

// Applies operatorForActor to a departure's operator entries. Index 0 is the lead operator.
export function operatorsForActor(operators = [], actor) {
  return (operators || []).map((entry, index) => {
    const value = plain(entry) || {};
    if (!value.operatorId) return value;
    return { ...value, operatorId: operatorForActor(value.operatorId, { index, actor }) };
  });
}

// A departure as the caller may see it: administrators get everything, other callers get masked contacts.
export function departureForRole(departure, actor) {
  if (!departure) return departure;
  const value = plain(departure);
  if (isAdmin(actor)) return value;
  value.operators = operatorsForActor(value.operators, actor);
  return value;
}

// A booking's operator fields as the caller may see them. assignedOperator is the lead operator.
export function maskBookingOperators(booking, actor) {
  if (!booking || isAdmin(actor)) return booking;
  const value = { ...booking };
  if (value.groupDepartureId && typeof value.groupDepartureId === 'object' && Array.isArray(value.groupDepartureId.operators)) {
    value.groupDepartureId = { ...value.groupDepartureId, operators: operatorsForActor(value.groupDepartureId.operators, actor) };
  }
  if (value.assignedOperator && typeof value.assignedOperator === 'object') {
    value.assignedOperator = operatorForActor(value.assignedOperator, { index: 0, actor });
  }
  return value;
}
