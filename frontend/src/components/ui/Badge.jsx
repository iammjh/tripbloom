import React from 'react';
import { statusTone, statusLabel, toneClasses } from '../../utils/statusTone.js';

// Status pill. Pass `value` (any case) to derive tone and label, or `tone` / `children` to override.
export default function Badge({ value, tone, icon: Icon, children, className = '' }) {
  const resolvedTone = tone || statusTone(value);
  const text = children ?? statusLabel(value);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${toneClasses(resolvedTone)} ${className}`}>
      {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
      {text}
    </span>
  );
}
