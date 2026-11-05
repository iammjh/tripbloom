import React, { useState, useEffect } from 'react';
import { LuCalendarDays, LuMapPin, LuPlus, LuTrash2, LuTriangleAlert, LuUserCog, LuUsers, LuWallet } from 'react-icons/lu';
import axios from 'axios';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import FormField, { fieldAria, inputClass } from './ui/FormField.jsx';
import IconButton from './ui/IconButton.jsx';
import { confirmAction } from '../utils/confirmStore.js';
import { notify } from '../utils/notifyStore.js';
import { userMessage } from '../utils/errorMessage.js';

const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const STATUS_TONE = { OPEN: 'success', FULL: 'warning', CANCELLED: 'danger', CLOSED: 'neutral' };

const SECTION_TITLE = 'flex items-center gap-2 font-display text-base font-semibold text-text';

// Stat tile used for capacity, price and operator count.
function Stat({ icon: Icon, label, value, children }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-text">{value}</p>
        </div>
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>
      {children}
    </div>
  );
}

// Departure detail: schedule, capacity and operator assignment. A departure keeps at least one operator.
const GroupDepartureDetailModal = ({ isOpen, onClose, departure, onDepartureUpdated }) => {
  const [operators, setOperators] = useState([]);
  const [availableOperators, setAvailableOperators] = useState([]);
  const [showAddOperator, setShowAddOperator] = useState(false);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen && departure) {
      setOperators(departure.operators || []);
      setShowAddOperator(false);
      setSelectedOperatorId('');
      fetchAvailableOperators();
    }
  }, [isOpen, departure]);

  const fetchAvailableOperators = async () => {
    try {
      const res = await axios.get('/api/admin/users');
      const allUsers = res.data.users || [];
      setAvailableOperators(allUsers.filter(user =>
        user.isActive && user.roles?.some(r => ['TOUR_OPERATOR', 'OPERATOR'].includes(String(r).toUpperCase()))
      ));
    } catch (failure) {
      console.error('Failed to fetch operators:', failure);
    }
  };

  // Reloads the operator list after a change and tells the parent list to refresh.
  const refreshAfterChange = async () => {
    onDepartureUpdated?.();
    const res = await axios.get(`/api/admin/group-departures/${departure._id}`);
    setOperators(res.data.departure?.operators || []);
  };

  const handleAddOperator = async () => {
    if (!selectedOperatorId) return;
    if (operators.some(op => String(op.operatorId?._id || op.operatorId) === String(selectedOperatorId))) {
      notify.message('This operator is already assigned to this departure.');
      return;
    }
    setBusy(true);
    try {
      await axios.post(`/api/admin/group-departures/${departure._id}/operators`, { operatorId: selectedOperatorId });
      setShowAddOperator(false);
      setSelectedOperatorId('');
      await refreshAfterChange();
      notify.message('Operator added to this departure.');
    } catch (failure) {
      console.error('Failed to add operator:', failure);
      notify.error(userMessage(failure, 'The operator could not be added. Nothing changed; please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveOperator = async (operatorId, name) => {
    if (operators.length <= 1) {
      notify.message('A departure must keep at least one operator. Add another operator first.');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Remove this operator?',
      message: `${name || 'This operator'} will no longer be assigned to this departure.`,
      confirmLabel: 'Confirm removal',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      await axios.delete(`/api/admin/group-departures/${departure._id}/operators/${operatorId}`);
      await refreshAfterChange();
      notify.message(`${name || 'Operator'} was removed from this departure.`);
    } catch (failure) {
      console.error('Failed to remove operator:', failure);
      notify.error(userMessage(failure, 'The operator could not be removed. Nothing changed; please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (!departure) return null;

  const totalSeats = Number(departure.totalSeats || 0);
  const bookedSeats = Number(departure.bookedSeats || 0);
  const occupancy = totalSeats > 0 ? Math.min(100, Math.round((bookedSeats / totalSeats) * 100)) : 0;
  const destination = departure.packageId?.destinations?.[0]?.name;
  const assignedIds = new Set(operators.map(op => String(op.operatorId?._id || op.operatorId)));
  const addable = availableOperators.filter(op => !assignedIds.has(String(op._id)));

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={departure.packageId?.title || 'Group departure'}
      description={`${formatDate(departure.startDate)} – ${formatDate(departure.endDate)}`}
      size="xl"
      rootClassName="dark"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <Badge tone={STATUS_TONE[departure.status] || 'info'}>{departure.status}</Badge>
          {destination && <span className="inline-flex items-center gap-1.5"><LuMapPin aria-hidden="true" className="h-4 w-4" />{destination}</span>}
          <span className="inline-flex items-center gap-1.5"><LuCalendarDays aria-hidden="true" className="h-4 w-4" />{departure.packageId?.defaultDays || 'N/A'} days</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={LuUsers} label="Capacity" value={`${bookedSeats}/${totalSeats}`}>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted" role="presentation">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${occupancy}%` }} />
            </div>
            <p className="mt-1 text-xs text-text-muted">{occupancy}% booked</p>
          </Stat>
          <Stat icon={LuWallet} label="Price per person" value={`BDT ${Number(departure.pricePerPerson || 0).toLocaleString()}`} />
          <Stat icon={LuUserCog} label="Operators" value={operators.length} />
        </div>

        <section aria-labelledby="departure-operators-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="departure-operators-heading" className={SECTION_TITLE}>Assigned operators</h3>
            <Button size="sm" variant="secondary" icon={LuPlus} onClick={() => setShowAddOperator(open => !open)} aria-expanded={showAddOperator} disabled={busy}>
              Add operator
            </Button>
          </div>

          {showAddOperator && (
            <div className="glass space-y-3 rounded-2xl p-4">
              <FormField id="add-operator-select" label="Operator">
                <select {...fieldAria('add-operator-select')} value={selectedOperatorId} onChange={e => setSelectedOperatorId(e.target.value)} className={inputClass}>
                  <option value="">{addable.length ? 'Choose an operator' : 'No other active operators available'}</option>
                  {addable.map(op => <option key={op._id} value={op._id}>{op.fullName} ({op.email})</option>)}
                </select>
              </FormField>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => { setShowAddOperator(false); setSelectedOperatorId(''); }} disabled={busy}>Cancel</Button>
                <Button onClick={handleAddOperator} disabled={!selectedOperatorId} loading={busy}>Add to departure</Button>
              </div>
            </div>
          )}

          {operators.length === 0 ? (
            <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 p-6 text-center">
              <LuTriangleAlert aria-hidden="true" className="mx-auto h-8 w-8 text-danger" />
              <p className="mt-3 font-semibold text-danger">No operators assigned</p>
              <p className="mt-1 text-sm text-danger">This departure cannot run without at least one operator. Add one now.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {operators.map((op, index) => {
                const operatorData = op.operatorId;
                const operatorId = operatorData?._id || op.operatorId;
                const name = operatorData?.fullName || 'Unknown operator';
                const lastOne = operators.length <= 1;
                return (
                  <li key={operatorId || index} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand font-semibold text-on-brand">
                        {name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-text">{name}</p>
                        <p className="truncate text-sm text-text-muted">{operatorData?.email || 'No email on file'}</p>
                      </div>
                    </div>
                    <IconButton
                      label={lastOne ? `${name} cannot be removed: a departure keeps at least one operator` : `Remove ${name}`}
                      icon={LuTrash2}
                      variant="danger"
                      disabled={lastOne || busy}
                      onClick={() => handleRemoveOperator(operatorId, name)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {operators.length === 1 && (
            <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-text">
              Only one operator is assigned. Add another before removing this one.
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
};

export default GroupDepartureDetailModal;
