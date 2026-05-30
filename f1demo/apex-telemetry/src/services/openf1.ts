/**
 * OpenF1 adapter — https://api.openf1.org
 *
 * OpenF1 is the source of truth for in-session data: drivers, position,
 * intervals, laps, weather, race-control, team radio, pit stops, and stints
 * (which carry the live tyre compound). Public endpoints are CORS-enabled and
 * unauthenticated, so the browser hits them directly.
 */

import { Driver } from '../types';
import { fetchOpenF1Array } from './http';

export const OPENF1 = 'https://api.openf1.org/v1';

export interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
  circuit_short_name: string;
  country_name: string;
  country_code: string | null;
  location: string;
  year: number;
}

export interface OpenF1Driver {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  first_name: string;
  last_name: string;
  team_name: string;
  team_colour: string; // hex without `#`
  headshot_url: string | null;
  meeting_key: number;
  session_key: number;
}

export interface OpenF1Position {
  driver_number: number;
  position: number;
  date: string;
}

export interface OpenF1Interval {
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
  date: string;
}

export interface OpenF1Weather {
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  rainfall: number;
  date: string;
}

export interface OpenF1Lap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  is_pit_out_lap: boolean;
}

export interface OpenF1Stint {
  driver_number: number;
  compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET' | string;
  lap_start: number;
  lap_end: number;
  tyre_age_at_start: number;
  stint_number: number;
  session_key: number;
}

export interface OpenF1RaceControlMessage {
  date: string;
  category: string;
  message: string;
  flag?: string | null;
  driver_number?: number | null;
  lap_number?: number | null;
  scope?: string | null;
}

export interface OpenF1TeamRadioRow {
  date: string;
  driver_number: number;
  recording_url: string;
  session_key: number;
}

export interface OpenF1PitStopRow {
  driver_number: number;
  lap_number: number;
  pit_duration: number;
  date: string;
  session_key: number;
}

export interface LiveSnapshot {
  session: OpenF1Session;
  drivers: Driver[];
  weather: OpenF1Weather | null;
  weatherSeries: OpenF1Weather[];
  recordedAt: number;
}

const SECTOR_DEFAULT = { s1: 29.5, s2: 40.5, s3: 24.0 };

const COMPOUND_TO_TYRE: Record<string, Driver['tyre']> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
};

function mostRecentByDriver<T extends { driver_number: number; date: string }>(
  rows: T[],
): Map<number, T> {
  const out = new Map<number, T>();
  for (const r of rows) {
    const existing = out.get(r.driver_number);
    if (!existing || existing.date < r.date) out.set(r.driver_number, r);
  }
  return out;
}

function lapMsFromSectors(s1: number, s2: number, s3: number): number {
  return Math.round((s1 + s2 + s3) * 1000);
}

function formatLap(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const minutes = Math.floor(ms / 60000);
  const seconds = (ms % 60000) / 1000;
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

function formatGap(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '+0.000';
  if (typeof value === 'string') return value; // e.g. "+1 LAP"
  if (value < 0.001) return '+0.000';
  if (value < 60) return `+${value.toFixed(3)}`;
  const m = Math.floor(value / 60);
  const s = value - m * 60;
  return `+${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export async function fetchLatestSession(signal?: AbortSignal): Promise<OpenF1Session | null> {
  const rows = await fetchOpenF1Array<OpenF1Session>(
    `${OPENF1}/sessions?session_key=latest`,
    { signal, ttl: 60_000 },
  );
  return rows[0] ?? null;
}

export async function fetchLiveSnapshot(signal?: AbortSignal): Promise<LiveSnapshot | null> {
  const session = await fetchLatestSession(signal);
  if (!session) return null;

  const sk = session.session_key;
  const [openDrivers, positions, intervals, laps, weatherSeries, stints] = await Promise.all([
    fetchOpenF1Array<OpenF1Driver>(`${OPENF1}/drivers?session_key=${sk}`, { signal, ttl: 60_000 }),
    fetchOpenF1Array<OpenF1Position>(`${OPENF1}/position?session_key=${sk}`, { signal, ttl: 5_000 }),
    fetchOpenF1Array<OpenF1Interval>(`${OPENF1}/intervals?session_key=${sk}`, { signal, ttl: 5_000 }),
    fetchOpenF1Array<OpenF1Lap>(`${OPENF1}/laps?session_key=${sk}`, { signal, ttl: 30_000 }),
    fetchOpenF1Array<OpenF1Weather>(`${OPENF1}/weather?session_key=${sk}`, { signal, ttl: 15_000 }),
    fetchOpenF1Array<OpenF1Stint>(`${OPENF1}/stints?session_key=${sk}`, { signal, ttl: 30_000 }),
  ]);

  const weather = weatherSeries[weatherSeries.length - 1] ?? null;

  const latestPos = mostRecentByDriver(positions);
  const latestInt = mostRecentByDriver(intervals);

  // Best lap & most recent sectors per driver.
  const bestLapByDriver = new Map<number, number>();
  const recentLapByDriver = new Map<number, OpenF1Lap>();
  for (const lap of laps) {
    if (lap.lap_duration && lap.lap_duration > 0) {
      const cur = bestLapByDriver.get(lap.driver_number);
      if (!cur || lap.lap_duration < cur) bestLapByDriver.set(lap.driver_number, lap.lap_duration);
    }
    const prior = recentLapByDriver.get(lap.driver_number);
    if (!prior || lap.lap_number > prior.lap_number) {
      recentLapByDriver.set(lap.driver_number, lap);
    }
  }

  // Active stint per driver = last stint sorted by stint_number / lap_end.
  const activeStintByDriver = new Map<number, OpenF1Stint>();
  for (const stint of stints) {
    const prior = activeStintByDriver.get(stint.driver_number);
    if (!prior || stint.stint_number > prior.stint_number) {
      activeStintByDriver.set(stint.driver_number, stint);
    }
  }

  // Pit-stop counts per driver come from the number of stints minus 1 (each
  // stint after the first implies a pit) — simple, deterministic, no extra round trip.
  const stintCountByDriver = new Map<number, number>();
  for (const s of stints) {
    stintCountByDriver.set(s.driver_number, (stintCountByDriver.get(s.driver_number) ?? 0) + 1);
  }

  const drivers: Driver[] = openDrivers.map(d => {
    const num = d.driver_number;
    const pos = latestPos.get(num)?.position ?? 99;
    const interval = latestInt.get(num);
    const lap = recentLapByDriver.get(num);
    const stint = activeStintByDriver.get(num);

    const s1 = lap?.duration_sector_1 ?? SECTOR_DEFAULT.s1;
    const s2 = lap?.duration_sector_2 ?? SECTOR_DEFAULT.s2;
    const s3 = lap?.duration_sector_3 ?? SECTOR_DEFAULT.s3;
    const lastLapMs = lap?.lap_duration
      ? Math.round(lap.lap_duration * 1000)
      : lapMsFromSectors(s1, s2, s3);
    const bestMs = bestLapByDriver.has(num)
      ? Math.round(bestLapByDriver.get(num)! * 1000)
      : lastLapMs;
    const teamColor = d.team_colour ? `#${d.team_colour}` : '#888888';

    const tyre: Driver['tyre'] = stint
      ? COMPOUND_TO_TYRE[stint.compound.toUpperCase()] ?? 'M'
      : 'M';
    const tyreAge = stint
      ? stint.tyre_age_at_start +
        Math.max(0, (lap?.lap_number ?? stint.lap_end) - stint.lap_start)
      : (lap?.lap_number ?? 0);
    const pitStops = Math.max(0, (stintCountByDriver.get(num) ?? 1) - 1);

    return {
      id: d.name_acronym?.toLowerCase() || `n${num}`,
      code: d.name_acronym || `N${num}`,
      name: d.full_name || `${d.first_name} ${d.last_name}`.trim(),
      number: num,
      team: d.team_name || 'Independent',
      teamColor,
      points: 0,
      currentPosition: pos,
      lastLapTime: formatLap(lastLapMs),
      lastLapMs,
      bestLapTime: formatLap(bestMs),
      bestLapMs: bestMs,
      sector1: Number(s1.toFixed(3)),
      sector2: Number(s2.toFixed(3)),
      sector3: Number(s3.toFixed(3)),
      sector1State: 'normal',
      sector2State: 'normal',
      sector3State: 'normal',
      tyre,
      tyreAge,
      pitStops,
      status: lap?.is_pit_out_lap ? 'pitting' : 'active',
      speed: 240,
      rpm: 11_000,
      gear: 6,
      throttle: 80,
      brake: 0,
      steering: 0,
      drs: false,
      trackProgress: ((pos - 1) / Math.max(openDrivers.length, 1)) % 1,
      gapToLeader: pos === 1 ? 'INTERVAL' : formatGap(interval?.gap_to_leader ?? null),
      gapToNext: pos === 1 ? 'INTERVAL' : formatGap(interval?.interval ?? null),
    };
  });

  drivers.sort((a, b) => a.currentPosition - b.currentPosition);

  return { session, drivers, weather, weatherSeries, recordedAt: Date.now() };
}

export async function fetchRaceControl(
  sessionKey: number,
  signal?: AbortSignal,
): Promise<OpenF1RaceControlMessage[]> {
  const rows = await fetchOpenF1Array<OpenF1RaceControlMessage>(
    `${OPENF1}/race_control_messages?session_key=${sessionKey}`,
    { signal, ttl: 10_000 },
  );
  return rows.sort((a, b) => (b.date > a.date ? 1 : -1));
}

export async function fetchTeamRadio(
  sessionKey: number,
  signal?: AbortSignal,
): Promise<OpenF1TeamRadioRow[]> {
  const rows = await fetchOpenF1Array<OpenF1TeamRadioRow>(
    `${OPENF1}/team_radio?session_key=${sessionKey}`,
    { signal, ttl: 30_000 },
  );
  return rows.sort((a, b) => (b.date > a.date ? 1 : -1));
}

export async function fetchPitStops(
  sessionKey: number,
  signal?: AbortSignal,
): Promise<OpenF1PitStopRow[]> {
  const rows = await fetchOpenF1Array<OpenF1PitStopRow>(
    `${OPENF1}/pit?session_key=${sessionKey}`,
    { signal, ttl: 30_000 },
  );
  return rows.filter(r => typeof r.pit_duration === 'number' && r.pit_duration > 0);
}

export async function fetchStints(
  sessionKey: number,
  signal?: AbortSignal,
): Promise<OpenF1Stint[]> {
  return fetchOpenF1Array<OpenF1Stint>(
    `${OPENF1}/stints?session_key=${sessionKey}`,
    { signal, ttl: 30_000 },
  );
}
