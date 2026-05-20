import { useEffect, useState } from 'react';

export function Loading({ text = 'Loading…' }) {
  return (
    <div className="loading" role="status" aria-live="polite" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <span className="loading-text">{text}</span>
    </div>
  );
}

export function ErrorMsg({ text = 'Something went wrong.' }) {
  return <div className="error-msg" role="alert">{text}</div>;
}

export function EmptyMsg({ text = 'No data available.' }) {
  return <div className="empty-msg">{text}</div>;
}

export function Skeleton({ width = '100%', height = '1rem', radius = '6px', style }) {
  return (
    <span
      className="skeleton-shimmer"
      style={{ width, height, borderRadius: radius, display: 'inline-block', ...style }}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-live="polite">
      <Skeleton height="2rem" width="40%" />
      <Skeleton height="200px" radius="12px" />
      <Skeleton height="1rem" width="80%" />
      <Skeleton height="1rem" width="60%" />
    </div>
  );
}

/**
 * Cross-fade a value when it changes. Drop-in replacement for `<span>{value}</span>`
 * that smoothly animates updates to live numeric data (gaps, lap times, positions).
 */
export function FlipValue({ value, className = '', durationMs = 160 }) {
  const [shown, setShown] = useState(value);
  // Derive phase from props/state instead of storing it — keeps the effect body
  // free of synchronous setState (react-hooks/set-state-in-effect).
  const phase = value === shown ? 'in' : 'out';

  useEffect(() => {
    if (value === shown) return undefined;
    const t = setTimeout(() => setShown(value), durationMs);
    return () => clearTimeout(t);
  }, [value, shown, durationMs]);

  return (
    <span className={`flip-value flip-${phase} ${className}`.trim()}>{shown}</span>
  );
}

// Date helpers re-exported for convenience. Importing them through Shared keeps existing
// page imports stable; sharedUtils is the source of truth.
// eslint-disable-next-line react-refresh/only-export-components
export { formatDate, formatDateFull, pad } from '../utils/sharedUtils';
