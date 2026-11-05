// tourPackage.model.js
import mongoose from 'mongoose';

const TOUR_PACKAGE_TYPES = ['PERSONAL', 'GROUP'];
const PERSONAL_CATEGORIES = ['SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];

const tourPackageSchema = new mongoose.Schema({
  // Two to five capital letters used in booking codes, e.g. RL for Rangamati Lake.
  code: { type: String, uppercase: true, trim: true, match: /^[A-Z]{2,5}$/, unique: true, sparse: true },
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: TOUR_PACKAGE_TYPES, required: true },
  category: { type: String, enum: PERSONAL_CATEGORIES, required: function() { return this.type === 'PERSONAL'; }, default: null },
  basePrice: { type: Number, required: true },
  defaultDays: { type: Number, required: true },
  defaultNights: { type: Number, required: true },
    inclusions: {
      transport: String,
      hotel: String,
      meals: String,
      guide: Boolean
    },
    destinations: [{
      name: String,
      country: String,
      city: String,
      order: Number
    }],
    extras: [String],
    photos: [{ type: String }], // Array of photo URLs
  assignedOperators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Operators assigned to this package
  isInternational: { type: Boolean, default: false }, // Requires KYC for booking
  mapLocation: {
    lat: { type: Number },
    lng: { type: Number },
    zoom: { type: Number, default: 12 }
  }, // Location coordinates for map display
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export const TourPackage = mongoose.model('TourPackage', tourPackageSchema);
export const TOUR_PACKAGE_TYPES_ENUM = TOUR_PACKAGE_TYPES;
export const PERSONAL_CATEGORIES_ENUM = PERSONAL_CATEGORIES;
