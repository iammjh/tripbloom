import mongoose from 'mongoose';
import { paymentTotals } from '../service/paymentAccounting.js';

const travelerSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    required: true,
    min: 0
  },
  phone: {
    type: String,
    trim: true
  }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  method: {
    type: String,
    required: true,
    enum: ['BKASH', 'NAGAD', 'ROCKET', 'CARD', 'BANK_TRANSFER', 'CASH', 'REFUND'],
    uppercase: true
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
    default: 'PENDING',
    uppercase: true
  },
  transactionRef: {
    type: String,
    trim: true
  },
  submittedAt: { type: Date },
  verifiedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verificationNote: { type: String, trim: true, maxlength: 1000 },
  paidAt: {
    type: Date
  }
}, { timestamps: true });

const cancellationSchema = new mongoose.Schema({
  isCancelled: {
    type: Boolean,
    default: false
  },
  reason: {
    type: String,
    trim: true
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: {
    type: Date
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  refundProcessed: {
    type: Boolean,
    default: false
  },
  refundProcessedAt: {
    type: Date
  },
  refundProcessedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

const dateChangeRequestSchema = new mongoose.Schema({
  requestedDate: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    trim: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String,
    trim: true
  }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  // Human-readable code shown on the booking, its refund and its date change, e.g. #RL001.
  bookingCode: { type: String, trim: true, unique: true, sparse: true, index: true },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TourPackage',
    required: true,
    index: true
  },
  bookingType: {
    type: String,
    required: true,
    enum: ['GROUP', 'PRIVATE', 'CUSTOM'],
    default: 'GROUP',
    uppercase: true
  },
  groupDepartureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupDeparture'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  numTravelers: {
    type: Number,
    required: true,
    min: 1
  },
  travelers: {
    type: [travelerSchema],
    required: true,
    validate: {
      validator: function(v) {
        return v.length === this.numTravelers;
      },
      message: 'Number of travelers must match numTravelers field'
    }
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  pointsUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  pointsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'BDT',
    uppercase: true
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED'],
    default: 'PENDING',
    uppercase: true,
    index: true
  },
  payments: {
    type: [paymentSchema],
    default: []
  },
  cancellation: {
    type: cancellationSchema,
    default: () => ({})
  },
  dateChangeRequest: {
    type: dateChangeRequestSchema,
    default: null
  },
  reservedSeats: {
    type: [String],
    default: []
  },
  customizations: { type: String, trim: true, maxlength: 4000, default: '' },
  operatorNotes: { type: String, trim: true, maxlength: 5000, default: '' },
  assignedOperator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  ,
  checkedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: {
    type: Date
  },
  checkedInByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  optimisticConcurrency: true
});

// Indexes for efficient queries
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ packageId: 1, status: 1 });
bookingSchema.index({ groupDepartureId: 1 });
bookingSchema.index({ startDate: 1 });
bookingSchema.index({ endDate: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });

// Virtual for checking if booking is active
bookingSchema.virtual('isActive').get(function() {
  return this.status === 'CONFIRMED' && !this.cancellation.isCancelled;
});

// Virtual for total paid amount
bookingSchema.virtual('totalPaid').get(function() { return paymentTotals(this).gross; });
bookingSchema.virtual('netPaid').get(function() { return paymentTotals(this).net; });
bookingSchema.virtual('remainingAmount').get(function() { return paymentTotals(this).remaining; });
bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

// Static method to calculate points for tour category
bookingSchema.statics.calculatePointsForCategory = function(category, amount) {
  const pointsRate = {
    'Adventure': 100,      // 100 points per tour
    'Beach': 80,
    'Cultural': 90,
    'Wildlife': 110,
    'Mountain': 120,
    'City Tour': 70,
    'Cruise': 150,
    'Religious': 60,
    'Historical': 85,
    'Nature': 95
  };
  
  // Base points by category + bonus (1 point per 100 BDT spent)
  const basePoints = pointsRate[category] || 50;
  const bonusPoints = Math.floor(amount / 100);
  
  return basePoints + bonusPoints;
};

// Static method to calculate discount from points (1 point = 1 BDT)
bookingSchema.statics.calculateDiscountFromPoints = function(points, totalAmount) {
  // Max discount is 20% of total amount
  const maxDiscount = Math.floor(totalAmount * 0.2);
  const pointsValue = points; // 1 point = 1 BDT
  
  return Math.min(pointsValue, maxDiscount);
};

// Pre-save middleware to validate dates
bookingSchema.pre('save', function(next) {
  if (this.endDate <= this.startDate) {
    return next(new Error('End date must be after start date'));
  }
  next();
});

// Method to cancel booking
bookingSchema.methods.cancelBooking = function(userId, reason, refundAmount = 0) {
  this.cancellation.isCancelled = true;
  this.cancellation.reason = reason;
  this.cancellation.cancelledBy = userId;
  this.cancellation.cancelledAt = new Date();
  this.cancellation.refundAmount = refundAmount;
  this.status = 'CANCELLED';
  return this.save();
};

// Method to add payment
bookingSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  
  // Update status if fully paid
  if (this.totalPaid >= this.finalAmount) {
    this.status = 'CONFIRMED';
  }
  
  return this.save();
};

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
