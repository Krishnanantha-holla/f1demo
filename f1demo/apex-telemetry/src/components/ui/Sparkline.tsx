import { useId } from 'react';

interface Props {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
}

/**
 * Minimal SVG sparkline with optional area fill. Works without any chart
 * library and renders even from a single data point.
 */
export function Sparkline({
  values,
  color = '#e10600',
  width = 220,
  height = 48,
  fill = true,
  className = '',
}: Props) {
  const gradId = useId();
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(2)},${(height - ((v - min) / span) * height).toFixed(2)}`)
    .join(' ');
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <polygon points={area} fill={`url(#${gradId})`} />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
