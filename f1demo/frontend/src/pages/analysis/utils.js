export function getCurrentYear() {
  return new Date().getFullYear();
}

export const SESSION_TYPES = ['R', 'Q', 'FP1', 'FP2', 'FP3', 'SQ', 'SR', 'S'];

export const COMPOUND_COLORS = {
  SOFT: '#e10600',
  MEDIUM: '#f5c623',
  HARD: '#e8e8ee',
  INTERMEDIATE: '#45b649',
  WET: '#2d6dd1',
  UNKNOWN: '#888',
};

export const SESSION_NAME_TO_CODE = {
  Race: 'R',
  Qualifying: 'Q',
  Sprint: 'S',
  'Sprint Qualifying': 'SQ',
  'Sprint Shootout': 'SQ',
  'Practice 1': 'FP1',
  'Practice 2': 'FP2',
  'Practice 3': 'FP3',
};

export function fmtTime(s) {
  if (s == null || typeof s !== 'number') return '—';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return m > 0 ? `${m}:${sec.padStart(6, '0')}` : sec;
}