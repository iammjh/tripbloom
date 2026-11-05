import { getSupportContacts, getOperatorKycStatuses } from '../service/communication.service.js';

export async function getSupportContactsController(req, res) {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  try {
    const users = await getSupportContacts();
    res.json({ success: true, users });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load support contacts.' });
  }
}

export async function getOperatorKycStatusesController(req, res) {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const roles = (req.user.roles || []).map(role => String(role).toLowerCase());
  if (!roles.some(role => ['admin', 'tour_operator', 'operator'].includes(role))) {
    return res.status(403).json({ success: false, message: 'Operator access required.' });
  }
  const status = req.query?.status;
  if (status !== undefined && !['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid KYC status.' });
  }
  try {
    const kycs = await getOperatorKycStatuses(req.user.id, status);
    res.json({ success: true, kycs });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load assigned customer verification status.' });
  }
}
