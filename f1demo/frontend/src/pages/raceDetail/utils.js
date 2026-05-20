export function fmtLap(secs) {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(3).padStart(6, '0');
  return m > 0 ? `${m}:${s}` : s;
}

export function fmtGap(gap) {
  if (!gap && gap !== 0) return '—';
  if (typeof gap === 'string') return gap;
  if (gap === 0) return 'WINNER';
  return `+${gap.toFixed(3)}s`;
}

export function rotatePoint(x, y, angle, cx, cy) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: dx * cos - dy * sin + cx, y: dy * cos + dx * sin + cy };
}