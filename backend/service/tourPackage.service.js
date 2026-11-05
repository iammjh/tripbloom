// tourPackage.service.js
import { TourPackage, TOUR_PACKAGE_TYPES_ENUM, PERSONAL_CATEGORIES_ENUM } from '../model/tourPackage.model.js';
import { PACKAGE_CODE_PATTERN, deriveCode, uniquePackageCode } from './bookingCode.service.js';
import { GroupDeparture } from '../model/groupDeparture.model.js';
import mongoose from 'mongoose';

const PUBLIC_PACKAGE_FIELDS = 'title description type category basePrice defaultDays defaultNights inclusions destinations extras photos isInternational mapLocation isActive createdAt';

// Helper to escape user input for use in RegExp
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Create new package
export async function createTourPackage({ title, description, type, code, category, basePrice, defaultDays, defaultNights, inclusions, destinations, extras, photos, isInternational, mapLocation, isActive }) {
  if (!title || !type || !basePrice) {
    return { error: 'title, type, and basePrice are required.' };
  }
  if (!TOUR_PACKAGE_TYPES_ENUM.includes(type)) {
    return { error: 'Invalid type.' };
  }
  if (type === 'PERSONAL' && !PERSONAL_CATEGORIES_ENUM.includes(category)) {
    return { error: 'Invalid category for PERSONAL type.' };
  }
  if (type === 'GROUP' && category) {
    return { error: 'Category must be null for GROUP type.' };
  }
  // Validate defaultDays and defaultNights
  if (typeof defaultDays !== 'number' || typeof defaultNights !== 'number') {
    return { error: 'defaultDays and defaultNights are required and must be numbers.' };
  }
  if (photos !== undefined && (!Array.isArray(photos) || photos.some(photo => typeof photo !== 'string'))) {
    return { error: 'photos must be an array of image URLs.' };
  }
  if (isInternational !== undefined && typeof isInternational !== 'boolean') {
    return { error: 'isInternational must be a boolean.' };
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return { error: 'isActive must be a boolean.' };
  }
  if (mapLocation != null && (
    typeof mapLocation !== 'object' ||
    !Number.isFinite(mapLocation.lat) || mapLocation.lat < -90 || mapLocation.lat > 90 ||
    !Number.isFinite(mapLocation.lng) || mapLocation.lng < -180 || mapLocation.lng > 180 ||
    (mapLocation.zoom !== undefined && (!Number.isFinite(mapLocation.zoom) || mapLocation.zoom < 1 || mapLocation.zoom > 20))
  )) {
    return { error: 'mapLocation must contain valid latitude, longitude, and optional zoom (1–20).' };
  }
  // Package code for booking numbers: a supplied code must be free; otherwise the title initials are used, with a suffix if needed.
  const requested = code ? String(code).trim().toUpperCase() : null;
  if (requested && !PACKAGE_CODE_PATTERN.test(requested)) return { error: 'Package code must be 2 to 5 capital letters.' };
  const packageCode = await uniquePackageCode(requested || deriveCode(title), { TourPackage });
  if (!packageCode || (requested && packageCode !== requested)) return { error: 'That package code is already in use.' };
  const pkg = new TourPackage({
    title,
    code: packageCode,
    description,
    type,
    category,
    basePrice,
    defaultDays,
    defaultNights,
    inclusions,
    destinations,
    extras,
    photos,
    isInternational,
    mapLocation,
    isActive
  });
  await pkg.save();
  return { package: pkg };
}

// Update package details
export async function updateTourPackage({ packageId, ...updates }) {
  if (updates.type) {
    if (!TOUR_PACKAGE_TYPES_ENUM.includes(updates.type)) {
      return { error: 'Invalid type.' };
    }
    if (updates.type === 'PERSONAL' && !PERSONAL_CATEGORIES_ENUM.includes(updates.category)) {
      return { error: 'Invalid category for PERSONAL type.' };
    }
    if (updates.type === 'GROUP' && updates.category) {
      return { error: 'Category must be null for GROUP type.' };
    }
  }
  if (updates.code !== undefined) {
    const requested = String(updates.code || '').trim().toUpperCase();
    if (!PACKAGE_CODE_PATTERN.test(requested)) return { error: 'Package code must be 2 to 5 capital letters.' };
    if (await TourPackage.exists({ code: requested, _id: { $ne: packageId } })) return { error: 'That package code is already in use.' };
    updates.code = requested;
  }
  const pkg = await TourPackage.findByIdAndUpdate(packageId, updates, { new: true });
  if (!pkg) return { error: 'Package not found.' };
  return { package: pkg };
}

// Activate/deactivate package
export async function setTourPackageActive({ packageId, isActive, force = false }) {
  const pkg = await TourPackage.findById(packageId);
  if (!pkg) return { error: 'Package not found.' };
  if (!isActive) {
    // Check for future group departures (startDate > now, status !== 'CANCELLED')
    const futureDeparture = await GroupDeparture.findOne({
      packageId: packageId,
      startDate: { $gt: new Date() },
      status: { $ne: 'CANCELLED' }
    });

    if (futureDeparture && !force) {
      return {
        warning: 'Package has future group departures scheduled. Deactivating it may leave bookings in limbo. Use force to proceed anyway.'
      };
    }
  }
  pkg.isActive = isActive;
  await pkg.save();
  return { package: pkg };
}

// Get package by ID
export async function getTourPackage(packageId) {
  return await TourPackage.findById(packageId);
}

// Public reads expose active catalog fields, without internal operator assignments.
export async function getPublicTourPackage(packageId) {
  if (!mongoose.isValidObjectId(packageId)) {
    return { error: 'Invalid package ID.', status: 400 };
  }
  const pkg = await TourPackage.findOne({ _id: packageId, isActive: true }).select(PUBLIC_PACKAGE_FIELDS);
  if (!pkg) return { error: 'Package not found.', status: 404 };
  return { package: pkg };
}

// List all packages
export async function listTourPackages(filter = {}) {
  return await TourPackage.find(filter);
}

// Customer-facing search/filter for packages
export async function searchTourPackages({
  type,
  category,
  destination,
  minPrice,
  maxPrice,
  minDays,
  maxDays,
  search, 
  scope
}) {
  try {
    const filter = { isActive: true }; // Only show active packages to customers

    // Type filter (PERSONAL or GROUP)
    if (type) {
      filter.type = type.toUpperCase();
    }

    // Category filter (for PERSONAL packages)
    if (category) {
      filter.category = category.toUpperCase();
    }

    // Destination search - removed faulty regex on array field
    // The destinations field is an array of objects, not a string
    // So we can't use regex directly on it

    // Price range
    if (minPrice || maxPrice) {
      filter.basePrice = {};
      if (minPrice) filter.basePrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.basePrice.$lte = parseFloat(maxPrice);
    }

    // Duration (days) range
    if (minDays || maxDays) {
      filter.defaultDays = {};
      if (minDays) filter.defaultDays.$gte = parseInt(minDays);
      if (maxDays) filter.defaultDays.$lte = parseInt(maxDays);
    }

    // Text search on title/description/destinations
    if (search) {
      // Determine if the user supplied a detailed place (comma separated)
      const isDetailedPlace = /[,\/\\-]/.test(search) || search.split(/\s+/).length >= 3;

      // Split into candidate terms, remove very short and common words
      const searchTerms = search
        .split(/[,\/\-]/)
        .map(term => term.trim())
        .filter(term => term.length > 2)
        .filter(term => !['district', 'division', 'the', 'and', 'or'].includes(term.toLowerCase()));

      if (searchTerms.length > 0) {
        // If the query looks like a detailed place, use the first segment
        // (usually the place name) as the primary destination term and
        // only match destinations fields against that term. This prevents
        // broad fuzzy matches when the user provided a full address.
        if (isDetailedPlace) {
          const primary = (search.split(/[,\/\-]/)[0] || '').trim();
          if (primary.length > 2) {
            const esc = escapeRegex(primary);
            const re = { $regex: `\\b${esc}\\b`, $options: 'i' };
            filter.$or = [
              { 'destinations.name': re },
              { 'destinations.city': re },
              { 'destinations.country': re }
            ];
          } else {
            // fallback to no matches if primary term too short
            filter.$or = [{ _id: null }];
          }
        } else {
          // General fuzzy search across title, description and destination fields
          const orConditions = searchTerms.flatMap(term => {
            const esc = escapeRegex(term);
            return [
              { title: { $regex: esc, $options: 'i' } },
              { description: { $regex: esc, $options: 'i' } },
              { 'destinations.name': { $regex: esc, $options: 'i' } },
              { 'destinations.city': { $regex: esc, $options: 'i' } },
              { 'destinations.country': { $regex: esc, $options: 'i' } }
            ];
          });
          filter.$or = orConditions;
        }
      }
    }

    // Scope filter: domestic vs international
    // HOME_COUNTRY can be set in the environment; default to 'Bangladesh'
    const homeCountry = (process.env.HOME_COUNTRY || 'Bangladesh').trim();
    if (scope) {
      const s = String(scope).toUpperCase();
      if (s === 'DOMESTIC') {
        // Select packages where ALL destinations are in homeCountry
        // i.e. there is NO destination with country != homeCountry
        filter.destinations = { $not: { $elemMatch: { country: { $ne: homeCountry } } } };
      } else if (s === 'INTERNATIONAL') {
        // Select packages with at least one destination outside homeCountry
        filter.destinations = { $elemMatch: { country: { $ne: homeCountry } } };
      }
    }

    const packages = await TourPackage.find(filter).sort({ createdAt: -1 }).limit(100);
    
    console.log(`[DEBUG] searchTourPackages: Query returned ${packages.length} packages out of total active packages`);

    return { packages };
  } catch (err) {
    console.error('Error searching packages:', err);
    return { error: 'Failed to search packages' };
  }
}

// Delete package
export async function deleteTourPackage(packageId) {
  return await TourPackage.findByIdAndDelete(packageId);
}

// Assign operators to a tour package
export async function assignOperatorsToPackage({ packageId, operatorIds }) {
  const pkg = await TourPackage.findById(packageId);
  if (!pkg) return { error: 'Package not found.' };
  if (!Array.isArray(operatorIds) || operatorIds.length === 0) {
    return { error: 'operatorIds must be a non-empty array.' };
  }
  // Prevent duplicate assignments
  const currentOps = pkg.assignedOperators.map(id => id.toString());
  const newOps = operatorIds.filter(id => !currentOps.includes(id));
  if (newOps.length === 0) {
    return { error: 'All operators are already assigned.' };
  }
  pkg.assignedOperators = [...pkg.assignedOperators, ...newOps];
  await pkg.save();
  return { package: pkg };
}

// List operators assigned to a tour package
export async function listOperatorsForPackage({ packageId }) {
  const pkg = await TourPackage.findById(packageId).populate('assignedOperators');
  if (!pkg) return { error: 'Package not found.' };
  return { operators: pkg.assignedOperators };
}

// Reassign operator for a tour package
export async function reassignOperatorForPackage({ packageId, oldOperatorId, newOperatorId }) {
  const pkg = await TourPackage.findById(packageId);
  if (!pkg) return { error: 'Package not found.' };
  const idx = pkg.assignedOperators.findIndex(id => id.toString() === oldOperatorId);
  if (idx === -1) return { error: 'Old operator not assigned to this package.' };
  // Prevent duplicate assignment
  if (pkg.assignedOperators.some(id => id.toString() === newOperatorId)) {
    return { error: 'New operator already assigned.' };
  }
  pkg.assignedOperators[idx] = newOperatorId;
  await pkg.save();
  return { package: pkg };
}

// Find future packages for operator (for deactivation/reassignment)
export async function findPackagesForOperator({ operatorId }) {
  return await TourPackage.find({
    assignedOperators: operatorId,
    isActive: true
  });
}

// Remove (deactivate) operator from packages
export async function removeOperatorFromPackages({ operatorId }) {
  const packages = await TourPackage.find({
    assignedOperators: operatorId,
    isActive: true
  });
  for (const pkg of packages) {
    pkg.assignedOperators = pkg.assignedOperators.filter(id => id.toString() !== operatorId);
    await pkg.save();
  }
  return { updatedCount: packages.length };
}
