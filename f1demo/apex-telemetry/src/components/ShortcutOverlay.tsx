import { X } from 'lucide-react';
import { SHORTCUT_LIST } from '../hooks/useKeyboardShortcuts';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShortcutOverlay({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="carbon-card max-w-md w-full rounded-lg p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h2 className="font-sans font-black text-base text-f1-red uppercase tracking-tight">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-on-surface-variant hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="mt-4 grid gap-2.5">
          {SHORTCUT_LIST.map(s => (
            <li key={s.key} className="flex items-center justify-between text-xs font-mono">
              <span className="text-on-surface-variant uppercase tracking-wider">
                {s.description}
              </span>
              <kbd className="bg-white/5 border border-white/10 px-2 py-1 rounded font-bold text-on-surface">
                {s.key}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[10px] font-mono text-on-surface-variant/70 leading-relaxed">
          Shortcuts are ignored while you're typing in a form field.
        </p>
      </div>
    </div>
  );
}
