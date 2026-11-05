import { ActivityLog } from '../model/admin.model.js';
import { User } from '../model/user.model.js';

// Writes one administrator activity entry after the action has succeeded. A failed write is logged to the server
// console and never fails the action itself.
export async function logActivity({ adminId, action, targetType, targetId, description, metadata, ipAddress }) {
  try {
    const logPayload = {
      action,
      targetType,
      targetId,
      description,
      metadata: metadata || {},
      ipAddress
    };

    if (adminId) logPayload.adminId = adminId;

    const log = new ActivityLog(logPayload);

    await log.save();
    return { log };
  } catch (error) {
    console.error('Failed to log activity:', error);
    return { error: error.message };
  }
}

// Actions and administrators present in the log, so the filter controls list every option, not only the loaded rows.
export async function getActivityLogOptions() {
  try {
    const [recorded, adminIds] = await Promise.all([ActivityLog.distinct('action'), ActivityLog.distinct('adminId')]);
    const admins = await User.find({ _id: { $in: adminIds.filter(Boolean) } }).select('fullName').lean();
    // Every action the system can record, so the filter lists them even before any entry exists.
    const known = ActivityLog.schema.path('action').enumValues || [];
    return {
      actions: [...new Set([...known, ...recorded])].sort(),
      admins: admins
        .map(admin => ({ id: String(admin._id), name: admin.fullName || 'Administrator' }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (error) {
    return { error: error.message };
  }
}
