const API = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 1;

export class ApiError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseResponseBody(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  return text ? { message: text } : null;
}

async function get(path, { query, retries = DEFAULT_RETRIES, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const url = `${API}${path}${buildQuery(query)}`;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      const body = await parseResponseBody(res);

      if (!res.ok) {
        const message = body?.message || body?.detail || `API error: ${res.status}`;
        const err = new ApiError(message, { status: res.status, url, body });

        // Retry only transient server-side failures.
        if (res.status >= 500 && attempt < retries) {
          await delay(200 * (attempt + 1));
          continue;
        }

        throw err;
      }

      return body;
    } catch (err) {
      lastError = err;
      const isAbort = err?.name === 'AbortError';
      const isNetworkError = err instanceof TypeError;

      if (attempt < retries && (isAbort || isNetworkError)) {
        await delay(200 * (attempt + 1));
        continue;
      }

      if (isAbort) {
        throw new ApiError(`Request timed out after ${timeoutMs}ms`, { url });
      }

      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new ApiError('Unknown API failure', { url });
}

export const api = {
  // Health
  health:       ()  => get('/health'),

  // Season & Schedule (FastF1-backed)
  season:       ()  => get('/season'),
  schedule:     (year) => get('/schedule', { query: { year } }),
  nextRace:     ()  => get('/next-race'),

  // Standings (Jolpica/Ergast)
  driverStandings:      (year) => get('/standings/drivers', { query: { year } }),
  constructorStandings: (year) => get('/standings/constructors', { query: { year } }),

  // Results (Jolpica/Ergast)
  lastResults:  ()  => get('/results/last'),
  raceResults:  (year, round) => get(`/results/${year}/${round}`),

  // Lap Times & Telemetry (FastF1)
  fastf1Laps:       (year, event, session) => get(`/laps/${year}/${encodeURIComponent(event)}/${session}`),
  fastf1Telemetry:  (year, event, session, driver) => get(`/telemetry/${year}/${encodeURIComponent(event)}/${session}/${driver}`),

  // Session mode (automator state)
  sessionMode:  ()  => get('/session-mode'),

  // OpenF1 proxy endpoints
  drivers:      (key) => get('/drivers', { query: { session_key: key } }),
  meetings:     (year) => get('/meetings', { query: { year } }),
  sessions:     (key)  => get('/sessions', { query: { session_key: key || 'latest' } }),
  sessionsForMeeting: (mk) => get(`/sessions/meeting/${mk}`),
  positions:    (key)  => get('/positions', { query: { session_key: key || 'latest' } }),
  laps:         (key, driver) => get('/laps', { query: { session_key: key || 'latest', driver_number: driver } }),
  pits:         (key)  => get('/pits', { query: { session_key: key || 'latest' } }),
  stints:       (key)  => get('/stints', { query: { session_key: key || 'latest' } }),
  weather:      (key)  => get('/weather', { query: { session_key: key || 'latest' } }),
  raceControl:  (key)  => get('/race_control', { query: { session_key: key || 'latest' } }),
  carData:      (key, driver) => get('/car_data', { query: { session_key: key || 'latest', driver_number: driver } }),
  intervals:    (key)  => get('/intervals', { query: { session_key: key || 'latest' } }),
  sessionResult:(key)  => get('/session_result', { query: { session_key: key || 'latest' } }),
  startingGrid: (key)  => get('/starting_grid', { query: { session_key: key } }),
  overtakes:    (key)  => get('/overtakes', { query: { session_key: key } }),
  teamRadio:    (key, driver) => get('/team_radio', { query: { session_key: key || 'latest', driver_number: driver } }),
  circuitMap:   (circuitKey, year) => get(`/circuit_map/${circuitKey}`, { query: { year } }),

  // OpenF1 live proxy
  live:         (endpoint, sessionKey) => get(`/live/${endpoint}`, { query: { session_key: sessionKey || 'latest' } }),

  // Free-mode helpers
  freeContext:  (year) => get('/free/context', { query: { year } }),
  freeRoster:   (year) => get('/free/roster', { query: { year } }),

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
