import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, getTeamColor, ApiError } from '../api';

function jsonResponse(body = { ok: true }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  global.fetch = vi.fn(async (url) => jsonResponse({ url }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api.getTeamColor', () => {
  it('returns Ferrari red for Ferrari', () => {
    const color = getTeamColor('Ferrari');
    expect(color).toBeTruthy();
    expect(color).toMatch(/^#/);
  });

  it('returns McLaren orange for McLaren', () => {
    const color = getTeamColor('McLaren');
    expect(color).toBeTruthy();
    expect(color).toMatch(/^#/);
  });

  it('returns a fallback color for unknown teams', () => {
    const color = getTeamColor('UnknownTeam2024');
    expect(color).toBeTruthy();
    expect(color).toMatch(/^#/);
  });

  it('handles null gracefully', () => {
    const color = getTeamColor(null);
    expect(color).toBeTruthy();
  });

  it('handles undefined gracefully', () => {
    const color = getTeamColor(undefined);
    expect(color).toBeTruthy();
  });
});

describe('api methods', () => {
  it('calls the major endpoints with the expected paths', async () => {
    await api.health();
    await api.season();
    await api.schedule(2026);
    await api.nextRace();
    await api.driverStandings(2026);
    await api.constructorStandings(2026);
    await api.lastResults();
    await api.raceResults(2026, 3);
    await api.fastf1Laps(2026, 'Austria', 'R');
    await api.fastf1Telemetry(2026, 'Austria', 'R', 'VER');
    await api.sessionMode();
    await api.drivers('latest');
    await api.meetings(2026);
    await api.sessions('latest');
    await api.sessionsForMeeting(12);
    await api.positions('latest');
    await api.laps('latest', 1);
    await api.pits('latest');
    await api.stints('latest');
    await api.weather('latest');
    await api.raceControl('latest');
    await api.carData('latest', 1);
    await api.intervals('latest');
    await api.sessionResult('latest');
    await api.startingGrid('latest');
    await api.overtakes('latest');
    await api.teamRadio('latest', 1);
    await api.circuitMap('Bahrain', 2026);
    await api.live('positions', 'latest');
    await api.freeContext(2026);
    await api.freeRoster(2026);
    await api.tiEvents(2026);
    await api.tiSessions(2026, 'Bahrain Grand Prix');
    await api.tiDrivers(2026, 'Bahrain Grand Prix', 'Race');
    await api.tiLaptimes(2026, 'Bahrain Grand Prix', 'Race', 'VER');
    await api.tiTelemetry(2026, 'Bahrain Grand Prix', 'Race', 'VER', 1);
    await api.tiWeather(2026, 'Bahrain Grand Prix', 'Race');
    await api.compareDrivers(2026, 'Austria', 'R', ['VER', 'NOR']);
    await api.news();
    await api.bios();

    expect(global.fetch).toHaveBeenCalled();
    const urls = global.fetch.mock.calls.map(([url]) => String(url));
    expect(urls).toContain('http://localhost:8000/api/season');
    expect(urls).toContain('http://localhost:8000/api/laps/2026/Austria/R');
    expect(urls).toContain('http://localhost:8000/api/ti/weather/2026/Bahrain%20Grand%20Prix/Race');
  });

  it('wraps non-2xx responses in ApiError', async () => {
    global.fetch = vi.fn(async () => jsonResponse({ detail: 'bad' }, 503));
    await expect(api.health()).rejects.toBeInstanceOf(ApiError);
  });
});
