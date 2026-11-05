import React from 'react';
import { LoaderIcon } from './icons.js';

const VARIANTS = {
  primary: 'bg-brand text-on-brand shadow-sm hover:opacity-90',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-muted',
  danger: 'bg-danger text-white shadow-sm hover:opacity-90',
  ghost: 'bg-transparent text-text-muted hover:bg-surface-muted hover:text-text',
};

// md and lg meet the 44 px touch-target minimum; sm is for dense desktop tables only.
const SIZES = {
  sm: 'min-h-[36px] px-3 text-sm gap-1.5',
  md: 'min-h-[44px] px-4 text-sm gap-2',
  lg: 'min-h-[48px] px-6 text-base gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-lg font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
      {...rest}
    >
      {loading ? <LoaderIcon className="animate-spin" aria-hidden="true" /> : Icon ? <Icon aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
