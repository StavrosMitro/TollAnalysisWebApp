import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

const ToastContext = createContext(null);

const ICON = { success: 'check-circle', error: 'alert-circle', info: 'info' };

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, { type = 'info', duration = 4500 } = {}) => {
      const id = ++seq;
      setToasts((list) => [...list, { id, message, type }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      toast: push,
      success: (m, o) => push(m, { ...o, type: 'success' }),
      error: (m, o) => push(m, { ...o, type: 'error' }),
      info: (m, o) => push(m, { ...o, type: 'info' }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="ui-toast-region" role="region" aria-label="Notifications" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`ui-toast ui-toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
              <Icon name={ICON[t.type]} size={18} />
              <div className="ui-toast__body">{t.message}</div>
              <button type="button" className="ui-toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe fallback so a component used outside the provider (e.g. in a test)
    // does not crash.
    return { toast: () => {}, success: () => {}, error: () => {}, info: () => {}, dismiss: () => {} };
  }
  return ctx;
}
