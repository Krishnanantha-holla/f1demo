/**
 * Telemetry page utilities and constants
 */

export const SESSION_MAP = {
  'Practice 1': 'FP1',
  'Practice 2': 'FP2',
  'Practice 3': 'FP3',
  'Qualifying': 'Q',
  'Race': 'R',
  'Sprint': 'S',
  'Sprint Qualifying': 'SQ',
  'Sprint Shootout': 'SS',
};

export const COMPOUND_COLORS = {
  SOFT: '#e10600',
  MEDIUM: '#f5c623',
  HARD: '#eee',
  INTERMEDIATE: '#45b649',
  WET: '#2d6dd1',
  UNKNOWN: '#888',
};

export function formatTime(s) {
  if (s == null || s === 'None' || typeof s !== 'number') return '—';
  const min = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return min > 0 ? `${min}:${sec.padStart(6, '0')}` : sec;
}

export function pickPreferredSession(sessionList) {
  if (!Array.isArray(sessionList) || sessionList.length === 0) return '';
  const priority = [
    'R',
    'Race',
    'Sprint',
    'Sprint Race',
    'Q',
    'Qualifying',
    'S',
    'Sprint Qualifying',
    'Sprint Shootout',
    'FP3',
    'Practice 3',
    'FP2',
    'Practice 2',
    'FP1',
    'Practice 1',
  ];

  for (const candidate of priority) {
    const match = sessionList.find((sessionName) => sessionName === candidate);
    if (match) return match;
  }

  return sessionList[0];
}

export function getCurrentYear() {
  return new Date().getFullYear();
}
