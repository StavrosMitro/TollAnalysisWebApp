import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { Button } from './primitives';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: labelled, ESC + backdrop close, focus trapped inside and
 * restored to the trigger on close.
 */
export default function Modal({ open, onClose, title, children, footer, confirm }) {
  const ref = useRef(null);
  const prevFocus = useRef(null);

  const handleKey = useCallback(
    (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const nodes = [...ref.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;
    prevFocus.current = document.activeElement;
    const t = setTimeout(() => {
      const node = ref.current && ref.current.querySelector(FOCUSABLE);
      (node || ref.current)?.focus();
    }, 0);
    document.addEventListener('keydown', handleKey, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handleKey, true);
      document.body.style.overflow = overflow;
      if (prevFocus.current && prevFocus.current.focus) prevFocus.current.focus();
    };
  }, [open, handleKey]);

  if (!open) return null;

  return createPortal(
    <div className="ui-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <header className="ui-modal__header">
          <h2 className="ui-modal__title">{title}</h2>
          <button type="button" className="ui-alert__close" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
        <footer className="ui-modal__footer">
          {footer || (
            <>
              <Button variant="ghost" onClick={onClose}>{confirm ? 'Cancel' : 'Close'}</Button>
              {confirm && (
                <Button variant={confirm.danger ? 'danger' : 'primary'} onClick={confirm.onConfirm}>
                  {confirm.label || 'Confirm'}
                </Button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}
