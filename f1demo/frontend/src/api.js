const API = 'http://localhost:5050/api';

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  // Health
  health:       ()  => get('/health'),

  // Season & Schedule (FastF1-backed)
  season:       ()  => get('/season'),
  schedule:     (year) => get(`/schedule${year ? `?year=${year}` : ''}`),
  nextRace:     ()  => get('/next-race'),

  // Standings (Jolpica/Ergast)
  driverStandings:      (year) => get(`/standings/drivers${year ? `?year=${year}` : ''}`),
  constructorStandings: (year) => get(`/standings/constructors${year ? `?year=${year}` : ''}`),

  // Results (Jolpica/Ergast)
  lastResults:  ()  => get('/results/last'),
  raceResults:  (year, round) => get(`/results/${year}/${round}`),

  // Lap Times & Telemetry (FastF1)
  fastf1Laps:       (year, event, session) => get(`/laps/${year}/${encodeURIComponent(event)}/${session}`),
  fastf1Telemetry:  (year, event, session, driver) => get(`/telemetry/${year}/${encodeURIComponent(event)}/${session}/${driver}`),

  // Session mode (automator state)
  sessionMode:  ()  => get('/session-mode'),

  // OpenF1 proxy endpoints
  drivers:      (key) => get(`/drivers${key ? `?session_key=${key}` : ''}`),
  meetings:     (year) => get(`/meetings${year ? `?year=${year}` : ''}`),
  sessions:     (key)  => get(`/sessions?session_key=${key || 'latest'}`),
  sessionsForMeeting: (mk) => get(`/sessions/meeting/${mk}`),
  positions:    (key)  => get(`/positions?session_key=${key || 'latest'}`),
  laps:         (key, driver) => get(`/laps?session_key=${key || 'latest'}${driver ? `&driver_number=${driver}` : ''}`),
  pits:         (key)  => get(`/pits?session_key=${key || 'latest'}`),
  stints:       (key)  => get(`/stints?session_key=${key || 'latest'}`),
  weather:      (key)  => get(`/weather?session_key=${key || 'latest'}`),
  raceControl:  (key)  => get(`/race_control?session_key=${key || 'latest'}`),
  carData:      (key, driver) => get(`/car_data?session_key=${key || 'latest'}${driver ? `&driver_number=${driver}` : ''}`),
  intervals:    (key)  => get(`/intervals?session_key=${key || 'latest'}`),
  sessionResult:(key)  => get(`/session_result?session_key=${key || 'latest'}`),
  startingGrid: (key)  => get(`/starting_grid?session_key=${key}`),
  overtakes:    (key)  => get(`/overtakes?session_key=${key}`),
  teamRadio:    (key, driver) => get(`/team_radio?session_key=${key || 'latest'}${driver ? `&driver_number=${driver}` : ''}`),
  circuitMap:   (circuitKey, year) => get(`/circuit_map/${circuitKey}${year ? `?year=${year}` : ''}`),

  // OpenF1 live proxy
  live:         (endpoint, sessionKey) => get(`/live/${endpoint}?session_key=${sessionKey || 'latest'}`),

  // TracingInsights data
  tiEvents:     (year) => get(`/ti/events/${year}`),
  tiSessions:   (year, event) => get(`/ti/sessions/${year}/${encodeURIComponent(event)}`),
  tiDrivers:    (year, event, session) => get(`/ti/drivers/${year}/${encodeURIComponent(event)}/${encodeURIComponent(session)}`),
  tiLaptimes:   (year, event, session, driver) => get(`/ti/laptimes/${year}/${encodeURIComponent(event)}/${encodeURIComponent(session)}/${driver}`),
  tiTelemetry:  (year, event, session, driver, lap) => get(`/ti/telemetry/${year}/${encodeURIComponent(event)}/${encodeURIComponent(session)}/${driver}/${lap}`),
  tiWeather:    (year, event, session) => get(`/ti/weather/${year}/${encodeURIComponent(event)}/${encodeURIComponent(session)}`),

  // Encyclopedia & News
  news:         () => get('/news'),
  bios:         () => get('/bios'),
};

// Team color config — add new teams here ONLY
export const TEAM_COLORS = {
  'Mercedes': '#00D2BE',
  'Ferrari': '#DC0000',
  'McLaren': '#FF8000',
  'Red Bull Racing': '#3671C6',
  'Aston Martin': '#358C75',
  'Alpine': '#FF87BC',
  'Williams': '#64C4FF',
  'Racing Bulls': '#6692FF',
  'RB': '#6692FF',
  'Haas F1 Team': '#B6BABD',
  'Haas': '#B6BABD',
  'Audi': '#E8002D',
  'Kick Sauber': '#52E252',
  'Cadillac': '#FFFFFF',
};

export function getTeamColor(teamName) {
  if (!teamName) return '#555';
  if (TEAM_COLORS[teamName]) return TEAM_COLORS[teamName];
  const lower = teamName.toLowerCase();
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return color;
  }
  return '#555';
}
