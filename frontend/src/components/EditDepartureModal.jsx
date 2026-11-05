import React, { useState, useEffect } from 'react';
import { LuCalendarDays, LuUsers, LuWallet } from 'react-icons/lu';
import axios from 'axios';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import FormField, { fieldAria, inputClass } from './ui/FormField.jsx';
import { notify } from '../utils/notifyStore.js';

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'FULL', label: 'Full' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const SECTION_TITLE = 'flex items-center gap-2 font-display text-base font-semibold text-text';

// Edit a group departure's dates, seats, price and status. Seats cannot drop below the number already booked.
const EditDepartureModal = ({ isOpen, onClose, departure, onDepartureUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    totalSeats: 40,
    pricePerPerson: '',
    status: 'OPEN',
  });

  useEffect(() => {
    if (isOpen && departure) {
      setFormData({
        startDate: departure.startDate ? new Date(departure.startDate).toISOString().split('T')[0] : '',
        endDate: departure.endDate ? new Date(departure.endDate).toISOString().split('T')[0] : '',
        totalSeats: departure.totalSeats || 40,
        pricePerPerson: departure.pricePerPerson || '',
        status: departure.status || 'OPEN',
      });
      setError('');
    }
  }, [isOpen, departure]);

  const bookedSeats = Number(departure?.bookedSeats || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.startDate || !formData.endDate) {
      setError('Choose both a start date and an end date.');
      return;
    }
    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      setError('The end date must be after the start date.');
      return;
    }
    if (!formData.totalSeats || Number(formData.totalSeats) < 1) {
      setError('Total seats must be at least 1.');
      return;
    }
    if (Number(formData.totalSeats) < bookedSeats) {
      setError(`Total seats cannot be less than the ${bookedSeats} seats already booked.`);
      return;
    }
    if (formData.pricePerPerson === '' || Number(formData.pricePerPerson) < 0) {
      setError('Enter a valid price per person.');
      return;
    }

    setLoading(true);
    try {
      await axios.put(`/api/admin/group-departures/${departure._id}`, {
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalSeats: parseInt(formData.totalSeats, 10),
        pricePerPerson: parseFloat(formData.pricePerPerson),
        status: formData.status,
      });
      notify.message('Departure updated.');
      onDepartureUpdated?.();
      onClose();
    } catch (failure) {
      console.error('Failed to update departure:', failure);
      const message = failure.response?.data?.message || 'The departure could not be saved. Nothing changed; please try again.';
      setError(message);
      notify.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!departure) return null;

  const packageTitle = departure.packageId?.title || 'Group departure';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Edit departure"
      description={`${packageTitle} · ${departure.packageId?.defaultDays || 'N/A'} days`}
      size="lg"
      rootClassName="dark"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="departure-edit-form" loading={loading}>Save departure</Button>
        </>
      )}
    >
      <form id="departure-edit-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
        {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}

        <section aria-labelledby="departure-dates-heading" className="space-y-4">
          <h3 id="departure-dates-heading" className={SECTION_TITLE}><LuCalendarDays aria-hidden="true" className="h-4 w-4 text-brand" /> Dates</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="departure-start" label="Start date" required>
              <input {...fieldAria('departure-start')} type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className={inputClass} />
            </FormField>
            <FormField id="departure-end" label="End date" required>
              <input {...fieldAria('departure-end')} type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className={inputClass} />
            </FormField>
          </div>
        </section>

        <section aria-labelledby="departure-capacity-heading" className="space-y-4">
          <h3 id="departure-capacity-heading" className={SECTION_TITLE}><LuUsers aria-hidden="true" className="h-4 w-4 text-brand" /> Capacity and price</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="departure-seats"
              label="Total seats"
              required
              hint={bookedSeats > 0 ? `${bookedSeats} seats are already booked.` : 'Seats available to book on this departure.'}
            >
              <input {...fieldAria('departure-seats', { hint: true })} type="number" min="1" value={formData.totalSeats} onChange={e => setFormData({ ...formData, totalSeats: e.target.value })} className={inputClass} />
            </FormField>
            <FormField id="departure-price" label="Price per person (BDT)" required>
              <div className="relative">
                <LuWallet aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input {...fieldAria('departure-price')} type="number" min="0" step="0.01" value={formData.pricePerPerson} onChange={e => setFormData({ ...formData, pricePerPerson: e.target.value })} className={`${inputClass} pl-9`} />
              </div>
            </FormField>
          </div>
        </section>

        <section aria-labelledby="departure-status-heading" className="space-y-4">
          <h3 id="departure-status-heading" className="font-display text-base font-semibold text-text">Status</h3>
          <FormField id="departure-status" label="Booking status" hint="Closed and cancelled departures stop accepting bookings.">
            <select {...fieldAria('departure-status', { hint: true })} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className={inputClass} required>
              {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormField>
        </section>
      </form>
    </Modal>
  );
};

export default EditDepartureModal;
