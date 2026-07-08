// admin.controller.js
import {
  getAdminDashboard,
  getActivityLogs,
  updateUserRole,
  toggleUserSuspension,
  getOperatorsWithStats,
  moderateTourPackage,
  deleteReview,
  getPlatformMetrics,
  getSystemSetting,
  getAllSystemSettings,
  updateSystemSetting,
  createAnnouncement,
  getActiveAnnouncements,
  updateAnnouncement,
  deleteAnnouncement
} from '../service/admin.service.js';

// Helper to extract admin info from request (safe for server)
const getAdminInfo = (req) => {
  const adminId = req?.user?._id || req?.userId || null;
  const ipAddress = req?.ip || req?.connection?.remoteAddress || req?.socket?.remoteAddress || req?.headers?.['x-forwarded-for'] || 'unknown';
  return { adminId, ipAddress };
};

// ==================== DASHBOARD ====================

// Get admin dashboard overview
export async function getAdminDashboardController(req, res) {
  const result = await getAdminDashboard();

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    ...result
  });
}

// Get activity logs
export async function getActivityLogsController(req, res) {
  const { limit, adminId, action, startDate, endDate } = req.query;
  const result = await getActivityLogs({ 
    limit: parseInt(limit) || 50,
    adminId,
    action,
    startDate,
    endDate
  });

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    ...result
  });
}

// ==================== USER MANAGEMENT ====================

// Update user role
export async function updateUserRoleController(req, res) {
  const { userId } = req.params;
  const { roles } = req.body;
  const { adminId, ipAddress } = getAdminInfo(req);

  if (!roles || !Array.isArray(roles)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid roles provided'
    });
  }

  const result = await updateUserRole({ userId, newRoles: roles, adminId, ipAddress });

  if (result.error) {
    return res.status(result.error === 'User not found' ? 404 : 500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: 'User role updated successfully',
    user: result.user
  });
}

// Suspend or activate user
export async function toggleUserSuspensionController(req, res) {
  const { userId } = req.params;
  const { suspend, reason } = req.body;
  const { adminId, ipAddress } = getAdminInfo(req);

  if (typeof suspend !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'Suspension status must be specified'
    });
  }

  const result = await toggleUserSuspension({ userId, suspend, adminId, reason, ipAddress });

  if (result.error) {
    return res.status(result.error === 'User not found' ? 404 : 500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: result.message,
    user: result.user
  });
}

// Get operators with statistics
export async function getOperatorsWithStatsController(req, res) {
  const result = await getOperatorsWithStats();

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    ...result
  });
}

// ==================== CONTENT MODERATION ====================

// Moderate tour package (approve/reject)
export async function moderateTourPackageController(req, res) {
  const { packageId } = req.params;
  const { approved, rejectionReason } = req.body;
  const { adminId, ipAddress } = getAdminInfo(req);

  if (typeof approved !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'Approval status must be specified'
    });
  }

  if (!approved && !rejectionReason) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required when rejecting a package'
    });
  }

  const result = await moderateTourPackage({ packageId, approved, rejectionReason, adminId, ipAddress });

  if (result.error) {
    return res.status(result.error === 'Package not found' ? 404 : 500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: `Package ${approved ? 'approved' : 'rejected'} successfully`,
    package: result.package
  });
}

// Delete review (content moderation)
export async function deleteReviewController(req, res) {
  const { reviewId } = req.params;
  const { reason } = req.body;
  const { adminId, ipAddress } = getAdminInfo(req);

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Deletion reason is required'
    });
  }

  const result = await deleteReview({ reviewId, reason, adminId, ipAddress });

  if (result.error) {
    return res.status(result.error === 'Review not found' ? 404 : 500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: result.message
  });
}

// ==================== ANALYTICS ====================

// Get platform metrics for date range
export async function getPlatformMetricsController(req, res) {
  const { startDate, endDate } = req.query;

  const result = await getPlatformMetrics({ startDate, endDate });

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    ...result
  });
}

// ==================== SYSTEM SETTINGS ====================

// Get single system setting
export async function getSystemSettingController(req, res) {
  const { key } = req.params;

  const result = await getSystemSetting({ key });

  if (result.error) {
    return res.status(result.error === 'Setting not found' ? 404 : 500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    ...result
  });
}

// Get all system settings
export async function getAllSystemSettingsController(req, res) {
  const { category } = req.query;

  const result = await getAllSystemSettings({ category });

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  // Convert settings array into root-level keys for frontend compatibility
  const settingsObj = {};
  if (result.settings && Array.isArray(result.settings)) {
    result.settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
  }

  res.json({
    success: true,
    ...result,
    ...settingsObj
  });
}

// Bulk update system settings
export async function saveAllSystemSettingsController(req, res) {
  const settingsData = req.body;
  const { adminId, ipAddress } = getAdminInfo(req);

  try {
    for (const [key, value] of Object.entries(settingsData)) {
      const result = await updateSystemSetting({
        key,
        value,
        adminId,
        ipAddress
      });
      if (result.error) {
        return res.status(500).json({ success: false, message: result.error });
      }
    }
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save settings', error: err.message });
  }
}

// Update system setting
export async function updateSystemSettingController(req, res) {
  const { key } = req.params;
  const { value, category, description } = req.body;
  const { adminId, ipAddress } = getAdminInfo(req);

  if (value === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Setting value is required'
    });
  }

  const result = await updateSystemSetting({ key, value, category, description, adminId, ipAddress });

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: 'Setting updated successfully',
    ...result
  });
}

// ==================== ANNOUNCEMENTS ====================

// Create announcement
export async function createAnnouncementController(req, res) {
  const { title, message, type, targetAudience, priority, startDate, endDate } = req.body;
  const { adminId, ipAddress } = getAdminInfo(req);

  console.log('Create announcement request:', { title, message, type, targetAudience, priority, startDate, endDate, adminId, ipAddress });

  if (!title || !message) {
    return res.status(400).json({
      success: false,
      message: 'Title and message are required'
    });
  }

  const result = await createAnnouncement({
    title,
    message,
    type,
    targetAudience,
    priority,
    startDate,
    endDate,
    adminId,
    ipAddress
  });

  if (result.error) {
    console.error('Create announcement error:', result.error);
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  console.log('Announcement created successfully:', result.announcement?._id);
  res.json({
    success: true,
    message: 'Announcement created successfully',
    ...result
  });
}

// Get active announcements
export async function getActiveAnnouncementsController(req, res) {
  const { audience } = req.query;

  const result = await getActiveAnnouncements({ audience });

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    ...result
  });
}

// Update announcement
export async function updateAnnouncementController(req, res) {
  const { announcementId } = req.params;
  const updates = req.body;
  const { adminId, ipAddress } = getAdminInfo(req);

  const result = await updateAnnouncement({ announcementId, updates, adminId, ipAddress });

  if (result.error) {
    return res.status(result.error === 'Announcement not found' ? 404 : 500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: 'Announcement updated successfully',
    ...result
  });
}

// Delete announcement
export async function deleteAnnouncementController(req, res) {
  const { announcementId } = req.params;
  const { adminId, ipAddress } = getAdminInfo(req);

  const result = await deleteAnnouncement({ announcementId, adminId, ipAddress });

  if (result.error) {
    return res.status(result.error === 'Announcement not found' ? 404 : 500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: result.message
  });
}
