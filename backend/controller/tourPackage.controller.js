// tourPackage.controller.js
import {
  createTourPackage,
  updateTourPackage,
  setTourPackageActive,
  getTourPackage,
  getPublicTourPackage,
  listTourPackages,
  searchTourPackages,
  deleteTourPackage
} from '../service/tourPackage.service.js';
import {
  assignOperatorsToPackage,
  listOperatorsForPackage,
  reassignOperatorForPackage,
  findPackagesForOperator,
  removeOperatorFromPackages
} from '../service/tourPackage.service.js';

export async function createTourPackageController(req, res) {
  try {
    const result = await createTourPackage(req.body);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, message: 'Package created successfully.', package: result.package });
  } catch (error) {
    res.status(error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500)
      .json({ success: false, message: 'Unable to create the package. Please try again.' });
  }
}

export async function updateTourPackageController(req, res) {
  const { packageId } = req.params;
  const result = await updateTourPackage({ packageId, ...req.body });
  if (result.error) return res.status(404).json({ success: false, message: result.error });
  res.json({ success: true, message: 'Package updated successfully.', package: result.package });
}

export async function setTourPackageActiveController(req, res) {
  const { packageId } = req.params;
  const { isActive, force } = req.body;
  const result = await setTourPackageActive({ packageId, isActive, force });
  if (result.error) return res.status(404).json({ success: false, message: result.error });
  if (result.warning) return res.status(409).json({ success: false, warning: result.warning });
  res.json({ success: true, message: isActive ? 'Package activated successfully.' : 'Package deactivated successfully.', package: result.package });
}

export async function getTourPackageController(req, res) {
  const { packageId } = req.params;
  const pkg = await getTourPackage(packageId);
  if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
  res.json({ success: true, message: 'Package fetched successfully.', package: pkg });
}

export async function getPublicTourPackageController(req, res) {
  try {
    const result = await getPublicTourPackage(req.params.packageId);
    if (result.error) return res.status(result.status).json({ success: false, message: result.error });
    res.json({ success: true, package: result.package });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load tour package.' });
  }
}

export async function listTourPackagesController(req, res) {
  const pkgs = await listTourPackages(req.query);
  res.json({ success: true, message: 'Packages listed successfully.', packages: pkgs });
}

export async function deleteTourPackageController(req, res) {
  const { packageId } = req.params;
  const pkg = await deleteTourPackage(packageId);
  if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
  res.json({ success: true, message: 'Package deleted.' });
}

// Customer-facing search/filter for packages
export async function searchTourPackagesController(req, res) {
  const {
    type,
    category,
    destination,
    minPrice,
    maxPrice,
    minDays,
    maxDays,
    search
  } = req.query;

  const result = await searchTourPackages({
    type,
    category,
    destination,
    minPrice,
    maxPrice,
    minDays,
    maxDays,
    search,
    scope: req.query.scope
  });

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    packages: result.packages,
    count: result.packages.length
  });
}

// Assign operators to a tour package
export async function assignOperatorsToPackageController(req, res) {
  const { packageId } = req.params;
  const { operatorIds } = req.body;
  const result = await assignOperatorsToPackage({ packageId, operatorIds });
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, message: 'Operators assigned successfully.', package: result.package });
}

// List operators assigned to a tour package
export async function listOperatorsForPackageController(req, res) {
  const { packageId } = req.params;
  const result = await listOperatorsForPackage({ packageId });
  if (result.error) return res.status(404).json({ success: false, message: result.error });
  res.json({ success: true, operators: result.operators });
}

// Reassign operator for a tour package
export async function reassignOperatorForPackageController(req, res) {
  const { packageId } = req.params;
  const { oldOperatorId, newOperatorId } = req.body;
  const result = await reassignOperatorForPackage({ packageId, oldOperatorId, newOperatorId });
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, message: 'Operator reassigned successfully.', package: result.package });
}

// Find packages for operator (for deactivation/reassignment)
export async function findPackagesForOperatorController(req, res) {
  const { operatorId } = req.params;
  const result = await findPackagesForOperator({ operatorId });
  res.json({ success: true, packages: result });
}

// Remove operator from packages (deactivation)
export async function removeOperatorFromPackagesController(req, res) {
  const { operatorId } = req.params;
  const result = await removeOperatorFromPackages({ operatorId });
  res.json({ success: true, updatedCount: result.updatedCount });
}
