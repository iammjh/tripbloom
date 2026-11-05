import React, { useEffect, useSyncExternalStore } from 'react';
import IconButton from './IconButton.jsx';
import { CloseIcon, ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from './icons.js';
import { notifyStore, dismissNotificationById } from '../../utils/notifyStore.js';
import { AUTO_DISMISS_MS, shouldAutoDismiss } from '../../utils/notifyQueue.js';

const TONE = {
  success: { icon: SuccessIcon, className: 'text-success' },
  error: { icon: ErrorIcon, className: 'text-danger' },
  warning: { icon: WarningIcon, className: 'text-warning' },
  info: { icon: InfoIcon, className: 'text-info' },
};

function NotificationItem({ item }) {
  useEffect(() => {
    if (!shouldAutoDismiss(item)) return undefined;
    const timer = setTimeout(() => dismissNotificationById(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id, item.tone]);

  const meta = TONE[item.tone] || TONE.info;
  const Icon = meta.icon;
  return (
    <div className="pointer-events-auto flex w-full items-start gap-3 rounded-xl glass p-4 shadow-lg">
      <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 flex-shrink-0 ${meta.className}`} />
      <div className="min-w-0 flex-1">
        {item.title && <p className="text-sm font-semibold text-text">{item.title}</p>}
        <p className="break-words text-sm text-text">{item.message}</p>
      </div>
      <IconButton label="Dismiss notification" icon={CloseIcon} onClick={() => dismissNotificationById(item.id)} />
    </div>
  );
}

// Bottom-right stack on wide screens, full width on phones. Errors live in their own assertive region and stay until dismissed.
export default function Notifications() {
  const items = useSyncExternalStore(notifyStore.subscribe, notifyStore.getSnapshot, notifyStore.getSnapshot);
  const errors = items.filter(item => item.tone === 'error');
  const others = items.filter(item => item.tone !== 'error');

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center p-4 sm:items-end">
      <div className="flex w-full max-w-sm flex-col gap-2">
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {others.map(item => <NotificationItem key={item.id} item={item} />)}
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
          {errors.map(item => <NotificationItem key={item.id} item={item} />)}
        </div>
      </div>
    </div>
  );
}
