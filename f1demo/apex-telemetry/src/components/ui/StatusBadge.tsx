import type { ReactNode } from 'react';

const TONES = {
  ok: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  warn: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  alert: 'bg-red-500/10 border-red-500/30 text-red-400',
  info: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
  neutral: 'bg-white/5 border-white/10 text-on-surface-variant',
} as const;

export type StatusTone = keyof typeof TONES;

interface Props {
  tone?: StatusTone;
  className?: string;
  children: ReactNode;
}

export function StatusBadge({ tone = 'neutral', className = '', children }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
