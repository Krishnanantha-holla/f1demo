import { useEffect } from 'react';
import { create } from 'zustand';

const useToastStore = create((set) => ({
  toasts: [],
  push: (t) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        {
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2),
          ...t,
        },
      ],
    })),
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Imperative toast API. Use anywhere:
 *   import { toast } from './components/Toast';
 *   toast.success('Cache cleared');
 */
// eslint-disable-next-line react-refresh/only-export-components
export const toast = {
  info: (msg) => useToastStore.getState().push({ tone: 'info', msg }),
  success: (msg) => useToastStore.getState().push({ tone: 'success', msg }),
  error: (msg) => useToastStore.getState().push({ tone: 'error', msg }),
};

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 4500));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div className="toast-host" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.tone}`}
          role="status"
          aria-live="polite"
        >
          <span>{t.msg}</span>
          <button
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
