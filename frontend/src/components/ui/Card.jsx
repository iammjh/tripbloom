import React from 'react';

// Surface with optional header (title, description, actions) and footer.
export default function Card({ as: Tag = 'section', title, description, actions, footer, className = '', bodyClassName = 'p-5', children, ...rest }) {
  return (
    <Tag className={`rounded-xl border border-border bg-surface shadow-sm ${className}`} {...rest}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-text">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
      {footer && <footer className="border-t border-border px-5 py-4">{footer}</footer>}
    </Tag>
  );
}
