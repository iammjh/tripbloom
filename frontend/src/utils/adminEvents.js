// Fired on window after an administrator changes a record that feeds the notification bell
// (refunds, payments, KYC, date changes, reviews, contact messages). The bell refreshes at once instead of waiting for its next poll.
export const ADMIN_DATA_CHANGED = 'tripbloom:admin-data-changed';

export function notifyAdminDataChanged() {
  window.dispatchEvent(new Event(ADMIN_DATA_CHANGED));
}
