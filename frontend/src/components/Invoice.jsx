import { LuDownload, LuPrinter, LuX } from 'react-icons/lu';
import { paymentTotals } from '../utils/paymentAccounting';
import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { bookingLabel } from '../utils/bookingCode.js';


const Invoice = ({ isOpen, onClose, booking }) => {
  const invoiceRef = useRef(null);

  if (!isOpen || !booking) return null;

  const formatDate = (date) => {
    try {
      return new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: booking.currency || 'BDT',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const packageInfo = booking.packageId || {};
  const { gross: totalPaid, remaining: balance } = paymentTotals(booking);

  // The print window gets fixed styling plus a copy of the rendered invoice node. No booking data is written as HTML text:
  // the copy keeps React's escaped text as it is, and the title is set as plain text.
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !invoiceRef.current) return;
    const doc = printWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice</title><style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .invoice-container { max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 20px; }
      .header h1 { color: #10b981; margin: 0; }
      .info-section { margin: 20px 0; }
      .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
      .info-label { font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
      th { background-color: #f3f4f6; font-weight: bold; }
      .total-section { margin-top: 20px; text-align: right; }
      .total-row { padding: 8px 0; }
      .total-amount { font-size: 1.5em; font-weight: bold; color: #10b981; }
      .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #10b981; color: #6b7280; }
      @media print { .no-print { display: none; } }
    </style></head><body></body></html>`);
    doc.close();
    doc.title = `Invoice - ${String(booking._id || booking.id || '')}`;
    doc.body.appendChild(doc.importNode(invoiceRef.current, true));
    printWindow.focus();
    printWindow.print();
  };

  const handleDownload = () => {
    handlePrint();
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b flex justify-between items-center z-10">
          <h2 className="text-xl font-bold">Invoice</h2>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <LuPrinter aria-hidden="true" /> Print
            </button>
            <button 
              onClick={handleDownload}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <LuDownload aria-hidden="true" /> Download
            </button>
            <button 
              aria-label="Close" 
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <LuX aria-hidden="true" />
            </button>
          </div>
        </div>

        <div ref={invoiceRef} className="p-8">
          {/* Header */}
          <div className="text-center border-b-2 border-primary pb-6 mb-6">
            <h1 className="text-4xl font-bold text-primary mb-2">TripBloom</h1>
            <p className="text-gray-600 dark:text-gray-400">Where Every Journey Blossoms</p>
            <p className="text-sm text-gray-500 mt-2">Email: info@tripbloom.com | Phone: +880-123-456789</p>
          </div>

          {/* Invoice Info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-bold text-lg mb-3">Invoice Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice #:</span>
                  <span className="font-semibold">{bookingLabel(booking)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Booking Date:</span>
                  <span className="font-semibold">{formatDate(booking.createdAt || booking.bookingDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-semibold ${booking.status === 'CONFIRMED' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {booking.status}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3">Customer Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-semibold">{booking.travelers?.[0]?.name || booking.customerId?.fullName || booking.customerId?.name || 'Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-semibold text-sm">{booking.customerId?.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-semibold">{booking.customerId?.phone || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Package Details */}
          <div className="mb-6">
            <h3 className="font-bold text-lg mb-3 border-b pb-2">Package Details</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 text-sm">Package Name</p>
                  <p className="font-bold text-lg">{packageInfo.title || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Destination</p>
                  <p className="font-semibold">{packageInfo.destinations?.[1]?.name || packageInfo.destinations?.[0]?.name || packageInfo.destination || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Travel Dates</p>
                  <p className="font-semibold">
                    {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Number of Travelers</p>
                  <p className="font-semibold">{booking.numTravelers || 1}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Travelers */}
          {booking.travelers && booking.travelers.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-3 border-b pb-2">Traveler Information</h3>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-900">
                    <th className="text-left p-3">#</th>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Age</th>
                    <th className="text-left p-3">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.travelers.map((traveler, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-3">{idx + 1}</td>
                      <td className="p-3">{traveler.name || traveler.fullName || 'N/A'}</td>
                      <td className="p-3">{traveler.age || 'N/A'}</td>
                      <td className="p-3">{traveler.phone || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payment History */}
          {booking.payments && booking.payments.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-3 border-b pb-2">Payment History</h3>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-900">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Method</th>
                    <th className="text-left p-3">Transaction Ref</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-center p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.payments.map((payment, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-3">{formatDate(payment.date || payment.createdAt)}</td>
                      <td className="p-3">{payment.method || 'N/A'}</td>
                      <td className="p-3 text-sm">{payment.transactionRef || '-'}</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(payment.amount)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          payment.status === 'COMPLETED' || payment.status === 'CONFIRMED' 
                            ? 'bg-green-100 text-green-800' 
                            : payment.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total Section */}
          <div className="border-t-2 pt-6 mt-6">
            <div className="flex justify-end">
              <div className="w-80">
                <div className="flex justify-between py-2 border-b">
                  <span className="font-semibold">Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(booking.totalAmount)}</span>
                </div>
                {booking.discountAmount > 0 && <div className="flex justify-between py-2 border-b"><span>Discount:</span><span>{formatCurrency(booking.discountAmount)}</span></div>}
                <div className="flex justify-between py-2 border-b"><span>Final amount:</span><span>{formatCurrency(booking.finalAmount ?? booking.totalAmount)}</span></div>
                <div className="flex justify-between py-2 border-b text-green-600">
                  <span className="font-semibold">Total Paid:</span>
                  <span className="font-semibold">{formatCurrency(totalPaid)}</span>
                </div>
                <div className={`flex justify-between py-3 text-xl ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  <span className="font-bold">Balance Due:</span>
                  <span className="font-bold">{formatCurrency(balance)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t text-center text-gray-600 dark:text-gray-400 text-sm">
            <p className="mb-2">Thank you for choosing TripBloom!</p>
            <p>For any queries, please contact us at support@tripbloom.com</p>
            <p className="mt-4 text-xs">This is a computer-generated invoice and does not require a signature.</p>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default Invoice;
