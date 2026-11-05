import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { listUsers, createUser, updateUser, deactivateUser } from '../service/user.service.js';
import { updateUserRole, toggleUserSuspension } from '../service/admin.service.js';
// List users with filters (role, active/inactive, search)
export async function listUsersController(req, res) {
  const { role, isActive, search } = req.query;
  try {
    const users = await listUsers({ role, isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined, search });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// Create a new user (admin only)
export async function createUserController(req, res) {
  const { fullName, email, phone, password, passwordHash, roles, isActive } = req.body;
  try {
    // The admin user editor sends `password` in plain text; createUser hashes it. `passwordHash` is still accepted for existing callers.
    const result = await createUser({ fullName, email, phone, passwordHash: password || passwordHash, roles, isActive });
    if (result.error) {
      return res.status(result.error === 'Email already exists.' ? 409 : 400).json({ success: false, message: result.error });
    }
    res.json({ success: true, message: 'User created successfully.', user: result.user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// Update user info (admin only)
export async function updateUserController(req, res) {
  const { userId } = req.params;
  const { fullName, phone, roles, isActive } = req.body;
  const adminId = req.user?.id || null;
  const ipAddress = req.ip || 'unknown';
  try {
    if (roles !== undefined) {
      const roleResult = await updateUserRole({ userId, newRoles: roles, adminId, ipAddress });
      if (roleResult.error) return res.status(roleResult.status || 500).json({ success: false, message: roleResult.error });
    }
    if (typeof isActive === 'boolean') {
      const statusResult = await toggleUserSuspension({ userId, suspend: !isActive, adminId, reason: 'Changed in user editor', ipAddress });
      if (statusResult.error) return res.status(statusResult.status || 500).json({ success: false, message: statusResult.error });
    }
    const result = await updateUser({ userId, fullName, phone });
    if (result.error) {
      return res.status(404).json({ success: false, message: result.error });
    }
    res.json({ success: true, message: 'User updated successfully.', user: result.user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// Deactivate user (soft delete)
export async function deactivateUserController(req, res) {
  const { userId } = req.params;
  try {
    const result = await deactivateUser({ userId });
    if (result.error) {
      return res.status(404).json({ success: false, message: result.error });
    }
    res.json({ success: true, message: 'User deactivated successfully.', user: result.user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}
import { getSavedPackagesForUser, savePackageForUser, unsavePackageForUser } from '../service/user.service.js';

export async function getSavedPackagesController(req, res) {
  const { userId } = req.params;
  try {
    const result = await getSavedPackagesForUser({ userId });
    if (result.error) return res.status(404).json({ success: false, message: result.error });
    res.json({ success: true, packages: result.packages });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

export async function savePackageController(req, res) {
  const { userId, packageId } = req.params;
  try {
    const result = await savePackageForUser({ userId, packageId });
    if (result.error) return res.status(404).json({ success: false, message: result.error });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

export async function unsavePackageController(req, res) {
  const { userId, packageId } = req.params;
  try {
    const result = await unsavePackageForUser({ userId, packageId });
    if (result.error) return res.status(404).json({ success: false, message: result.error });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

import { getUserById, updateProfile, changePassword } from '../service/user.service.js';

export async function getUserController(req, res) {
  const { userId } = req.params;
  try {
    const result = await getUserById({ userId });
    if (result.error) return res.status(404).json({ success: false, message: result.error });
    res.json({ success: true, user: result.user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

export async function updateProfileController(req, res) {
  const { userId } = req.params;
  const { fullName, phone, age } = req.body;
  try {
    const result = await updateProfile({ userId, fullName, phone, age });
    if (result.error) return res.status(404).json({ success: false, message: result.error });
    res.json({ success: true, message: 'Profile updated successfully.', user: result.user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

export async function changePasswordController(req, res) {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;
  try {
    const result = await changePassword({ userId, currentPassword, newPassword });
    if (result.error) {
      const status = result.error === 'Current password is incorrect.' ? 401 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}
import { User } from '../model/user.model.js';
// Get all users (for testing/demo only)
export async function getAllUsersController(req, res) {
  try {
    const users = await User.find({}, '-passwordHash'); // Exclude passwordHash field
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}
// user.controller.js
import { registerUser, loginUser, awardSignupBonusToExistingUsers } from '../service/user.service.js';
import { ROLES } from '../model/user.model.js';

export async function signupController(req, res) {
  const { fullName, email, phone, passwordHash, roles } = req.body;
  try {
    const result = await registerUser({ fullName, email, phone, passwordHash, roles });
    if (result.error) {
      return res.status(result.error === 'Email already exists.' ? 409 : 400).json({ success: false, message: result.error });
    }
    res.json({ success: true, message: 'User registered successfully.', user: result.user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

export async function loginController(req, res) {
  const { email, passwordHash } = req.body;
  try {
    const result = await loginUser({ email, passwordHash });
    if (result.error) {
      return res.status(result.error === 'Invalid email or password.' ? 401 : 400).json({ success: false, message: result.error });
    }
    res.json({ success: true, message: 'Login successful.', token: result.token, user: result.user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// Signed tokens identify the account; the current database record grants access.
export async function requireAuth(req, res, next) {
  const match = /^Bearer ([^ ]+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ success: false, message: 'Authentication token required.' });
  if (!process.env.JWT_SECRET) return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
  let decoded;
  try { decoded = jwt.verify(match[1], process.env.JWT_SECRET); }
  catch { return res.status(401).json({ success: false, message: 'Invalid or expired token.' }); }
  if (!mongoose.isValidObjectId(decoded.id)) return res.status(401).json({ success: false, message: 'Invalid account.' });
  try {
    const account = await User.findById(decoded.id).select('_id email roles isActive');
    if (!account || !account.isActive) return res.status(401).json({ success: false, message: 'Account is inactive or unavailable.' });
    req.user = { id: String(account._id), email: account.email, roles: account.roles };
    return next();
  } catch { return res.status(503).json({ success: false, message: 'Unable to verify account. Please retry.' }); }
}
export function requireRole(...allowedRoles) {
  const normalize = role => String(role).toLowerCase().replace(/^operator$/, 'tour_operator');
  return (req, res, next) => requireAuth(req, res, () => {
    if (!allowedRoles.some(role => req.user.roles.map(normalize).includes(normalize(role)))) return res.status(403).json({ success: false, message: 'Forbidden: insufficient role.' });
    return next();
  });
}
export function optionalAuth(req, res, next) {
  return req.headers.authorization ? requireAuth(req, res, next) : next();
}
export function requireSelfOrAdmin(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.userId || req.params.customerId)) return res.status(400).json({ success: false, message: 'Invalid user ID.' });
  if ((req.params.userId || req.params.customerId) !== req.user.id && !req.user.roles.some(role => role.toLowerCase() === 'admin')) return res.status(403).json({ success: false, message: 'Forbidden: account access denied.' });
  return next();
}
export function requireSelf(req, res, next) {
  if (req.params.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Change your own password only.' });
  return next();
}

// Award signup bonus to existing users
export async function awardSignupBonusController(req, res) {
  try {
    const result = await awardSignupBonusToExistingUsers();
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }
    res.json({ 
      success: true, 
      message: `Awarded signup bonus to ${result.count} existing users`, 
      users: result.users 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}
