import React from 'react';

// Ids for a control's hint and error text. Pass the result to the control: {...fieldAria(id, { hint, error })}.
export function fieldAria(id, { hint, error } = {}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
  return {
    id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': error ? true : undefined,
  };
}

// Label, control and messages. The control itself is passed as children and must use fieldAria for its attributes.
export default function FormField({ id, label, hint, error, required = false, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

// Shared classes for text inputs, selects and textareas so every form looks the same.
export const inputClass = 'min-h-[44px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger';
