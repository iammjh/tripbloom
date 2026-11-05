// admin.model.js
import mongoose from 'mongoose';

// Activity Log Schema - Track admin actions for audit trail
const activityLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // optional: allow system-generated logs when no adminId is available
  },
  action: {
    type: String,
    required: true,
    enum: [
      'USER_CREATED',
      'USER_UPDATED',
      'USER_SUSPENDED',
      'USER_ACTIVATED',
      'ROLE_CHANGED',
      'PACKAGE_APPROVED',
      'PACKAGE_REJECTED',
      'PACKAGE_DELETED',
      'REVIEW_DELETED',
      'OPERATOR_CREATED',
      'OPERATOR_DELETED',
      'BOOKING_CANCELLED',
      'REFUND_PROCESSED',
      'SETTINGS_UPDATED',
      'ANNOUNCEMENT_CREATED',
      'CONTACT_RESOLVED',
      'ANNOUNCEMENT_UPDATED',
      'ANNOUNCEMENT_DELETED',
      'PAYMENT_VERIFIED',
      'PAYMENT_REJECTED',
      'DATE_CHANGE_APPROVED',
      'DATE_CHANGE_REJECTED',
      'KYC_APPROVED',
      'KYC_REJECTED'
    ]
  },
  targetType: {
    type: String,
    enum: ['User', 'TourPackage', 'Booking', 'Review', 'Operator', 'Contact', 'Settings', 'Announcement'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
activityLogSchema.index({ adminId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

// System Settings Schema - Store platform configuration
const systemSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  category: {
    type: String,
    enum: ['GENERAL', 'PAYMENT', 'EMAIL', 'BOOKING', 'SECURITY', 'NOTIFICATION'],
    default: 'GENERAL'
  },
  description: {
    type: String
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Platform Announcement Schema - For system-wide announcements
const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['INFO', 'WARNING', 'SUCCESS', 'ERROR', 'MAINTENANCE'],
    default: 'INFO'
  },
  targetAudience: {
    type: [String],
    enum: ['ALL', 'CUSTOMERS', 'OPERATORS', 'ADMINS'],
    default: ['ALL']
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Made optional for now since auth is not fully implemented
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for active announcements
announcementSchema.index({ isActive: 1, startDate: -1 });

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
export const Announcement = mongoose.model('Announcement', announcementSchema);
