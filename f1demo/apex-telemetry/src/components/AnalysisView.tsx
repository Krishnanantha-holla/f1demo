import { useEffect, useMemo, useState } from 'react';
import type { Driver, IntelMessage } from '../types';
import type { LastRaceInfo, SeasonAggregate } from '../services/f1Api';
import { Activity, Cpu, Loader2, RefreshCcw } from 'lucide-react';
import { fetchJson } from '../services/http';
import { JOLPICA } from '../services/jolpica';
import { Sparkline } from './ui/Sparkline';

interface AnalysisViewProps {
  drivers: Driver[];
  intel: IntelMessage[];
  lastRace: LastRaceInfo | null;
  seasonAggregates: SeasonAggregate | null;
}

interface LapRow {
  lap: number;
  /** seconds */
  primary?: number;
  /** seconds */
  comp?: number;
}

interface RawLapEntry {
  Timings: Array<{ driverId: string; lap?: string; time: string }>;
  number: string;
}

function parseLapTime(raw: string): number {
  // "1:24.567" → 84.567
  const [m, s] = raw.split(':');
  if (s === undefined) return Number(m);
  return Number(m) * 60 + Number(s);
}

async function fetchLapsForDriver(
  season: string,
  round: string,
  driverId: string,
): Promise<Array<{ lap: number; time: number }>> {
  const url = `${JOLPICA}/${season}/${round}/drivers/${driverId}/laps.json?limit=200`;
  try {
    const data = await fetchJson<any>(url, { ttl: 10 * 60_000 });
    const races: any[] = data.MRData.RaceTable.Races;
    const laps = (races[0]?.Laps ?? []) as RawLapEntry[];
    return laps
      .map(l => {
        const time = l.Timings[0]?.time;
        return time ? { lap: Number(l.number), time: parseLapTime(time) } : null;
      })
      .filter((x): x is { lap: number; time: number } => x !== null);
  } catch {
    return [];
  }
}

export default function AnalysisView({
  drivers,
  intel,
  lastRace,
  seasonAggregates,
}: AnalysisViewProps) {
  const driverChoices = useMemo(() => {
    if (lastRace?.results?.length) {
      return lastRace.results.map(r => ({
        id: r.Driver.driverId,
        code: r.Driver.code || r.Driver.familyName.slice(0, 3).toUpperCase(),
        name: `${r.Driver.givenName} ${r.Driver.familyName}`,
        team: r.Constructor.name,
      }));
    }
    return drivers.map(d => ({ id: d.id, code: d.code, name: d.name, team: d.team }));
  }, [drivers, lastRace]);

  const [primaryId, setPrimaryId] = useState<string>(driverChoices[0]?.id ?? '');
  const [compId, setCompId] = useState<string>(driverChoices[1]?.id ?? '');
  const [rows, setRows] = useState<LapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset selections when a new race lands.
  useEffect(() => {
    if (driverChoices.length === 0) return;
    setPrimaryId(prev => prev || driverChoices[0].id);
    setCompId(prev => prev || driverChoices[1]?.id || driverChoices[0].id);
  }, [driverChoices]);

  const runAnalysis = async () => {
    if (!lastRace) {
      setError('No race data available yet.');
      return;
    }
    if (!primaryId || !compId || primaryId === compId) {
      setError('Pick two distinct drivers.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([
        fetchLapsForDriver(lastRace.season, lastRace.round, primaryId),
        fetchLapsForDriver(lastRace.season, lastRace.round, compId),
      ]);
      const map = new Map<number, LapRow>();
      for (const lap of a) map.set(lap.lap, { lap: lap.lap, primary: lap.time });
      for (const lap of b) {
        const prev = map.get(lap.lap);
        if (prev) prev.comp = lap.time;
        else map.set(lap.lap, { lap: lap.lap, comp: lap.time });
      }
      const merged = [...map.values()].sort((x, y) => x.lap - y.lap);
      setRows(merged);
      if (merged.length === 0) {
        setError('Jolpica returned no per-lap data for this round.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const finished = rows.filter(r => r.primary !== undefined && r.comp !== undefined);
    if (finished.length === 0) return null;
    const deltas = finished.map(r => (r.primary! - r.comp!));
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const minLap = finished.reduce(
      (best, r) =>
        r.primary! < (best.primary ?? Infinity) || r.comp! < (best.comp ?? Infinity)
          ? { primary: Math.min(r.primary!, best.primary ?? Infinity), comp: Math.min(r.comp!, best.comp ?? Infinity) }
          : best,
      { primary: Infinity, comp: Infinity },
    );
    return { avgDelta, minPrimary: minLap.primary, minComp: minLap.comp, lapsCompared: finished.length };
  }, [rows]);

  const primaryDriver = driverChoices.find(d => d.id === primaryId);
  const compDriver = driverChoices.find(d => d.id === compId);
  const primaryLaps = rows.map(r => r.primary).filter((x): x is number => x !== undefined);
  const compLaps = rows.map(r => r.comp).filter((x): x is number => x !== undefined);

  // Plot computation
  const plot = useMemo(() => {
    if (rows.length === 0) return null;
    const all = rows.flatMap(r => [r.primary, r.comp].filter((x): x is number => x !== undefined));
    if (all.length === 0) return null;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = Math.max(0.001, max - min);
    const lapsCount = rows[rows.length - 1].lap;
    const xFor = (lap: number) => ((lap - 1) / Math.max(1, lapsCount - 1)) * 600;
    const yFor = (t: number) => 220 - ((t - min) / span) * 200;
    return { min, max, lapsCount, xFor, yFor };
  }, [rows]);

  const latestIntel = intel[0];
  const podiumLeaderboard = useMemo(() => {
    if (!seasonAggregates) return [];
    return Object.entries(seasonAggregates.podiumsByDriver)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [seasonAggregates]);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* Header banner */}
      <div className="p-5 bg-f1-red/10 border border-f1-red/30 rounded-lg flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-f1-red text-white rounded">
            <Cpu size={18} />
          </div>
          <div>
            <h2 className="font-sans font-black text-sm text-on-surface uppercase tracking-wide">
              Race-pace lab — last grand prix
            </h2>
            <p className="font-sans text-xs text-on-surface-variant mt-1.5 leading-relaxed">
              Every lap of {lastRace?.name ?? 'the most recent race'} is pulled live from Jolpica.
              Pick two drivers, hit run, and the comparator overlays their lap-by-lap traces with
              the average delta and the per-driver fastest lap.
            </p>
          </div>
        </div>
      </div>

      {latestIntel && (
        <div className="carbon-card rounded-lg px-4 py-3 flex flex-wrap items-center gap-3 border-l-4 border-l-f1-red">
          <span className="font-mono text-[10px] text-f1-red font-bold">{latestIntel.timestamp}</span>
          <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
            LATEST INTEL
          </span>
          <span className="font-sans text-xs text-on-surface font-bold">{latestIntel.title}</span>
          <span className="font-sans text-[11px] text-on-surface-variant flex-1 truncate">
            {latestIntel.content}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Controller */}
        <div className="lg:col-span-4 carbon-card rounded-lg p-5 flex flex-col gap-4">
          <h3 className="font-sans font-black text-sm text-on-surface border-b border-white/5 pb-2 uppercase tracking-wide">
            Lap-time comparator
          </h3>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-on-surface-variant uppercase">Round</label>
            <div className="font-mono text-xs text-on-surface bg-black/40 rounded px-3 py-2 border border-white/10">
              {lastRace ? `${lastRace.season} · R${lastRace.round} · ${lastRace.name}` : 'Awaiting calendar sync'}
            </div>
          </div>

          <DriverSelect
            label="Primary driver"
            value={primaryId}
            onChange={setPrimaryId}
            options={driverChoices}
          />
          <DriverSelect
            label="Comparison driver"
            value={compId}
            onChange={setCompId}
            options={driverChoices}
          />

          <button
            onClick={runAnalysis}
            disabled={loading || !lastRace}
            className="w-full bg-f1-red hover:bg-red-700 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase py-3 rounded tracking-wider mt-2 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Pulling laps...
              </>
            ) : (
              <>
                <RefreshCcw size={12} /> Run lap delta
              </>
            )}
          </button>

          {error && (
            <p className="font-mono text-[11px] text-amber-400 leading-relaxed">{error}</p>
          )}

          {summary && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono">
              <Stat label={`AVG Δ (${primaryDriver?.code ?? 'P'} − ${compDriver?.code ?? 'C'})`}
                value={`${summary.avgDelta >= 0 ? '+' : ''}${summary.avgDelta.toFixed(3)}s`} />
              <Stat label="LAPS COMPARED" value={String(summary.lapsCompared)} />
              <Stat
                label={`${primaryDriver?.code} FL`}
                value={`${summary.minPrimary.toFixed(3)}s`}
              />
              <Stat
                label={`${compDriver?.code} FL`}
                value={`${summary.minComp.toFixed(3)}s`}
              />
            </div>
          )}
        </div>

        {/* Plot */}
        <div className="lg:col-span-8 carbon-card rounded-lg p-5 flex flex-col gap-4 min-h-[360px]">
          <div className="flex items-center justify-between">
            <h3 className="font-sans font-black text-sm text-on-surface uppercase tracking-wide">
              Lap-by-lap trace
            </h3>
            <div className="flex gap-3 text-[10px] font-mono">
              <Legend color="#e10600" label={primaryDriver?.code ?? 'A'} />
              <Legend color="#3671C6" label={compDriver?.code ?? 'B'} dashed />
            </div>
          </div>

          {plot ? (
            <svg viewBox="-30 -10 660 260" className="w-full h-72">
              {/* Grid */}
              {[0, 50, 100, 150, 200].map(y => (
                <line key={y} x1="0" x2="600" y1={y + 10} y2={y + 10} stroke="rgba(255,255,255,0.04)" />
              ))}
              {/* Y axis labels */}
              <text x="-2" y="14" textAnchor="end" className="fill-white/40 font-mono text-[9px]">
                {plot.max.toFixed(2)}s
              </text>
              <text x="-2" y="220" textAnchor="end" className="fill-white/40 font-mono text-[9px]">
                {plot.min.toFixed(2)}s
              </text>
              <text x="0" y="245" className="fill-white/40 font-mono text-[9px]">L1</text>
              <text x="595" y="245" textAnchor="end" className="fill-white/40 font-mono text-[9px]">
                L{plot.lapsCount}
              </text>

              {/* Primary trace */}
              <polyline
                fill="none"
                stroke="#e10600"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={rows
                  .filter(r => r.primary !== undefined)
                  .map(r => `${plot.xFor(r.lap)},${plot.yFor(r.primary!)}`)
                  .join(' ')}
              />
              {/* Comp trace */}
              <polyline
                fill="none"
                stroke="#3671C6"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={rows
                  .filter(r => r.comp !== undefined)
                  .map(r => `${plot.xFor(r.lap)},${plot.yFor(r.comp!)}`)
                  .join(' ')}
              />
            </svg>
          ) : (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-on-surface-variant text-center">
              Pick two drivers and hit "Run lap delta" to pull the most recent race's per-lap times from Jolpica.
            </div>
          )}

          {primaryLaps.length > 0 && compLaps.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <PaceCard
                label={`${primaryDriver?.code ?? 'A'} pace`}
                color="#e10600"
                values={primaryLaps}
              />
              <PaceCard
                label={`${compDriver?.code ?? 'B'} pace`}
                color="#3671C6"
                values={compLaps}
              />
            </div>
          )}
        </div>
      </div>

      {/* Season aggregates */}
      <div className="carbon-card rounded-lg p-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-on-surface-variant" />
            <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
              Season aggregates
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase text-on-surface-variant">
            Source: Jolpica/Ergast
          </span>
        </div>

        {seasonAggregates ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="font-mono text-[11px] uppercase font-bold text-on-surface-variant mb-2">
                Podium leaders
              </h4>
              <ul className="flex flex-col gap-1.5 font-mono text-xs">
                {podiumLeaderboard.map(([code, count], i) => (
                  <li
                    key={code}
                    className="flex justify-between bg-black/30 border border-white/5 px-3 py-1.5 rounded"
                  >
                    <span>
                      <span className="text-on-surface-variant mr-2">{i + 1}</span>
                      <span className="font-bold text-on-surface">{code}</span>
                    </span>
                    <span className="text-f1-red font-bold">{count} P3+</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-mono text-[11px] uppercase font-bold text-on-surface-variant mb-2">
                Fastest-lap awards
              </h4>
              <ul className="flex flex-col gap-1.5 font-mono text-xs">
                {Object.entries(seasonAggregates.fastestLapsByDriver)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([code, count], i) => (
                    <li
                      key={code}
                      className="flex justify-between bg-black/30 border border-white/5 px-3 py-1.5 rounded"
                    >
                      <span>
                        <span className="text-on-surface-variant mr-2">{i + 1}</span>
                        <span className="font-bold text-on-surface">{code}</span>
                      </span>
                      <span className="text-emerald-400 font-bold">{count} FL</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-4 font-mono text-xs text-on-surface-variant italic">
            Season aggregates load when Jolpica returns the season's results.
          </p>
        )}
      </div>
    </div>
  );
}

function DriverSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; code: string; name: string; team: string }>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] text-on-surface-variant uppercase">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-black/45 border border-white/10 rounded px-3 py-2 font-mono text-xs text-white uppercase focus:border-f1-red focus:outline-none"
      >
        {options.map(d => (
          <option key={d.id} value={d.id}>
            {d.code} — {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col bg-black/30 border border-white/5 rounded p-2">
      <span className="text-[9px] text-on-surface-variant uppercase tracking-wider">{label}</span>
      <span className="text-on-surface font-bold">{value}</span>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block w-4 h-1 rounded"
        style={{
          backgroundColor: color,
          backgroundImage: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 8px)`
            : undefined,
        }}
      />
      <span className="font-bold">{label}</span>
    </span>
  );
}

function PaceCard({ label, color, values }: { label: string; color: string; values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    <div className="bg-black/30 border border-white/5 rounded p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase text-on-surface-variant">{label}</span>
        <span className="font-mono text-[10px] text-on-surface">avg {avg.toFixed(3)}s</span>
      </div>
      <Sparkline values={values} color={color} className="mt-2 w-full h-12" />
      <div className="flex justify-between text-[9px] font-mono text-on-surface-variant mt-2">
        <span>fastest {min.toFixed(3)}s</span>
        <span>slowest {max.toFixed(3)}s</span>
      </div>
    </div>
  );
}
