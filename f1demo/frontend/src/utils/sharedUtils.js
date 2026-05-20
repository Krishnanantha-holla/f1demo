export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateFull(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function pad(n) {
  const v = Math.trunc(Number(n) || 0);
  return String(v).padStart(2, '0');
}

export function eventName(location) {
  if (!location) return '';
  return location.OfficialEventName || location.EventName || '';
}
