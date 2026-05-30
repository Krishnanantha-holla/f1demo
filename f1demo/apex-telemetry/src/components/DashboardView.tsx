import { useEffect, useMemo, useState } from 'react';
import type { Driver, IntelMessage, SessionInfo } from '../types';
import type {
  NextRaceInfo,
  LastRaceInfo,
  OpenF1PitStopRow,
  NewsArticle,
  OpenF1Weather,
} from '../services/f1Api';
import {
  AlertOctagon,
  Award,
  ChevronRight,
  Cloud,
  ExternalLink,
  Flame,
  Newspaper,
  Timer,
  TrendingUp,
  Wrench,
} from 'lucide-react';

interface DashboardViewProps {
  drivers: Driver[];
  session: SessionInfo;
  intel: IntelMessage[];
  onNavigate: (tab: any) => void;
  selectedDriver: Driver | null;
  setSelectedDriver: (driver: Driver | null) => void;
  nextRace: NextRaceInfo | null;
  lastRace: LastRaceInfo | null;
  pitStops: OpenF1PitStopRow[];
  news: NewsArticle[];
  weather: OpenF1Weather | null;
}

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function diffToCountdown(targetIso: string): CountdownState {
  const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return { days, hours, minutes, seconds };
}

const SESSION_LABELS: Record<string, string> = {
  FirstPractice: 'FP1',
  SecondPractice: 'FP2',
  ThirdPractice: 'FP3',
  Qualifying: 'QUALIFYING',
  Sprint: 'SPRINT',
  SprintQualifying: 'SPRINT QUALY',
  Race: 'RACE',
};

function formatScheduleEntry(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const isToday = d.toDateString() === new Date().toDateString();
  return isToday
    ? `TODAY ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function getIntensityStyle(type: IntelMessage['type']) {
  switch (type) {
    case 'alert':
      return 'text-red-400 border-red-500/20 bg-red-950/20';
    case 'warning':
      return 'text-amber-400 border-amber-500/20 bg-amber-950/20';
    case 'speed':
      return 'text-sky-400 border-sky-500/20 bg-sky-950/20';
    default:
      return 'text-emerald-400 border-emerald-500/20 bg-emerald-950/20';
  }
}

export default function DashboardView({
  drivers,
  session,
  intel,
  onNavigate,
  selectedDriver,
  setSelectedDriver,
  nextRace,
  lastRace,
  pitStops,
  news,
  weather,
}: DashboardViewProps) {
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    nextRace ? diffToCountdown(nextRace.startsAt) : { days: 2, hours: 14, minutes: 45, seconds: 12 },
  );

  useEffect(() => {
    if (nextRace) setCountdown(diffToCountdown(nextRace.startsAt));
  }, [nextRace]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdown(prev => {
        if (nextRace) return diffToCountdown(nextRace.startsAt);
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [nextRace]);

  const top5Drivers = useMemo(() => [...drivers].sort((a, b) => b.points - a.points).slice(0, 5), [drivers]);

  const fastestPit = useMemo(() => {
    const sorted = [...pitStops].sort((a, b) => a.pit_duration - b.pit_duration);
    const fastest = sorted[0];
    if (!fastest) return null;
    const drv = drivers.find(d => d.number === fastest.driver_number);
    return { row: fastest, driver: drv };
  }, [pitStops, drivers]);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* Live banner */}
      <div className="bg-f1-red text-white py-2 px-4 rounded-lg flex flex-wrap items-center justify-between shadow-lg live-glow gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          <span className="font-sans font-bold tracking-widest text-xs uppercase">
            LIVE TELEMETRY · {session.sessionName}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-5 text-xs text-red-100 font-mono">
          <span>AIR {session.airTemp.toFixed(1)}°C</span>
          <span>TRACK {session.trackTemp.toFixed(1)}°C</span>
          <span>WIND {session.windSpeed} km/h {session.windDirection}</span>
        </div>
      </div>

      {/* Bento Row 1: Countdown · Weekend Radar · Latest Intel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Countdown */}
        <div className="col-span-1 md:col-span-4 carbon-card rounded-lg p-5 flex flex-col justify-between h-48">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
              Next session start
            </span>
            <Timer size={14} className="text-on-surface-variant opacity-70" />
          </div>
          <div className="flex gap-4 items-end my-auto">
            <CountdownPart label="DAYS" value={countdown.days} highlight />
            <span className="font-mono text-2xl text-on-surface-variant pb-1">:</span>
            <CountdownPart label="HRS" value={countdown.hours} />
            <span className="font-mono text-2xl text-on-surface-variant pb-1">:</span>
            <CountdownPart label="MINS" value={countdown.minutes} />
            <span className="font-mono text-2xl text-on-surface-variant pb-1 opacity-40">:</span>
            <CountdownPart label="SEC" value={countdown.seconds} dim />
          </div>
          <div className="text-right text-[10px] text-on-surface-variant italic font-mono uppercase">
            {nextRace ? `${nextRace.name} · ${nextRace.country}` : 'Awaiting calendar sync'}
          </div>
        </div>

        {/* Weekend Radar — driven by Jolpica session schedule */}
        <div className="col-span-1 md:col-span-4 carbon-card rounded-lg p-5 flex flex-col justify-between h-48">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
              Weekend radar
            </span>
            <span className="font-mono text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase font-bold">
              {nextRace ? 'SCHEDULED' : 'CACHED'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 my-auto">
            {(nextRace?.schedule ?? []).slice(0, 3).map((s, i) => (
              <div
                key={s.session}
                className={`flex justify-between items-center text-xs font-mono ${
                  i === 0 ? 'text-on-surface' : 'text-on-surface-variant opacity-80'
                }`}
              >
                <span className={i === 0 ? 'font-bold text-f1-red uppercase' : 'uppercase'}>
                  {SESSION_LABELS[s.session] ?? s.session.toUpperCase()}
                </span>
                <span>{formatScheduleEntry(s.startsAt)}</span>
              </div>
            ))}
            {(!nextRace?.schedule || nextRace.schedule.length === 0) && (
              <div className="font-mono text-[11px] text-on-surface-variant italic">
                Calendar offline. Showing simulator clock.
              </div>
            )}
          </div>
          <div className="text-[10px] text-on-surface-variant italic font-mono uppercase">
            REMAINING: {(session.remainingTime / 60).toFixed(0)} MIN
          </div>
        </div>

        {/* Latest Intel */}
        <div
          className="col-span-1 md:col-span-4 carbon-card rounded-lg p-5 flex flex-col justify-between h-48 relative group cursor-pointer"
          onClick={() => onNavigate('intel')}
          role="button"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
              Latest intel
            </span>
            <AlertOctagon size={14} className="text-f1-red animate-pulse" />
          </div>
          <div className="my-auto">
            <h3 className="font-sans font-extrabold text-[13px] text-on-surface line-clamp-2 group-hover:text-f1-red transition-colors">
              {intel[0]?.title ?? 'No race control or news yet'}
            </h3>
            <p className="font-sans text-xs text-on-surface-variant mt-1.5 leading-snug line-clamp-2">
              {intel[0]?.content ?? 'The OpenF1 + RSS bridge is warming up.'}
            </p>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-f1-red flex items-center gap-1">
              OPEN ENGINEER FEED <ChevronRight size={10} />
            </span>
            <span className="font-mono text-[10px] text-on-surface-variant/70 italic">
              {intel[0]?.timestamp ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Bento Row 2: Standings + Podium */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="col-span-1 md:col-span-6 carbon-card rounded-lg p-5 flex flex-col justify-between min-h-[320px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-on-surface-variant" />
                <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
                  Championship standings (top 5)
                </span>
              </div>
              <button
                onClick={() => onNavigate('standings')}
                className="font-mono text-[11px] text-f1-red hover:underline uppercase font-bold"
              >
                Full standings
              </button>
            </div>
            <div className="flex flex-col mt-2">
              {top5Drivers.map((driver, index) => (
                <div
                  key={driver.id}
                  className={`flex justify-between items-center py-2.5 px-2 rounded hover:bg-white/5 cursor-pointer transition-all ${
                    selectedDriver?.id === driver.id ? 'bg-white/10 border-l-2 border-f1-red' : 'data-row'
                  }`}
                  onClick={() => setSelectedDriver(driver)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-on-surface-variant w-4">
                      {index + 1}
                    </span>
                    <div className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: driver.teamColor }} />
                    <div className="flex flex-col">
                      <span className="font-mono font-black text-sm tracking-tight text-on-surface">
                        {driver.code}
                        <span className="font-sans font-medium text-xs text-on-surface-variant ml-2 hidden sm:inline">
                          {driver.name}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-white/60">
                      #{driver.number}
                    </span>
                    <span className="font-mono font-bold text-xs text-on-surface">{driver.points} PTS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-on-surface-variant/60 font-mono mt-2">
            * Points come from Jolpica/Ergast standings, updated each round.
          </div>
        </div>

        <div className="col-span-1 md:col-span-6 carbon-card rounded-lg p-5 flex flex-col justify-between min-h-[320px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Award size={14} className="text-on-surface-variant" />
                <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
                  Last race podium ({lastRace?.name ?? '—'})
                </span>
              </div>
              <span className="font-mono text-[10px] text-on-surface-variant uppercase">
                {lastRace ? 'Jolpica/Ergast' : 'Awaiting'}
              </span>
            </div>

            {(() => {
              const fallback = [
                { code: 'P2', team: '—', gap: '—' },
                { code: 'P1', team: '—', gap: '—' },
                { code: 'P3', team: '—', gap: '—' },
              ];
              const podium =
                lastRace?.podium?.length === 3
                  ? [
                      { ...lastRace.podium[1] },
                      { ...lastRace.podium[0] },
                      { ...lastRace.podium[2] },
                    ]
                  : fallback;
              const meta = [
                { position: 2, height: 'h-20', barTone: 'bg-surface-high', accent: 'border-f1-red', textTone: 'text-on-surface-variant', size: 'text-2xl' },
                { position: 1, height: 'h-28', barTone: 'bg-surface-highest', accent: 'border-cyan-400', textTone: 'text-f1-red', size: 'text-3xl' },
                { position: 3, height: 'h-16', barTone: 'bg-surface-high', accent: 'border-orange-500', textTone: 'text-on-surface-variant', size: 'text-xl' },
              ];
              return (
                <div className="flex items-end justify-center gap-3 mt-10 h-36">
                  {podium.map((p, idx) => {
                    const m = meta[idx];
                    return (
                      <div key={`${p.code}-${idx}`} className="flex flex-col items-center w-1/3">
                        {m.position === 1 ? (
                          <div className="flex items-center gap-0.5 text-f1-red mb-1">
                            <Flame size={12} fill="currentColor" />
                            <span className="font-sans font-black text-xs text-on-surface">{p.code}</span>
                          </div>
                        ) : (
                          <span className="font-sans font-black text-xs text-on-surface">{p.code}</span>
                        )}
                        <span
                          className={`text-[9px] font-mono mb-1 ${
                            m.position === 1 ? 'text-f1-red' : 'text-on-surface-variant'
                          }`}
                        >
                          {p.team}
                        </span>
                        <div
                          className={`w-full ${m.barTone} border-t-4 ${m.accent} flex flex-col items-center justify-between py-3 ${m.height} rounded-t-sm`}
                        >
                          <span className={`font-mono font-black ${m.size} ${m.textTone}`}>{m.position}</span>
                          <span className="text-[9px] font-mono text-on-surface-variant">{p.gap}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="flex justify-between items-center text-[10px] text-on-surface-variant bg-white/5 p-2 rounded mt-4">
            <span className="font-mono uppercase">
              Fastest lap: {lastRace?.fastestLap?.code ?? '—'}
            </span>
            <span className="font-mono text-f1-red font-bold">
              {lastRace?.fastestLap?.time ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Bento Row 3: Pit · Weather · Headlines */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div
          className="col-span-1 md:col-span-4 carbon-card rounded-lg p-5 flex flex-col justify-between min-h-[200px] cursor-pointer"
          onClick={() => onNavigate('intel')}
          role="button"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
              Fastest pit stop
            </span>
            <Wrench size={14} className="text-on-surface-variant" />
          </div>
          {fastestPit ? (
            <div className="my-auto">
              <div className="text-[10px] font-mono text-on-surface-variant uppercase">
                {fastestPit.driver?.team ?? '—'}
              </div>
              <div className="font-sans font-black text-xl text-on-surface mt-1">
                {fastestPit.driver?.code ?? `#${fastestPit.row.driver_number}`}
                <span className="text-f1-red ml-3">{fastestPit.row.pit_duration.toFixed(2)}s</span>
              </div>
              <div className="text-[10px] font-mono text-on-surface-variant mt-2 uppercase">
                Lap {fastestPit.row.lap_number} · {pitStops.length} stops total
              </div>
            </div>
          ) : (
            <div className="my-auto text-xs font-mono text-on-surface-variant italic">
              No pit data on this session yet.
            </div>
          )}
          <div className="text-[10px] font-mono text-f1-red flex items-center gap-1">
            OPEN PIT BOARD <ChevronRight size={10} />
          </div>
        </div>

        <div className="col-span-1 md:col-span-4 carbon-card rounded-lg p-5 flex flex-col justify-between min-h-[200px]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
              Track conditions
            </span>
            <Cloud size={14} className="text-on-surface-variant" />
          </div>
          <div className="grid grid-cols-2 gap-3 my-auto text-xs font-mono">
            <ConditionTile label="AIR" value={`${(weather?.air_temperature ?? session.airTemp).toFixed(1)}°C`} />
            <ConditionTile
              label="TRACK"
              value={`${(weather?.track_temperature ?? session.trackTemp).toFixed(1)}°C`}
              highlight
            />
            <ConditionTile label="HUMIDITY" value={`${(weather?.humidity ?? session.humidity).toFixed(0)}%`} />
            <ConditionTile
              label="WIND"
              value={`${(weather?.wind_speed ?? session.windSpeed).toFixed(1)} km/h`}
            />
          </div>
          <div className="text-[10px] font-mono text-on-surface-variant uppercase">
            {weather?.rainfall ? 'Rain detected · INTERS likely' : 'Dry track conditions'}
          </div>
        </div>

        <div
          className="col-span-1 md:col-span-4 carbon-card rounded-lg p-5 flex flex-col justify-between min-h-[200px] cursor-pointer"
          onClick={() => onNavigate('intel')}
          role="button"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
              Paddock headlines
            </span>
            <Newspaper size={14} className="text-on-surface-variant" />
          </div>
          <div className="flex flex-col gap-2 my-auto">
            {news.slice(0, 3).map((n, i) => (
              <a
                key={`${n.link}-${i}`}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="block group"
              >
                <div className="font-mono text-[9px] uppercase text-f1-red font-bold tracking-wider">
                  {n.source}
                </div>
                <div className="font-sans text-xs font-bold text-on-surface line-clamp-2 group-hover:text-f1-red transition-colors">
                  {n.title}
                </div>
              </a>
            ))}
            {news.length === 0 && (
              <div className="text-xs font-mono text-on-surface-variant italic">
                Fetching the latest from Autosport, Motorsport, BBC…
              </div>
            )}
          </div>
          <div className="text-[10px] font-mono text-f1-red flex items-center gap-1">
            ALL HEADLINES <ExternalLink size={10} />
          </div>
        </div>
      </div>

      {/* Engineer intel ribbon */}
      <div className="carbon-card rounded-lg p-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h2 className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
            Engineer intel bulletin index
          </h2>
          <button
            onClick={() => onNavigate('intel')}
            className="font-mono text-[11px] text-f1-red hover:underline uppercase font-bold"
          >
            Open newsroom
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {intel.slice(1, 7).map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 p-3 rounded border border-white/5 ${getIntensityStyle(msg.type)}`}
            >
              <div className="font-mono font-bold text-xs pt-1">{msg.timestamp}</div>
              <div>
                <h3 className="font-mono font-bold text-xs tracking-tight uppercase text-on-surface">
                  {msg.title}
                </h3>
                <p className="font-sans text-[11px] text-on-surface-variant mt-1.5 leading-snug">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CountdownPart({
  label,
  value,
  highlight,
  dim,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  dim?: boolean;
}) {
  const valueClass = highlight
    ? 'font-mono font-black text-3xl md:text-4xl text-f1-red leading-none'
    : dim
      ? 'font-mono text-xl md:text-2xl text-on-surface leading-none opacity-60'
      : 'font-mono font-semibold text-3xl md:text-4xl text-on-surface leading-none';
  return (
    <div className="flex flex-col">
      <span className={valueClass}>{String(value).padStart(2, '0')}</span>
      <span className="font-sans text-[10px] font-bold text-on-surface-variant mt-1">{label}</span>
    </div>
  );
}

function ConditionTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-black/35 p-2 rounded">
      <div className="text-[10px] text-on-surface-variant uppercase">{label}</div>
      <div className={`font-bold text-base ${highlight ? 'text-f1-red' : 'text-on-surface'}`}>
        {value}
      </div>
    </div>
  );
}
