export function Loading({ text = 'Loading...' }) {
  return <div className="loading"><div className="spinner" />{text}</div>;
}

export function ErrorMsg({ text = 'Something went wrong.' }) {
  return <div className="error-msg">{text}</div>;
}

export function EmptyMsg({ text = 'No data available.' }) {
  return <div className="empty-msg">{text}</div>;
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateFull(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function pad(n) {
  return String(n).padStart(2, '0');
}
