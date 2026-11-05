import React, { useEffect, useId, useRef } from 'react';
import ReactDOM from 'react-dom';
import IconButton from './IconButton.jsx';
import { CloseIcon } from './icons.js';
import { FOCUSABLE_SELECTOR, nextFocusIndex } from '../../utils/focusTrap.js';

// Open dialogs, innermost last. Only the innermost dialog handles Escape and Tab; scroll stays locked until the last one closes.
const dialogStack = [];

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

// Accessible dialog: portal, focus trap, Escape to close, focus returns to the trigger, background scroll lock.
// On phones it opens as a bottom sheet. Mark the control that should receive focus on open with data-autofocus.
export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  dismissible = true,
  children,
  className = '',
  // Extra classes for the backdrop wrapper, for example "dark" when the dialog opens from a dark page.
  rootClassName = '',
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const token = {};
    const trigger = document.activeElement;
    dialogStack.push(token);
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const focusables = () => Array.from(dialog ? dialog.querySelectorAll(FOCUSABLE_SELECTOR) : []);
    const initial = (dialog && dialog.querySelector('[data-autofocus]')) || focusables()[0] || dialog;
    if (initial) initial.focus();

    const onKeyDown = event => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        if (onCloseRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        if (dialog) dialog.focus();
        return;
      }
      event.preventDefault();
      const next = nextFocusIndex(items.indexOf(document.activeElement), items.length, event.shiftKey);
      items[next].focus();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = dialogStack.indexOf(token);
      if (index >= 0) dialogStack.splice(index, 1);
      if (dialogStack.length === 0) document.body.style.overflow = '';
      if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) trigger.focus();
    };
  }, [open, dismissible]);

  if (!open || typeof document === 'undefined') return null;

  const handleBackdropClick = event => {
    if (dismissible && event.target === event.currentTarget && onClose) onClose();
  };

  return ReactDOM.createPortal(
    <div className={`fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4 ${rootClassName}`}>
      <div aria-hidden="true" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleBackdropClick} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl glass text-text shadow-2xl focus:outline-none sm:max-h-[90vh] sm:rounded-2xl ${SIZES[size] || SIZES.md} ${className}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            {description && <p id={descriptionId} className="mt-0.5 text-sm text-text-muted">{description}</p>}
          </div>
          {dismissible && <IconButton label="Close dialog" icon={CloseIcon} onClick={() => onClose && onClose()} />}
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
