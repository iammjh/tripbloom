import mongoose from 'mongoose';
const paymentReceiptSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  method: { type: String, required: true },
  transactionRef: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
paymentReceiptSchema.index({ method: 1, transactionRef: 1 }, { unique: true });
export const PaymentReceipt = mongoose.model('PaymentReceipt', paymentReceiptSchema);
