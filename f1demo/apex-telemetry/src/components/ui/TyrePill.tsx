import type { Driver } from '../../types';

const COMPOUNDS: Record<Driver['tyre'], { dot: string; label: string; ring: string }> = {
  S: { dot: 'bg-red-500', label: 'SOFT', ring: 'border-red-500/40' },
  M: { dot: 'bg-amber-400', label: 'MEDIUM', ring: 'border-amber-400/40' },
  H: { dot: 'bg-white', label: 'HARD', ring: 'border-white/40' },
  I: { dot: 'bg-emerald-400', label: 'INTER', ring: 'border-emerald-400/40' },
  W: { dot: 'bg-sky-400', label: 'WET', ring: 'border-sky-400/40' },
};

interface Props {
  compound: Driver['tyre'];
  age: number;
}

export function TyrePill({ compound, age }: Props) {
  const spec = COMPOUNDS[compound];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 ${spec.ring}`}>
      <span className={`w-2 h-2 rounded-full ${spec.dot}`} />
      <span className="font-mono text-[10px] font-extrabold tracking-wider">{spec.label}</span>
      <span className="font-mono text-[9px] text-white/40">·{age}L</span>
    </span>
  );
}
