import React from 'react';

// Icon-only control. `label` is required: it becomes the accessible name and the tooltip.
export default function IconButton({ label, icon: Icon, variant = 'ghost', className = '', type = 'button', ...rest }) {
  if (!label) throw new Error('IconButton requires a label for assistive technology');
  const variantClass = variant === 'danger'
    ? 'text-danger hover:bg-danger/10'
    : 'text-text-muted hover:bg-surface-muted hover:text-text';
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
      {...rest}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}
