// user.model.js
import mongoose from 'mongoose';

export const ROLES = {
  ADMIN: 'admin',
  CUSTOMER: 'customer',
  TOUR_OPERATOR: 'tour_operator',
};


const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  age: { type: Number, min: 1, max: 120 },
  availability: {
    type: String,
    enum: ['AVAILABLE', 'UNAVAILABLE'],
    default: 'AVAILABLE'
  },
  passwordHash: { type: String, required: true },
  roles: {
    type: [String],
    enum: ['ADMIN', 'admin', 'CUSTOMER', 'customer', 'TOUR_OPERATOR', 'tour_operator'],
    required: true
  },
  savedPackages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TourPackage' }],
  rewardPoints: { type: Number, default: 0, min: 0 },
  pointsHistory: [{
    amount: { type: Number, required: true },
    type: { type: String, enum: ['EARNED', 'USED', 'EXPIRED'], required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    reason: { type: String },
    date: { type: Date, default: Date.now }
  }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});


// Authentication can read the stored hash; HTTP serialization never exposes it.
userSchema.set('toJSON', { transform(doc, value) { delete value.passwordHash; return value; } });

export const User = mongoose.model('User', userSchema);
