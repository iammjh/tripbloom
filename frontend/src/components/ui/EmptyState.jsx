import React from 'react';
import { EmptyIcon } from './icons.js';

// Shown when a list or section has no data. Always explains what will appear and offers a next step when there is one.
export default function EmptyState({ icon: Icon = EmptyIcon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-10 text-center ${className}`}>
      <Icon aria-hidden="true" className="mb-3 h-10 w-10 text-text-muted" />
      <p className="text-base font-semibold text-text">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
