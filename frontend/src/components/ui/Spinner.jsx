import React from 'react';
import { LoaderIcon } from './icons.js';

// Inline loading indicator. Announced as a status message, with visually hidden text for screen readers.
export default function Spinner({ label = 'Loading', className = '' }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 text-sm text-text-muted ${className}`}>
      <LoaderIcon aria-hidden="true" className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </span>
  );
}
