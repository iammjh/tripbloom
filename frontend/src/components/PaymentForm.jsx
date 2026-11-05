import React, { useState } from 'react';
import { paymentTotals } from '../utils/paymentAccounting';

const PaymentForm = ({ booking, onSuccess, onCancel }) => {
  const { availableToSubmit, pending } = paymentTotals(booking);
  const [amount, setAmount] = useState(availableToSubmit);
  const [method, setMethod] = useState('BKASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async event => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch(`/api/bookings/${booking._id || booking.id}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, method, transactionRef }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to submit payment.');
      if (data.payment?.status === 'FAILED') throw new Error('This reference was rejected. Check its verification notes or contact support; submit a different receipt when appropriate.');
      onSuccess(data);
    } catch (failure) { setError(failure.message || 'Unable to submit payment.'); }
    finally { setLoading(false); }
  };
  return <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-3">
    <h3 className="font-semibold">Submit manual payment</h3>
    <p className="text-sm">Complete payment using the instructions provided by TripBloom, then submit your receipt reference. An administrator must verify it before your booking is confirmed. This form does not transfer money.</p>
    {pending > 0 && <p className="text-sm">Awaiting verification: {booking.currency || 'BDT'} {pending}</p>}
    <label className="block">Amount ({booking.currency || 'BDT'})<input aria-label="Payment amount" required type="number" min="0.01" step="0.01" max={availableToSubmit} value={amount} onChange={e => setAmount(Number(e.target.value))} className="block w-full p-2 rounded border dark:bg-gray-800" /></label>
    <label className="block">Method<select aria-label="Payment method" value={method} onChange={e => setMethod(e.target.value)} className="block w-full p-2 rounded border dark:bg-gray-800">
      {['BKASH', 'NAGAD', 'ROCKET', 'BANK_TRANSFER', 'CASH', 'CARD'].map(value => <option key={value} value={value}>{value.replace('_', ' ')}{value === 'CARD' ? ' (external receipt)' : ''}</option>)}
    </select></label>
    <label className="block">Receipt / transaction reference<input aria-label="Payment reference" required maxLength={120} value={transactionRef} onChange={e => setTransactionRef(e.target.value)} className="block w-full p-2 rounded border dark:bg-gray-800" /></label>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <button disabled={loading || availableToSubmit <= 0} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">{loading ? 'Submitting…' : 'Submit for verification'}</button>
    <button type="button" onClick={onCancel} className="ml-2 px-4 py-2 border rounded">Cancel</button>
  </form>;
};
export default PaymentForm;
