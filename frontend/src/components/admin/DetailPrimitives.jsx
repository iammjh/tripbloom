import React from 'react';

// Shared parts for admin detail dialogs (reviews, refunds, date changes, KYC), so every detail view has the same layout.

// Label and value tile. Place inside a <dl>.
export function DetailFact({ icon: Icon, label, value, mono = false, className = '' }) {
  return (
    <div className={`glass flex items-start gap-3 rounded-2xl p-4 ${className}`}>
      {Icon && (
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand/10">
          <Icon aria-hidden="true" className="h-4 w-4 text-brand" />
        </span>
      )}
      <div className="min-w-0">
        <dt className="text-xs text-text-muted">{label}</dt>
        <dd className={`mt-0.5 break-words text-sm font-semibold text-text ${mono ? 'font-mono' : ''}`}>{value}</dd>
      </div>
    </div>
  );
}

// Headline figure. Tones are literal class names so Tailwind keeps them.
const AMOUNT_TONE = { text: 'text-text', brand: 'text-brand', success: 'text-success', warning: 'text-warning', danger: 'text-danger', info: 'text-info' };

export function DetailAmount({ label, value, tone = 'text', hint }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${AMOUNT_TONE[tone] || AMOUNT_TONE.text}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

// Titled block inside a detail dialog.
export function DetailSection({ id, title, action, children }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={id} className="font-display text-base font-semibold text-text">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// Quiet text block, used for comments, reasons and notes.
export function DetailText({ children, className = '' }) {
  return <p className={`whitespace-pre-line rounded-xl bg-surface-muted p-4 text-sm leading-relaxed text-text ${className}`}>{children}</p>;
}

export const formatDetailDate = (value, withTime = true) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-US', withTime
    ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
};

export const formatBDT = (amount) => `BDT ${Number(amount || 0).toLocaleString()}`;
