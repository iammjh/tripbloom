// List users with filters (role, active/inactive, search by name/email)
export async function listUsers({ role, isActive, search }) {
  const query = {};
  if (role) {
    // Handle all case variations and operator aliases
    const roleVariations = [
      role, 
      role.toLowerCase(), 
      role.toUpperCase()
    ];
    // Add 'operator' variations if role is tour_operator
    if (role.toLowerCase() === 'tour_operator' || role.toLowerCase() === 'operator') {
      roleVariations.push('operator', 'OPERATOR', 'tour_operator', 'TOUR_OPERATOR');
    }
    query.roles = { $in: roleVariations };
  }
  if (typeof isActive === 'boolean') {
    query.isActive = isActive;
  }
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  return await User.find(query, '-passwordHash');
}

// Create a new user (admin only)
export async function createUser({ fullName, email, phone, passwordHash, roles, isActive = true }) {
  if (!fullName || !email || !passwordHash || !roles) {
    return { error: 'fullName, email, passwordHash, and roles are required.' };
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return { error: 'Email already exists.' };
  }
  const hashedPassword = await bcrypt.hash(passwordHash, 10);
  const user = new User({ fullName, email, phone, passwordHash: hashedPassword, roles, isActive });
  await user.save();
  return { user: { fullName, email, phone, roles, isActive } };
}

// Update user info (admin only)
export async function updateUser({ userId, fullName, phone, roles, isActive }) {
  const update = {};
  if (fullName) update.fullName = fullName;
  if (phone) update.phone = phone;
  if (roles) update.roles = roles;
  if (typeof isActive === 'boolean') update.isActive = isActive;
  const user = await User.findByIdAndUpdate(userId, update, { new: true, fields: '-passwordHash' });
  if (!user) return { error: 'User not found.' };
  return { user };
}

// Deactivate user (soft delete)
export async function deactivateUser({ userId }) {
  const user = await User.findByIdAndUpdate(userId, { isActive: false }, { new: true, fields: '-passwordHash' });
  if (!user) return { error: 'User not found.' };
  return { user };
}


// user.service.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, ROLES } from '../model/user.model.js';
import { TourPackage } from '../model/tourPackage.model.js';

// Signup bonus points for new users
const SIGNUP_BONUS_POINTS = 100;

export async function registerUser({ fullName, email, phone, passwordHash, roles }) {
  if (!fullName || !email || !passwordHash || !roles) {
    return { error: 'fullName, email, passwordHash, and roles are required.' };
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return { error: 'Email already exists.' };
  }
  
  const hashedPassword = await bcrypt.hash(passwordHash, 10);

  // Create user with signup bonus points
  const user = new User({ 
    fullName, 
    email, 
    phone, 
    passwordHash: hashedPassword, 
    roles,
    rewardPoints: SIGNUP_BONUS_POINTS,
    pointsHistory: [{
      amount: SIGNUP_BONUS_POINTS,
      type: 'EARNED',
      reason: 'Welcome bonus for new account',
      date: new Date()
    }]
  });
  
  await user.save();
  return { user: { fullName, email, phone, roles, rewardPoints: SIGNUP_BONUS_POINTS } };
}



export async function loginUser({ email, passwordHash }) {
  if (!email || !passwordHash) {
    return { error: 'Email and passwordHash are required.' };
  }
  // Find user with matching email
  const user = await User.findOne({ email });
  if (!user) {
    return { error: 'Invalid email or password.' };
  }
  // Verify password hash
  const isMatch = await bcrypt.compare(passwordHash, user.passwordHash);
  if (!isMatch) {
    return { error: 'Invalid email or password.' };
  }
  // Check if user is active
  if (!user.isActive) {
    return { error: 'Account is inactive.' };
  }
  // Generate JWT token
  const token = jwt.sign(
    { id: user._id, email: user.email, roles: user.roles },
    process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    { expiresIn: '7d' }
  );
  return { 
    token,
    user: { _id: user._id, fullName: user.fullName, email: user.email, roles: user.roles } 
  };
}

// Saved packages management
export async function getSavedPackagesForUser({ userId }) {
  const user = await User.findById(userId).populate('savedPackages');
  if (!user) return { error: 'User not found.' };
  return { packages: user.savedPackages || [] };
}

export async function savePackageForUser({ userId, packageId }) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found.' };
  const pkg = await TourPackage.findById(packageId);
  if (!pkg) return { error: 'Package not found.' };
  const exists = user.savedPackages?.some(id => id.toString() === packageId.toString());
  if (!exists) {
    user.savedPackages = [...(user.savedPackages || []), pkg._id];
    await user.save();
  }
  return { success: true };
}

export async function unsavePackageForUser({ userId, packageId }) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found.' };
  user.savedPackages = (user.savedPackages || []).filter(id => id.toString() !== packageId.toString());
  await user.save();
  return { success: true };
}

// Get user by ID
export async function getUserById({ userId }) {
  const user = await User.findById(userId, '-passwordHash');
  if (!user) return { error: 'User not found.' };
  return { user };
}

// Update own profile (customer/operator)
export async function updateProfile({ userId, fullName, phone, age }) {
  const update = {};
  if (fullName) update.fullName = fullName;
  if (phone !== undefined) update.phone = phone;
  
  console.log('updateProfile - Received age:', age, 'Type:', typeof age);
  
  if (age !== undefined) {
    if (age === null || age === '') {
      update.age = null; // Explicitly clear the age field
    } else {
      const parsedAge = parseInt(age);
      console.log('updateProfile - Parsed age:', parsedAge);
      if (!isNaN(parsedAge) && parsedAge > 0 && parsedAge <= 120) {
        update.age = parsedAge;
      }
    }
  }
  
  console.log('updateProfile - Update object:', update);
  
  const user = await User.findByIdAndUpdate(userId, update, { new: true, select: '-passwordHash' });
  if (!user) return { error: 'User not found.' };
  
  console.log('updateProfile - Saved user age:', user.age);
  
  return { user };
}

// Change password
export async function changePassword({ userId, currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    return { error: 'Current password and new password are required.' };
  }
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found.' };
  
  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return { error: 'Current password is incorrect.' };
  }
  
  // Update password
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  return { success: true };
}

// Award signup bonus to existing users who don't have it
export async function awardSignupBonusToExistingUsers() {
  try {
    // Find ALL customer users
    const customers = await User.find({
      roles: { $in: ['CUSTOMER', 'customer'] }
    });

    console.log(`Found ${customers.length} customer(s)`);
    const updatedUsers = [];
    
    for (const customer of customers) {
      // Check if they already have a welcome bonus in history
      const hasWelcomeBonus = customer.pointsHistory?.some(
        h => h.reason?.includes('Welcome bonus')
      );
      
      console.log(`${customer.fullName}: currentPoints=${customer.rewardPoints || 0}, hasWelcomeBonus=${hasWelcomeBonus}`);
      
      if (!hasWelcomeBonus) {
        customer.rewardPoints = (customer.rewardPoints || 0) + SIGNUP_BONUS_POINTS;
        customer.pointsHistory = customer.pointsHistory || [];
        customer.pointsHistory.push({
          amount: SIGNUP_BONUS_POINTS,
          type: 'EARNED',
          reason: 'Welcome bonus for existing account',
          date: new Date()
        });
        await customer.save();
        updatedUsers.push(customer);
        console.log(`✅ Awarded ${SIGNUP_BONUS_POINTS} points to ${customer.fullName}. New total: ${customer.rewardPoints}`);
      }
    }

    console.log(`Successfully awarded bonus to ${updatedUsers.length} user(s)`);
    return { 
      success: true, 
      count: updatedUsers.length, 
      users: updatedUsers.map(u => ({ 
        id: u._id, 
        name: u.fullName, 
        points: u.rewardPoints 
      })) 
    };
  } catch (err) {
    console.error('Error awarding signup bonus:', err);
    return { error: 'Failed to award signup bonus', details: err.message };
  }
}
