import { Driver, SessionInfo, IntelMessage } from './types';

export const INITIAL_DRIVERS: Driver[] = [
  {
    id: 'ver',
    code: 'VER',
    name: 'Max Verstappen',
    number: 1,
    team: 'Red Bull Racing',
    teamColor: '#3671C6',
    points: 51,
    currentPosition: 1,
    lastLapTime: '1:33.250',
    lastLapMs: 93250,
    bestLapTime: '1:32.910',
    bestLapMs: 92910,
    sector1: 29.120,
    sector2: 40.230,
    sector3: 23.900,
    sector1State: 'personal-best',
    sector2State: 'best',
    sector3State: 'personal-best',
    tyre: 'S',
    tyreAge: 4,
    pitStops: 1,
    status: 'active',
    speed: 284,
    rpm: 11450,
    gear: 7,
    throttle: 94,
    brake: 0,
    steering: 2,
    drs: true,
    trackProgress: 0.85,
    gapToLeader: 'INTERVAL',
    gapToNext: 'INTERVAL'
  },
  {
    id: 'lec',
    code: 'LEC',
    name: 'Charles Leclerc',
    number: 16,
    team: 'Ferrari',
    teamColor: '#E10600',
    points: 47,
    currentPosition: 2,
    lastLapTime: '1:33.515',
    lastLapMs: 93515,
    bestLapTime: '1:33.120',
    bestLapMs: 93120,
    sector1: 29.080,
    sector2: 40.410,
    sector3: 24.025,
    sector1State: 'best',
    sector2State: 'personal-best',
    sector3State: 'normal',
    tyre: 'M',
    tyreAge: 7,
    pitStops: 1,
    status: 'active',
    speed: 279,
    rpm: 11200,
    gear: 6,
    throttle: 89,
    brake: 0,
    steering: -4,
    drs: true,
    trackProgress: 0.81,
    gapToLeader: '+3.140',
    gapToNext: '+3.140'
  },
  {
    id: 'nor',
    code: 'NOR',
    name: 'Lando Norris',
    number: 4,
    team: 'McLaren',
    teamColor: '#FF8700',
    points: 42,
    currentPosition: 3,
    lastLapTime: '1:33.860',
    lastLapMs: 93860,
    bestLapTime: '1:33.340',
    bestLapMs: 93340,
    sector1: 29.210,
    sector2: 40.520,
    sector3: 24.130,
    sector1State: 'normal',
    sector2State: 'normal',
    sector3State: 'personal-best',
    tyre: 'S',
    tyreAge: 6,
    pitStops: 1,
    status: 'active',
    speed: 265,
    rpm: 10900,
    gear: 6,
    throttle: 65,
    brake: 12,
    steering: 18,
    drs: false,
    trackProgress: 0.76,
    gapToLeader: '+7.450',
    gapToNext: '+4.310'
  },
  {
    id: 'sai',
    code: 'SAI',
    name: 'Carlos Sainz',
    number: 55,
    team: 'Ferrari',
    teamColor: '#FF2800',
    points: 40,
    currentPosition: 4,
    lastLapTime: '1:34.020',
    lastLapMs: 94020,
    bestLapTime: '1:33.400',
    bestLapMs: 93400,
    sector1: 29.350,
    sector2: 40.610,
    sector3: 24.060,
    sector1State: 'normal',
    sector2State: 'personal-best',
    sector3State: 'normal',
    tyre: 'M',
    tyreAge: 8,
    pitStops: 1,
    status: 'active',
    speed: 154,
    rpm: 8800,
    gear: 3,
    throttle: 30,
    brake: 85,
    steering: -62,
    drs: false,
    trackProgress: 0.52,
    gapToLeader: '+11.120',
    gapToNext: '+3.670'
  },
  {
    id: 'pia',
    code: 'PIA',
    name: 'Oscar Piastri',
    number: 81,
    team: 'McLaren',
    teamColor: '#FF8700',
    points: 30,
    currentPosition: 5,
    lastLapTime: '1:34.250',
    lastLapMs: 94250,
    bestLapTime: '1:33.780',
    bestLapMs: 93780,
    sector1: 29.400,
    sector2: 40.850,
    sector3: 24.000,
    sector1State: 'normal',
    sector2State: 'normal',
    sector3State: 'personal-best',
    tyre: 'S',
    tyreAge: 10,
    pitStops: 1,
    status: 'active',
    speed: 310,
    rpm: 12400,
    gear: 8,
    throttle: 100,
    brake: 0,
    steering: 0,
    drs: true,
    trackProgress: 0.45,
    gapToLeader: '+15.980',
    gapToNext: '+4.860'
  },
  {
    id: 'ham',
    code: 'HAM',
    name: 'Lewis Hamilton',
    number: 44,
    team: 'Mercedes-AMG',
    teamColor: '#27F4D2',
    points: 25,
    currentPosition: 6,
    lastLapTime: '1:34.610',
    lastLapMs: 94610,
    bestLapTime: '1:34.020',
    bestLapMs: 94020,
    sector1: 29.620,
    sector2: 40.900,
    sector3: 24.090,
    sector1State: 'normal',
    sector2State: 'normal',
    sector3State: 'normal',
    tyre: 'H',
    tyreAge: 2,
    pitStops: 1,
    status: 'active',
    speed: 296,
    rpm: 11800,
    gear: 7,
    throttle: 100,
    brake: 0,
    steering: -1,
    drs: true,
    trackProgress: 0.38,
    gapToLeader: '+19.340',
    gapToNext: '+3.360'
  },
  {
    id: 'rus',
    code: 'RUS',
    name: 'George Russell',
    number: 63,
    team: 'Mercedes-AMG',
    teamColor: '#27F4D2',
    points: 22,
    currentPosition: 7,
    lastLapTime: '1:34.580',
    lastLapMs: 94580,
    bestLapTime: '1:34.110',
    bestLapMs: 94110,
    sector1: 29.580,
    sector2: 40.950,
    sector3: 24.050,
    sector1State: 'normal',
    sector2State: 'normal',
    sector3State: 'normal',
    tyre: 'M',
    tyreAge: 11,
    pitStops: 1,
    status: 'active',
    speed: 84,
    rpm: 5200,
    gear: 1,
    throttle: 10,
    brake: 0,
    steering: 125,
    drs: false,
    trackProgress: 0.12,
    gapToLeader: '+22.500',
    gapToNext: '+3.160'
  },
  {
    id: 'alo',
    code: 'ALO',
    name: 'Fernando Alonso',
    number: 14,
    team: 'Aston Martin F1',
    teamColor: '#229971',
    points: 18,
    currentPosition: 8,
    lastLapTime: '1:35.120',
    lastLapMs: 95120,
    bestLapTime: '1:34.420',
    bestLapMs: 94420,
    sector1: 29.800,
    sector2: 41.200,
    sector3: 24.120,
    sector1State: 'normal',
    sector2State: 'normal',
    sector3State: 'normal',
    tyre: 'H',
    tyreAge: 14,
    pitStops: 1,
    status: 'active',
    speed: 312,
    rpm: 12500,
    gear: 8,
    throttle: 100,
    brake: 0,
    steering: 0,
    drs: true,
    trackProgress: 0.28,
    gapToLeader: '+27.420',
    gapToNext: '+4.920'
  },
  {
    id: 'alb',
    code: 'ALB',
    name: 'Alexander Albon',
    number: 23,
    team: 'Williams Racing',
    teamColor: '#37BEDD',
    points: 8,
    currentPosition: 9,
    lastLapTime: '1:35.600',
    lastLapMs: 95600,
    bestLapTime: '1:34.690',
    bestLapMs: 94690,
    sector1: 29.900,
    sector2: 41.400,
    sector3: 24.300,
    sector1State: 'normal',
    sector2State: 'normal',
    sector3State: 'normal',
    tyre: 'S',
    tyreAge: 14,
    pitStops: 2,
    status: 'pitting',
    speed: 62,
    rpm: 4800,
    gear: 1,
    throttle: 15,
    brake: 40,
    steering: 12,
    drs: false,
    trackProgress: 0.04,
    gapToLeader: '+45.100',
    gapToNext: '+17.680'
  },
  {
    id: 'gas',
    code: 'GAS',
    name: 'Pierre Gasly',
    number: 10,
    team: 'Alpine F1 Team',
    teamColor: '#FF87CD',
    points: 4,
    currentPosition: 10,
    lastLapTime: '1:36.410',
    lastLapMs: 96410,
    bestLapTime: '1:35.330',
    bestLapMs: 95330,
    sector1: 30.120,
    sector2: 41.800,
    sector3: 24.490,
    sector1State: 'normal',
    sector2State: 'normal',
    sector3State: 'normal',
    tyre: 'M',
    tyreAge: 15,
    pitStops: 1,
    status: 'active',
    speed: 252,
    rpm: 10400,
    gear: 6,
    throttle: 80,
    brake: 0,
    steering: -8,
    drs: false,
    trackProgress: 0.95,
    gapToLeader: '+52.410',
    gapToNext: '+7.310'
  }
];

export const INITIAL_SESSION: SessionInfo = {
  sessionName: 'FP1 - Bahrain Grand Prix',
  circuitName: 'Bahrain International Circuit (Sakhir)',
  country: 'Bahrain',
  airTemp: 24.2,
  trackTemp: 32.8,
  humidity: 48,
  windSpeed: 14,
  windDirection: 'NNE',
  remainingTime: 2315, // remaining seconds
  totalLaps: 57,
  currentLap: 14,
  apiLatency: 12
};

export const REPLAY_SESSIONS = [
  { id: 'bh-fp1', name: 'Bahrain GP - FP1', status: 'Archive', date: 'Mar 5, 2026' },
  { id: 'bh-fp2', name: 'Bahrain GP - FP2', status: 'Archive', date: 'Mar 5, 2026' },
  { id: 'bh-q', name: 'Bahrain GP - Qualifying', status: 'Archive', date: 'Mar 6, 2026' },
  { id: 'bh-r', name: 'Bahrain GP - Race (Full Replay)', status: 'Archive', date: 'Mar 7, 2026' },
  { id: 'sa-fp1', name: 'Saudi GP - FP1', status: 'Live-Ready', date: 'Mar 19, 2026' }
];

export const TEAM_COLOR_MAP: Record<string, string> = {
  'Red Bull Racing': '#3671C6',
  'Ferrari': '#E10600',
  'McLaren': '#FF8700',
  'Mercedes-AMG': '#27F4D2',
  'Aston Martin F1': '#229971',
  'Williams Racing': '#37BEDD',
  'Alpine F1 Team': '#FF87CD',
  'Kick Sauber': '#52E252',
  'Racing Bulls': '#1260F0',
  'Haas F1 Team': '#FFFFFF'
};

export const SAKHIR_VECTOR_POINTS = [
  { x: 120, y: 750, name: 'T1' },
  { x: 125, y: 775, name: 'T2' },
  { x: 145, y: 785, name: 'T3' },
  { x: 260, y: 760 },
  { x: 380, y: 720 },
  { x: 420, y: 680, name: 'T4' },
  { x: 490, y: 560, name: 'T5' },
  { x: 480, y: 535, name: 'T6' },
  { x: 460, y: 510, name: 'T7' },
  { x: 420, y: 480, name: 'T8' },
  { x: 340, y: 460 },
  { x: 280, y: 440, name: 'T9/T10' },
  { x: 280, y: 310 },
  { x: 320, y: 200, name: 'T11' },
  { x: 380, y: 170 },
  { x: 440, y: 150, name: 'T12' },
  { x: 500, y: 160 },
  { x: 560, y: 180, name: 'T13' },
  { x: 620, y: 280 },
  { x: 680, y: 450 },
  { x: 740, y: 580 },
  { x: 780, y: 680, name: 'T14' },
  { x: 750, y: 720 },
  { x: 650, y: 740 },
  { x: 450, y: 745 },
  { x: 260, y: 748 },
  { x: 120, y: 750 }
];

export const INTEL_MESSAGES: IntelMessage[] = [
  {
    id: '1',
    timestamp: '15:24',
    title: 'RED BULL AERO UPGRADE',
    content: 'New aero package spotted on Red Bull RB20 during early morning shakedown. Redesigned sidepod inlets and floor edge elements detected in high-res paddock footage.',
    type: 'info'
  },
  {
    id: '2',
    timestamp: '15:26',
    title: 'TRACK TEMPERATURE WARNING',
    content: 'Track temperature exceeds 32.8°C. Tyre thermal degradation on soft (C3) compound has doubled since start of the session. Expect single lap qualifying preparations to be heavily prioritised.',
    type: 'warning'
  },
  {
    id: '3',
    timestamp: '15:28',
    title: 'ALBON SUSTAINS MINOR FLOOR DAMAGE',
    content: 'Alexander Albon struck a tall orange kerb on Turn 11. Pit telemetry reports a loss of 3 points of downforce. Driver currently pitting for floor inspection.',
    type: 'alert'
  },
  {
    id: '4',
    timestamp: '15:29',
    title: 'SECTOR 1 SPEED TRAP',
    content: 'VER continues to dominate Speed Trap readings: 326.8 km/h at DRS Trap. PIA close behind at 324.2 km/h. Ferrari units show high drag profiles.',
    type: 'speed'
  }
];

/**
 * Format a millisecond lap time as M:SS.mmm
 */
function formatLap(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = (ms % 60000) / 1000;
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

/**
 * Format a positive gap in seconds as "+S.mmm" or "+M:SS.mmm".
 */
function formatGap(seconds: number): string {
  if (seconds < 0.001) return '+0.000';
  if (seconds < 60) return `+${seconds.toFixed(3)}`;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `+${m}:${s.toFixed(3).padStart(6, '0')}`;
}

/**
 * Simulates a single frame of F1 telemetry data update (~500ms tick).
 * Mutates dynamic telemetry, sector splits when crossed, last/best lap,
 * positions, and gaps so the leaderboard feels alive.
 */
export function simulateDriversTelemetry(drivers: Driver[]): Driver[] {
  // First pass: per-driver telemetry + sector/lap rollover.
  const updated = drivers.map(driver => {
    if (driver.status === 'retired') return driver;

    let speed = driver.speed;
    let rpm = driver.rpm;
    let gear = driver.gear;
    let throttle = driver.throttle;
    let brake = driver.brake;
    let steering = driver.steering;
    let drs = driver.drs;
    let status = driver.status;
    let tyreAge = driver.tyreAge;
    let pitStops = driver.pitStops;
    let sector1 = driver.sector1;
    let sector2 = driver.sector2;
    let sector3 = driver.sector3;
    let sector1State = driver.sector1State;
    let sector2State = driver.sector2State;
    let sector3State = driver.sector3State;
    let lastLapMs = driver.lastLapMs;
    let lastLapTime = driver.lastLapTime;
    let bestLapMs = driver.bestLapMs;
    let bestLapTime = driver.bestLapTime;

    // Track progression
    const previousProgress = driver.trackProgress;
    let progress =
      previousProgress +
      (driver.status === 'pitting'
        ? 0.001
        : 0.0035 + (driver.number % 3) * 0.0002);

    // Detect sector boundary crossings (1/3 and 2/3 thresholds).
    const crossedS1 = previousProgress < 1 / 3 && progress >= 1 / 3;
    const crossedS2 = previousProgress < 2 / 3 && progress >= 2 / 3;

    if (crossedS1) {
      sector1 = Math.max(28.5, driver.sector1 + (Math.random() - 0.5) * 0.6);
      sector1State = sector1 < driver.sector1 - 0.1 ? 'personal-best' : 'normal';
    }
    if (crossedS2) {
      sector2 = Math.max(39.5, driver.sector2 + (Math.random() - 0.5) * 0.6);
      sector2State = sector2 < driver.sector2 - 0.1 ? 'personal-best' : 'normal';
    }

    if (progress >= 1.0) {
      progress = progress - 1.0;
      tyreAge += 1;
      sector3 = Math.max(23.0, driver.sector3 + (Math.random() - 0.5) * 0.6);
      sector3State = sector3 < driver.sector3 - 0.1 ? 'personal-best' : 'normal';
      const rolledLapMs = Math.round((sector1 + sector2 + sector3) * 1000);
      lastLapMs = rolledLapMs;
      lastLapTime = formatLap(rolledLapMs);
      if (rolledLapMs < bestLapMs) {
        bestLapMs = rolledLapMs;
        bestLapTime = formatLap(rolledLapMs);
      }

      // Lap complete: occasional pit-in / pit-out toggle.
      if (Math.random() < 0.05 && status !== 'pitting') {
        status = 'pitting';
        pitStops += 1;
      } else if (status === 'pitting') {
        status = 'active';
      }
    }

    if (status === 'pitting') {
      speed = Math.floor(Math.max(60, speed - 15));
      rpm = Math.floor(4500 + Math.random() * 500);
      gear = 1;
      throttle = 15;
      brake = 0;
      steering = 5;
      drs = false;
    } else {
      const isStraight =
        (progress > 0.0 && progress < 0.16) ||
        (progress > 0.28 && progress < 0.45) ||
        (progress > 0.8 && progress < 0.98);

      const isHeavyBraking =
        (progress >= 0.16 && progress <= 0.22) ||
        (progress >= 0.45 && progress <= 0.52) ||
        (progress >= 0.72 && progress <= 0.78);

      if (isStraight) {
        throttle = 100;
        brake = 0;
        steering = Math.sin(progress * 150) * 1.5;
        drs = progress > 0.85 || progress < 0.12 || (progress > 0.3 && progress < 0.42);

        speed = Math.min(328, speed + Math.floor(6 + Math.random() * 3));
        gear =
          speed < 120 ? 3 :
          speed < 170 ? 4 :
          speed < 220 ? 5 :
          speed < 260 ? 6 :
          speed < 290 ? 7 : 8;
        rpm = Math.floor(10000 + (speed % 40) * 100);
      } else if (isHeavyBraking) {
        throttle = 0;
        brake = Math.floor(82 + Math.random() * 12);
        steering = Math.sin(progress * 100) * 45;
        drs = false;

        speed = Math.max(75, speed - Math.floor(25 + Math.random() * 10));
        gear = speed < 90 ? 2 : speed < 130 ? 3 : speed < 170 ? 4 : 5;
        rpm = Math.floor(7500 + (speed % 30) * 150);
      } else {
        throttle = Math.floor(40 + Math.random() * 40);
        brake = Math.random() < 0.1 ? Math.floor(10 + Math.random() * 20) : 0;
        steering = Math.sin(progress * 210) * 75;
        drs = false;

        if (speed > 180) speed = speed - 5;
        else if (speed < 130) speed = speed + 8;

        gear = speed < 110 ? 3 : speed < 155 ? 4 : speed < 200 ? 5 : 6;
        rpm = Math.floor(8500 + (speed % 30) * 120);
      }
    }

    return {
      ...driver,
      trackProgress: Number(progress.toFixed(4)),
      speed,
      rpm,
      gear,
      throttle,
      brake,
      steering: Number(steering.toFixed(1)),
      drs,
      status,
      tyreAge,
      pitStops,
      sector1: Number(sector1.toFixed(3)),
      sector2: Number(sector2.toFixed(3)),
      sector3: Number(sector3.toFixed(3)),
      sector1State,
      sector2State,
      sector3State,
      lastLapMs,
      lastLapTime,
      bestLapMs,
      bestLapTime,
    };
  });

  // Second pass: classification by best lap, then gaps + session-best sectors.
  const ranked = [...updated]
    .filter(d => d.status !== 'retired')
    .sort((a, b) => a.bestLapMs - b.bestLapMs);

  const positions = new Map<string, number>();
  ranked.forEach((d, i) => positions.set(d.id, i + 1));

  const leaderBest = ranked[0]?.bestLapMs ?? 0;
  const sessionBestS1 = Math.min(...ranked.map(d => d.sector1));
  const sessionBestS2 = Math.min(...ranked.map(d => d.sector2));
  const sessionBestS3 = Math.min(...ranked.map(d => d.sector3));

  return updated.map(d => {
    if (d.status === 'retired') return d;
    const pos = positions.get(d.id) ?? d.currentPosition;
    const ahead = ranked[pos - 2];
    const gapToLeaderSec = (d.bestLapMs - leaderBest) / 1000;
    const gapToNextSec = ahead ? (d.bestLapMs - ahead.bestLapMs) / 1000 : 0;

    return {
      ...d,
      currentPosition: pos,
      gapToLeader: pos === 1 ? 'INTERVAL' : formatGap(gapToLeaderSec),
      gapToNext: pos === 1 ? 'INTERVAL' : formatGap(gapToNextSec),
      sector1State:
        d.sector1 <= sessionBestS1 ? 'best' : d.sector1State === 'best' ? 'personal-best' : d.sector1State,
      sector2State:
        d.sector2 <= sessionBestS2 ? 'best' : d.sector2State === 'best' ? 'personal-best' : d.sector2State,
      sector3State:
        d.sector3 <= sessionBestS3 ? 'best' : d.sector3State === 'best' ? 'personal-best' : d.sector3State,
    };
  });
}
