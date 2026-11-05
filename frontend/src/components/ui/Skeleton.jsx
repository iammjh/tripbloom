import React from 'react';

// Placeholder shown while content loads. Decorative: screen readers get the Spinner or a status message instead.
export default function Skeleton({ className = 'h-4 w-full', lines = 1, gap = 'gap-2' }) {
  return (
    <div aria-hidden="true" className={`flex flex-col ${gap}`}>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className={`animate-pulse rounded-md bg-surface-muted ${className} ${index === lines - 1 && lines > 1 ? 'w-2/3' : ''}`}
        />
      ))}
    </div>
  );
}
