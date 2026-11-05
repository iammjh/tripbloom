import React from 'react';
import { ErrorIcon } from './icons.js';
import Button from './Button.jsx';

// Shown when a request fails. `message` must be a user-safe sentence; never pass raw server or stack text here.
export default function ErrorState({ title = 'We could not load this', message = 'Please try again. If it keeps happening, contact support.', onRetry, className = '' }) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center rounded-xl border border-danger/30 bg-danger/5 px-6 py-8 text-center ${className}`}>
      <ErrorIcon aria-hidden="true" className="mb-3 h-10 w-10 text-danger" />
      <p className="text-base font-semibold text-text">{title}</p>
      <p className="mt-1 max-w-md text-sm text-text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
