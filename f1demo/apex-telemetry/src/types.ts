export type AppTab =
  | 'dashboard'
  | 'live-timing'
  | 'track-map'
  | 'telemetry'
  | 'standings'
  | 'analysis'
  | 'intel'
  | 'replay'
  | 'archive';

export interface Driver {
  id: string;
  code: string;
  name: string;
  number: number;
  team: string;
  teamColor: string;
  points: number;
  currentPosition: number;
  lastLapTime: string;
  lastLapMs: number;
  bestLapTime: string;
  bestLapMs: number;
  sector1: number; // in seconds
  sector2: number;
  sector3: number;
  sector1State: 'best' | 'personal-best' | 'normal';
  sector2State: 'best' | 'personal-best' | 'normal';
  sector3State: 'best' | 'personal-best' | 'normal';
  tyre: 'S' | 'M' | 'H' | 'I' | 'W'; // Soft, Medium, Hard, Intermediate, Wet
  tyreAge: number; // in laps
  pitStops: number;
  status: 'active' | 'pitting' | 'retired' | 'out';
  
  // Dynamic Real-time Telemetry state
  speed: number;       // km/h
  rpm: number;         // revolutions per minute (0-15000)
  gear: number;        // 0-8 (0=R/N, 1-8)
  throttle: number;    // percentage 0-100
  brake: number;       // percentage 0-100
  steering: number;    // degrees -180 to 180
  drs: boolean;        // DRS active
  
  // Track position for Track Map
  trackProgress: number; // 0.0 to 1.0 representing percentage around the track
  trackX?: number;       // computed coordinate
  trackY?: number;       // computed coordinate
  
  gapToLeader: string;
  gapToNext: string;
}

export interface SessionInfo {
  sessionName: string;
  circuitName: string;
  country: string;
  airTemp: number;
  trackTemp: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  remainingTime: number; // in seconds
  totalLaps: number;
  currentLap: number;
  apiLatency: number; // in ms
}

export interface TelemetryHistoryPoint {
  time: number; // relative seconds
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
}

export interface IntelMessage {
  id: string;
  timestamp: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'alert' | 'speed';
}
