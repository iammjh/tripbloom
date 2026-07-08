import jwt from 'jsonwebtoken';
import { listUsers, createUser, updateUser, deactivateUser } from '../service/user.service.js';
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
  const { fullName, email, phone, passwordHash, roles, isActive } = req.body;
  try {
    const result = await createUser({ fullName, email, phone, passwordHash, roles, isActive });
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
  try {
    const result = await updateUser({ userId, fullName, phone, roles, isActive });
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

// JWT-based role verification middleware
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // If requireAuth has not run yet, extract and verify user token
    if (!req.user) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required: token missing.' });
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        req.user = decoded;
      } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
      }
    }

    const userRoles = req.user.roles || [];
    const rolesLower = userRoles.map(r => r.toLowerCase());

    // Check matches including mapping operator aliases
    const isMatched = allowedRoles.some(role => {
      const targetRole = role.toLowerCase();
      return rolesLower.includes(targetRole) || 
        (targetRole === 'operator' && rolesLower.includes('tour_operator')) || 
        (targetRole === 'tour_operator' && rolesLower.includes('operator'));
    });

    if (isMatched) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient role.' });
  };
}

// Authentication middleware - verifies signed JWT token signature
export function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    req.user = decoded; // Object containing user context: id, email, roles
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
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
