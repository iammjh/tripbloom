import React from 'react';

// Page toolbar: a short description on the left and the page actions on the right.
// The page title is already shown in the admin top bar.
export function AdminPageHeader({ description, actions, className = '' }) {
  if (!description && !actions) return null;
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      {description ? <p className="max-w-2xl text-sm text-text-muted">{description}</p> : <span />}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// Glass panel used for every admin section.
export function AdminPanel({ children, className = '' }) {
  return <section className={`glass rounded-2xl p-5 ${className}`}>{children}</section>;
}

// Scrollable table in a glass shell. Pass <thead> and <tbody> as children.
export function AdminTable({ children, minWidth = 760, label }) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }} aria-label={label}>{children}</table>
      </div>
    </div>
  );
}

export const thClass = 'border-b border-border bg-surface-muted/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap';
export const tdClass = 'border-b border-border px-4 py-3 align-middle text-text last:border-0';
