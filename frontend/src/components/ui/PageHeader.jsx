import React from 'react';

// Page title block: heading, optional description, and actions aligned to the right on wide screens.
export default function PageHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
