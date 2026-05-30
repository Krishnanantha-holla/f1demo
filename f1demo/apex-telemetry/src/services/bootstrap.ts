/**
 * Bootstrap orchestrator — composes the OpenF1, Jolpica, news, and circuit
 * adapters into a single payload the React shell can hydrate from in one
 * `useEffect`.
 */

import { Driver, IntelMessage, SessionInfo } from '../types';
import {
  fetchLiveSnapshot,
  fetchPitStops,
  fetchRaceControl,
  fetchTeamRadio,
  type LiveSnapshot,
  type OpenF1PitStopRow,
  type OpenF1RaceControlMessage,
  type OpenF1Session,
  type OpenF1TeamRadioRow,
  type OpenF1Weather,
} from './openf1';
import {
  fetchConstructorStandings,
  fetchDriverStandings,
  fetchLastRace,
  fetchNextRace,
  fetchSeasonAggregates,
  type ConstructorStandings,
  type DriverStandings,
  type JolpicaStandingRow,
  type LastRaceInfo,
  type NextRaceInfo,
  type SeasonAggregate,
} from './jolpica';
import { fetchCircuitGeometry, type CircuitGeometry } from './circuits';
import { fetchNews, type NewsArticle } from './news';

export interface BootstrapData {
  snapshot: LiveSnapshot | null;
  driverStandings: DriverStandings | null;
  constructorStandings: ConstructorStandings | null;
  seasonAggregates: SeasonAggregate | null;
  nextRace: NextRaceInfo | null;
  lastRace: LastRaceInfo | null;
  news: NewsArticle[];
  raceControl: OpenF1RaceControlMessage[];
  teamRadio: OpenF1TeamRadioRow[];
  pitStops: OpenF1PitStopRow[];
  circuit: CircuitGeometry | null;
}

export async function fetchBootstrap(signal?: AbortSignal): Promise<BootstrapData> {
  const [snapshot, driverStandings, constructorStandings, nextRace, lastRace, news, seasonAggregates] =
    await Promise.all([
      fetchLiveSnapshot(signal).catch(() => null),
      fetchDriverStandings('current', signal),
      fetchConstructorStandings('current', signal),
      fetchNextRace(signal),
      fetchLastRace(signal),
      fetchNews(signal).catch(() => [] as NewsArticle[]),
      fetchSeasonAggregates('current', signal),
    ]);

  const sessionKey = snapshot?.session?.session_key;
  const [raceControl, teamRadio, pitStops, circuit] = await Promise.all([
    sessionKey ? fetchRaceControl(sessionKey, signal) : Promise.resolve([]),
    sessionKey ? fetchTeamRadio(sessionKey, signal) : Promise.resolve([]),
    sessionKey ? fetchPitStops(sessionKey, signal) : Promise.resolve([]),
    snapshot
      ? fetchCircuitGeometry(snapshot.session.country_name, snapshot.session.location, signal)
      : Promise.resolve(null),
  ]);

  return {
    snapshot,
    driverStandings,
    constructorStandings,
    seasonAggregates,
    nextRace,
    lastRace,
    news,
    raceControl,
    teamRadio,
    pitStops,
    circuit,
  };
}

/**
 * Merge Jolpica championship points onto OpenF1 driver records. Drivers are
 * matched by FIA acronym/code first, then surname.
 */
export function mergeStandingsIntoDrivers(
  drivers: Driver[],
  standings: DriverStandings | null,
): Driver[] {
  if (!standings) return drivers;
  const byCode = new Map<string, JolpicaStandingRow>();
  for (const row of standings.rows) {
    if (row.Driver.code) byCode.set(row.Driver.code.toUpperCase(), row);
    byCode.set(row.Driver.familyName.slice(0, 3).toUpperCase(), row);
  }
  return drivers.map(d => {
    const row = byCode.get(d.code.toUpperCase());
    if (!row) return d;
    return { ...d, points: Number(row.points) || 0 };
  });
}

export function sessionToInfo(
  session: OpenF1Session,
  weather: OpenF1Weather | null,
): SessionInfo {
  const start = new Date(session.date_start).getTime();
  const end = new Date(session.date_end).getTime();
  const remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
  const elapsed = Math.max(0, Math.round((Date.now() - start) / 1000));
  return {
    sessionName: `${session.session_name} · ${session.country_name}`,
    circuitName: session.circuit_short_name,
    country: session.country_name,
    airTemp: weather?.air_temperature ?? 22,
    trackTemp: weather?.track_temperature ?? 30,
    humidity: weather?.humidity ?? 50,
    windSpeed: weather?.wind_speed ?? 5,
    windDirection: weather?.wind_direction !== undefined ? `${weather.wind_direction}°` : '—',
    remainingTime: remaining,
    totalLaps: 0,
    currentLap: Math.floor(elapsed / 90),
    apiLatency: 0,
  };
}

function fmtClock(iso: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function classifyRC(category: string, flag?: string | null): IntelMessage['type'] {
  const c = (category || '').toLowerCase();
  const f = (flag || '').toLowerCase();
  if (f.includes('red') || c === 'sessionstatus' || c === 'safetycar') return 'alert';
  if (f.includes('yellow') || c === 'flag') return 'warning';
  if (c === 'speedtrap') return 'speed';
  return 'info';
}

export function buildIntelFeed(
  raceControl: OpenF1RaceControlMessage[],
  news: NewsArticle[],
  limit = 8,
): IntelMessage[] {
  const rcMessages: IntelMessage[] = raceControl.slice(0, Math.ceil(limit / 2)).map((rc, i) => ({
    id: `rc-${rc.date}-${i}`,
    timestamp: fmtClock(rc.date),
    title: (rc.category || 'RACE CONTROL').toUpperCase(),
    content: rc.message,
    type: classifyRC(rc.category, rc.flag),
  }));

  const newsMessages: IntelMessage[] = news.slice(0, limit).map((n, i) => ({
    id: `news-${n.link}-${i}`,
    timestamp: fmtClock(n.published),
    title: `${n.source.toUpperCase()} · ${n.title}`,
    content: n.summary || 'Tap the source for the full story.',
    type: 'info',
  }));

  return [...rcMessages, ...newsMessages].slice(0, limit);
}
