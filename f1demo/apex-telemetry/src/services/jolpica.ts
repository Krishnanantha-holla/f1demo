/**
 * Jolpica / Ergast adapter — https://api.jolpi.ca/ergast/f1
 *
 * Jolpica is the long-running community fork of the original Ergast F1 API.
 * It exposes seasonal championship data: driver and constructor standings,
 * round-by-round race results, and the calendar.
 */

import { fetchJson } from './http';

export const JOLPICA = 'https://api.jolpi.ca/ergast/f1';

export interface JolpicaStandingRow {
  position: string;
  points: string;
  wins: string;
  Driver: {
    driverId: string;
    code: string;
    givenName: string;
    familyName: string;
    permanentNumber?: string;
  };
  Constructors: Array<{ name: string }>;
}

export interface JolpicaConstructorRow {
  position: string;
  points: string;
  wins: string;
  Constructor: { name: string; constructorId: string };
}

export interface JolpicaResultRow {
  position: string;
  Driver: { code: string; givenName: string; familyName: string; driverId: string };
  Constructor: { name: string; constructorId: string };
  Time?: { time: string };
  FastestLap?: {
    rank?: string;
    Time: { time: string };
    AverageSpeed?: { speed: string; units: string };
  };
  status: string;
}

export interface DriverStandings {
  season: string;
  round: string;
  rows: JolpicaStandingRow[];
}

export interface ConstructorStandings {
  season: string;
  round: string;
  rows: JolpicaConstructorRow[];
}

export interface NextRaceInfo {
  name: string;
  circuit: string;
  country: string;
  startsAt: string; // ISO
  schedule: Array<{ session: string; startsAt: string }>;
}

export interface LastRaceInfo {
  season: string;
  round: string;
  name: string;
  circuit: string;
  podium: Array<{ code: string; team: string; gap: string }>;
  fastestLap?: { code: string; time: string; speed?: string };
  results: JolpicaResultRow[];
}

export interface SeasonAggregate {
  /** Total podiums (P1-P3) by driver code across the whole season so far. */
  podiumsByDriver: Record<string, number>;
  /** Total fastest laps by driver code. */
  fastestLapsByDriver: Record<string, number>;
}

export async function fetchDriverStandings(
  season: string | number = 'current',
  signal?: AbortSignal,
): Promise<DriverStandings | null> {
  try {
    const data = await fetchJson<{ MRData: { StandingsTable: { StandingsLists: any[] } } }>(
      `${JOLPICA}/${season}/driverStandings.json`,
      { signal, ttl: 5 * 60_000 },
    );
    const list = data.MRData.StandingsTable.StandingsLists[0];
    if (!list) return null;
    return {
      season: list.season,
      round: list.round,
      rows: list.DriverStandings as JolpicaStandingRow[],
    };
  } catch {
    return null;
  }
}

export async function fetchConstructorStandings(
  season: string | number = 'current',
  signal?: AbortSignal,
): Promise<ConstructorStandings | null> {
  try {
    const data = await fetchJson<{ MRData: { StandingsTable: { StandingsLists: any[] } } }>(
      `${JOLPICA}/${season}/constructorStandings.json`,
      { signal, ttl: 5 * 60_000 },
    );
    const list = data.MRData.StandingsTable.StandingsLists[0];
    if (!list) return null;
    return {
      season: list.season,
      round: list.round,
      rows: list.ConstructorStandings as JolpicaConstructorRow[],
    };
  } catch {
    return null;
  }
}

export async function fetchNextRace(signal?: AbortSignal): Promise<NextRaceInfo | null> {
  try {
    const data = await fetchJson<any>(`${JOLPICA}/current/next.json`, {
      signal,
      ttl: 30 * 60_000,
    });
    const r = data.MRData.RaceTable.Races[0];
    if (!r) return null;
    const startsAt = `${r.date}T${r.time ?? '00:00:00Z'}`;
    const schedule: NextRaceInfo['schedule'] = [];
    for (const key of ['FirstPractice', 'SecondPractice', 'ThirdPractice', 'Qualifying', 'Sprint', 'SprintQualifying']) {
      const v = r[key];
      if (v?.date) {
        schedule.push({ session: key, startsAt: `${v.date}T${v.time ?? '00:00:00Z'}` });
      }
    }
    schedule.push({ session: 'Race', startsAt });
    return {
      name: r.raceName,
      circuit: r.Circuit.circuitName,
      country: r.Circuit.Location.country,
      startsAt,
      schedule,
    };
  } catch {
    return null;
  }
}

export async function fetchLastRace(signal?: AbortSignal): Promise<LastRaceInfo | null> {
  try {
    const data = await fetchJson<any>(`${JOLPICA}/current/last/results.json`, {
      signal,
      ttl: 5 * 60_000,
    });
    const r = data.MRData.RaceTable.Races[0];
    if (!r) return null;
    const results = r.Results as JolpicaResultRow[];
    const fastest = results.find(x => x.FastestLap?.rank === '1') ?? results.find(x => x.FastestLap);
    return {
      season: r.season,
      round: r.round,
      name: r.raceName,
      circuit: r.Circuit.circuitName,
      podium: results.slice(0, 3).map(p => ({
        code: p.Driver.code || p.Driver.familyName.slice(0, 3).toUpperCase(),
        team: p.Constructor.name,
        gap: p.Time?.time ?? p.status,
      })),
      fastestLap: fastest?.FastestLap
        ? {
            code: fastest.Driver.code,
            time: fastest.FastestLap.Time.time,
            speed: fastest.FastestLap.AverageSpeed?.speed,
          }
        : undefined,
      results,
    };
  } catch {
    return null;
  }
}

/**
 * Walk the entire season's results once and aggregate podium counts and
 * fastest-lap counts per driver code. Used to power the standings table's
 * "podiums" column without lying.
 */
export async function fetchSeasonAggregates(
  season: string | number = 'current',
  signal?: AbortSignal,
): Promise<SeasonAggregate | null> {
  try {
    // limit=1000 fits a full season comfortably; Ergast caps at ~1000 by default.
    const data = await fetchJson<any>(`${JOLPICA}/${season}/results.json?limit=1000`, {
      signal,
      ttl: 10 * 60_000,
    });
    const races: any[] = data.MRData.RaceTable.Races;
    const podiumsByDriver: Record<string, number> = {};
    const fastestLapsByDriver: Record<string, number> = {};
    for (const race of races) {
      for (const result of race.Results as JolpicaResultRow[]) {
        const code = result.Driver.code || result.Driver.familyName.slice(0, 3).toUpperCase();
        const pos = Number(result.position);
        if (pos >= 1 && pos <= 3) {
          podiumsByDriver[code] = (podiumsByDriver[code] ?? 0) + 1;
        }
        if (result.FastestLap?.rank === '1') {
          fastestLapsByDriver[code] = (fastestLapsByDriver[code] ?? 0) + 1;
        }
      }
    }
    return { podiumsByDriver, fastestLapsByDriver };
  } catch {
    return null;
  }
}
