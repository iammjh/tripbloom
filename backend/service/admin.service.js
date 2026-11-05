import { GroupDeparture } from '../model/groupDeparture.model.js';
import { buildDashboard, receiptsByCurrency, reportBoundary, REPORT_TIMEZONE } from './analytics.service.js';
// admin.service.js
import { User } from '../model/user.model.js';
import Booking from '../model/booking.model.js';
import { TourPackage } from '../model/tourPackage.model.js';
import { Review } from '../model/review.model.js';
import { ContactMessage as Contact } from '../model/contact.model.js';
import { ActivityLog, SystemSettings, Announcement } from '../model/admin.model.js';
import { logActivity, getActivityLogOptions } from './activityLog.service.js';

// ==================== DASHBOARD ====================

// Get admin dashboard overview
export async function getAdminDashboard() {
  try {
    const [bookings, packages, departures, reviews, totalUsers, activeUsers, totalOperators, pendingContacts, recentBookings] = await Promise.all([
      Booking.find().select('customerId packageId bookingType status createdAt finalAmount totalAmount payments currency numTravelers').lean(),
      TourPackage.find().select('title').lean(),
      GroupDeparture.find({ startDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86400000) } }).populate('packageId', 'title').lean(),
      Review.find({ status: 'APPROVED' }).select('packageId rating status').lean(),
      User.countDocuments({ roles: { $in: ['customer', 'CUSTOMER'] } }),
      User.countDocuments({ roles: { $in: ['customer', 'CUSTOMER'] }, isActive: true }),
      User.countDocuments({ roles: { $in: ['tour_operator', 'TOUR_OPERATOR'] } }),
      Contact.countDocuments({ handled: false }),
      Booking.find().populate('customerId', 'fullName email').populate('packageId', 'title').sort({ createdAt: -1 }).limit(10)
    ]);
    const dashboard = buildDashboard({ bookings, packages, departures, reviews });
    return { dashboard: { ...dashboard, totalUsers, activeUsers, totalOperators, totalBookings: bookings.length, totalPackages: packages.length, totalRevenue: dashboard.revenue.net, pendingContacts, recentBookings } };
  } catch { return { error: 'Unable to load dashboard metrics.' }; }
}

// Get recent activity logs
export async function getActivityLogs({ limit = 50, adminId, action, startDate, endDate }) {
  try {
    const filter = {};
    
    if (adminId) filter.adminId = adminId;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const activities = await ActivityLog.find(filter)
      .populate('adminId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    return { activities };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again." };
  }
}

// Activity logging lives in activityLog.service.js; re-exported here for existing callers.
export { logActivity, getActivityLogOptions };

// ==================== USER MANAGEMENT ====================

// Update user role (promote/demote)
const MANAGED_ROLES = ['ADMIN', 'CUSTOMER', 'TOUR_OPERATOR'];
const hasAdminRole = roles => (roles || []).some(role => String(role).toUpperCase() === 'ADMIN');
const otherActiveAdminExists = userId => User.exists({ _id: { $ne: userId }, isActive: true, roles: { $in: ['ADMIN', 'admin'] } });
export async function updateUserRole({ userId, newRoles, adminId, ipAddress }) {
  try {
    if (!Array.isArray(newRoles) || newRoles.length === 0 || newRoles.some(role => !MANAGED_ROLES.includes(String(role).toUpperCase()))) {
      return { error: 'Provide one or more valid roles: ADMIN, CUSTOMER or TOUR_OPERATOR.', status: 400 };
    }
    const user = await User.findById(userId);
    if (!user) {
      return { error: 'User not found', status: 404 };
    }

    const oldRoles = [...user.roles];
    if (String(user._id) === String(adminId) && hasAdminRole(oldRoles) && !hasAdminRole(newRoles)) {
      return { error: 'You cannot remove your own administrator role.', status: 400 };
    }
    if (hasAdminRole(oldRoles) && !hasAdminRole(newRoles) && user.isActive && !await otherActiveAdminExists(user._id)) {
      return { error: 'At least one active administrator must remain.', status: 409 };
    }
    if (JSON.stringify([...oldRoles].sort()) === JSON.stringify([...newRoles].sort())) {
      return { user };
    }
    user.roles = newRoles;
    await user.save();

    // Log activity
    await logActivity({
      adminId,
      action: 'ROLE_CHANGED',
      targetType: 'User',
      targetId: userId,
      description: `Changed user role from ${oldRoles.join(', ')} to ${newRoles.join(', ')}`,
      metadata: { oldRoles, newRoles },
      ipAddress
    });

    return { user };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again.", status: 500 };
  }
}

// Suspend/Unsuspend user account
export async function toggleUserSuspension({ userId, suspend, adminId, reason, ipAddress }) {
  try {
    if (suspend && String(userId) === String(adminId)) {
      return { error: 'You cannot suspend your own account.', status: 400 };
    }
    const user = await User.findById(userId);
    if (!user) {
      return { error: 'User not found', status: 404 };
    }
    if (suspend && user.isActive && hasAdminRole(user.roles) && !await otherActiveAdminExists(user._id)) {
      return { error: 'At least one active administrator must remain.', status: 409 };
    }

    user.isActive = !suspend;
    await user.save();

    // Log activity
    await logActivity({
      adminId,
      action: suspend ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
      targetType: 'User',
      targetId: userId,
      description: suspend 
        ? `Suspended user: ${user.fullName} - Reason: ${reason || 'Not specified'}`
        : `Activated user: ${user.fullName}`,
      metadata: { reason, email: user.email },
      ipAddress
    });

    return { user, message: suspend ? 'User suspended' : 'User activated' };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again.", status: 500 };
  }
}

// Get all operators with their package counts
export async function getOperatorsWithStats() {
  try {
    const operators = await User.find({ roles: { $in: ['tour_operator', 'TOUR_OPERATOR'] } }).select('fullName email phone isActive createdAt');
    const result = await Promise.all(operators.map(async operator => {
      const packages = await TourPackage.find({ assignedOperators: operator._id }).select('_id');
      const departures = await GroupDeparture.find({ 'operators.operatorId': operator._id }).select('_id packageId');
      const bookings = await Booking.find({ $or: [{ assignedOperator: operator._id, groupDepartureId: null }, { groupDepartureId: { $in: departures.map(d => d._id) } }] }).select('payments currency createdAt finalAmount totalAmount');
      const revenueByCurrency = receiptsByCurrency(bookings);
      return { ...operator.toObject(), packageCount: new Set([...packages.map(p => String(p._id)), ...departures.map(d => String(d.packageId))]).size, bookingCount: bookings.length, totalRevenue: revenueByCurrency.BDT?.net || 0, currency: 'BDT', revenueByCurrency };
    }));
    return { operators: result };
  } catch { return { error: 'Unable to load operator statistics.' }; }
}

// ==================== CONTENT MODERATION ====================

// Approve or reject tour package (content moderation)
export async function moderateTourPackage({ packageId, approved, rejectionReason, adminId, ipAddress }) {
  try {
    const tourPackage = await TourPackage.findById(packageId);
    if (!tourPackage) {
      return { error: 'Package not found' };
    }

    if (approved) {
      tourPackage.status = 'APPROVED';
      tourPackage.rejectionReason = undefined;
    } else {
      tourPackage.status = 'REJECTED';
      tourPackage.rejectionReason = rejectionReason;
    }

    await tourPackage.save();

    // Log activity
    await logActivity({
      adminId,
      action: approved ? 'PACKAGE_APPROVED' : 'PACKAGE_REJECTED',
      targetType: 'TourPackage',
      targetId: packageId,
      description: approved 
        ? `Approved package: ${tourPackage.title}`
        : `Rejected package: ${tourPackage.title} - Reason: ${rejectionReason}`,
      metadata: { packageTitle: tourPackage.title, rejectionReason },
      ipAddress
    });

    return { package: tourPackage };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again." };
  }
}

// Delete inappropriate review
export async function deleteReview({ reviewId, reason, adminId, ipAddress }) {
  try {
    const review = await Review.findById(reviewId).populate('customerId', 'fullName').populate('packageId', 'title');
    if (!review) {
      return { error: 'Review not found' };
    }

    const reviewDetails = {
      userId: review.customerId?._id,
      userName: review.customerId?.fullName,
      packageId: review.packageId?._id,
      packageTitle: review.packageId?.title,
      rating: review.rating,
      comment: review.comment
    };

    await Review.findByIdAndDelete(reviewId);

    // Log activity
    await logActivity({
      adminId,
      action: 'REVIEW_DELETED',
      targetType: 'Review',
      targetId: reviewId,
      description: `Deleted review by ${reviewDetails.userName} for ${reviewDetails.packageTitle} - Reason: ${reason}`,
      metadata: { ...reviewDetails, reason },
      ipAddress
    });

    return { message: 'Review deleted', reason };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again." };
  }
}

// ==================== ANALYTICS ====================

// Get platform metrics for specific date range
export async function getPlatformMetrics({ startDate, endDate }) {
  const from = startDate ? reportBoundary(startDate) : new Date(0);
  const until = endDate ? reportBoundary(endDate, { endOfDay: true }) : new Date();
  if (!Number.isFinite(+from) || !Number.isFinite(+until) || until < from) return { error: 'Provide valid dates in chronological order.', status: 400 };
  try {
    const dateFilter = { createdAt: { $gte: from, $lte: until } };
    const [newUsers, newBookings, bookings, newPackages, newReviews] = await Promise.all([
      User.countDocuments(dateFilter), Booking.countDocuments(dateFilter), Booking.find().select('payments currency createdAt').lean(), TourPackage.countDocuments(dateFilter), Review.countDocuments(dateFilter)
    ]);
    const revenueByCurrency = receiptsByCurrency(bookings, from, until);
    return { metrics: { newUsers, newBookings, newPackages, newReviews, revenue: revenueByCurrency.BDT?.net || 0, currency: 'BDT', revenueByCurrency, period: { startDate: from.toISOString(), endDate: until.toISOString(), timezone: REPORT_TIMEZONE } } };
  } catch { return { error: 'Unable to load platform metrics.' }; }
}

// ==================== SYSTEM SETTINGS ====================

// Get system setting by key
export async function getSystemSetting({ key }) {
  try {
    const setting = await SystemSettings.findOne({ key });
    if (!setting) {
      return { error: 'Setting not found' };
    }
    return { setting };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again." };
  }
}

// Get all system settings
export async function getAllSystemSettings({ category }) {
  try {
    const filter = category ? { category } : {};
    const settings = await SystemSettings.find(filter).populate('lastUpdatedBy', 'fullName email');
    return { settings };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again." };
  }
}

// Update or create system setting
export async function updateSystemSetting({ key, value, category, description, adminId, ipAddress }) {
  try {
    let setting = await SystemSettings.findOne({ key });
    
    if (setting) {
      setting.value = value;
      setting.category = category || setting.category;
      setting.description = description || setting.description;
      setting.lastUpdatedBy = adminId;
      setting.updatedAt = new Date();
    } else {
      setting = new SystemSettings({
        key,
        value,
        category,
        description,
        lastUpdatedBy: adminId
      });
    }

    await setting.save();

    // Log activity
    await logActivity({
      adminId,
      action: 'SETTINGS_UPDATED',
      targetType: 'Settings',
      targetId: setting._id,
      description: `Updated system setting: ${key}`,
      metadata: { key, value, category },
      ipAddress
    });

    return { setting };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again." };
  }
}

// ==================== ANNOUNCEMENTS ====================

// Create announcement
export async function createAnnouncement({ title, message, type, targetAudience, priority, startDate, endDate, adminId, ipAddress }) {
  try {
    const announcement = new Announcement({
      title,
      message,
      type: type || 'INFO',
      targetAudience: targetAudience || ['ALL'],
      priority: priority || 'MEDIUM',
      startDate: startDate || new Date(),
      endDate,
      createdBy: adminId || null
    });

    await announcement.save();

    // Log activity (only if adminId exists)
    if (adminId) {
      await logActivity({
        adminId,
        action: 'ANNOUNCEMENT_CREATED',
        targetType: 'Announcement',
        targetId: announcement._id,
        description: `Created announcement: ${title}`,
        metadata: { title, type, targetAudience, priority },
        ipAddress
      });
    }

    return { announcement };
  } catch (error) {
    console.error('Failed to create announcement:', error);
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again." };
  }
}

// Get active announcements
export async function getActiveAnnouncements({ audience }) {
  try {
    const now = new Date();
    const filter = {
      isActive: true,
      startDate: { $lte: now },
      $or: [
        { endDate: { $gte: now } },
        { endDate: null }
      ]
    };

    if (audience) {
      filter.targetAudience = { $in: [audience, 'ALL'] };
    }

    const announcements = await Announcement.find(filter)
      .populate('createdBy', 'fullName')
      .sort({ priority: -1, createdAt: -1 });

    return { announcements };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again." };
  }
}

// Update announcement
export async function updateAnnouncement({ announcementId, updates, adminId, ipAddress }) {
  try {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      return { error: 'Announcement not found' };
    }

    Object.assign(announcement, updates);
    announcement.updatedAt = new Date();
    await announcement.save();

    // Log activity
    await logActivity({
      adminId,
      action: 'ANNOUNCEMENT_UPDATED',
      targetType: 'Announcement',
      targetId: announcementId,
      description: `Updated announcement: ${announcement.title}`,
      metadata: { updates },
      ipAddress
    });

    return { announcement };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again." };
  }
}

// Delete announcement
export async function deleteAnnouncement({ announcementId, adminId, ipAddress }) {
  try {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      return { error: 'Announcement not found' };
    }

    await Announcement.findByIdAndDelete(announcementId);

    // Log activity
    await logActivity({
      adminId,
      action: 'ANNOUNCEMENT_DELETED',
      targetType: 'Announcement',
      targetId: announcementId,
      description: `Deleted announcement: ${announcement.title}`,
      ipAddress
    });

    return { message: 'Announcement deleted' };
  } catch (error) {
    console.error("Operation failed:", error.name); return { error: "Something went wrong. Please try again." };
  }
}
