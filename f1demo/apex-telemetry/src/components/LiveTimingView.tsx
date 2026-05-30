import type { Driver } from '../types';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { TyrePill } from './ui/TyrePill';

interface LiveTimingViewProps {
  drivers: Driver[];
  selectedDriver: Driver | null;
  setSelectedDriver: (driver: Driver | null) => void;
  isSimulating: boolean;
  setIsSimulating: (sim: boolean) => void;
  onResetSim: () => void;
}

const sectorClass = (state: Driver['sector1State']) => {
  switch (state) {
    case 'best':
      return 'text-purple-400 font-bold bg-purple-950/20 px-1.5 rounded border border-purple-500/15';
    case 'personal-best':
      return 'text-emerald-400 font-bold bg-emerald-950/20 px-1.5 rounded border border-emerald-500/15';
    default:
      return 'text-on-surface-variant font-medium';
  }
};

export default function LiveTimingView({
  drivers,
  selectedDriver,
  setSelectedDriver,
  isSimulating,
  setIsSimulating,
  onResetSim,
}: LiveTimingViewProps) {
  const sortedDrivers = [...drivers].sort((a, b) => a.currentPosition - b.currentPosition);

  // Top speeds derived live, no hardcoded VER row.
  const topSpeed = sortedDrivers.reduce<{ driver?: Driver; value: number }>(
    (acc, d) => (d.speed > acc.value ? { driver: d, value: d.speed } : acc),
    { value: 0 },
  );
  const longestStint = sortedDrivers.reduce<{ driver?: Driver; value: number }>(
    (acc, d) => (d.tyreAge > acc.value ? { driver: d, value: d.tyreAge } : acc),
    { value: 0 },
  );
  const sessionBest = sortedDrivers.reduce<{ driver?: Driver; value: number }>(
    (acc, d) =>
      d.bestLapMs > 0 && d.bestLapMs < (acc.value || Number.POSITIVE_INFINITY)
        ? { driver: d, value: d.bestLapMs }
        : acc,
    { value: 0 },
  );

  const drsActiveCount = sortedDrivers.filter(d => d.drs).length;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Control panel & summary stats */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-surface-container p-4 rounded-lg border border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-2 px-4 py-2 font-mono font-bold text-xs rounded uppercase tracking-wider transition-colors duration-150 ${
              isSimulating
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-f1-red text-white hover:bg-red-700'
            }`}
            aria-pressed={isSimulating}
          >
            {isSimulating ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            {isSimulating ? 'PAUSE TELEMETRY' : 'START SIMULATION'}
          </button>

          <button
            onClick={onResetSim}
            className="flex items-center gap-1 bg-white/5 border border-white/10 text-on-surface-variant px-3 py-2 font-mono font-bold text-xs rounded hover:bg-white/10 transition-colors uppercase"
          >
            <RotateCcw size={12} />
            RESET
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-mono">
          <div className="flex items-center gap-1 text-white/50">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
            <span>SESSION BEST</span>
          </div>
          <div className="flex items-center gap-1 text-white/50">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            <span>PERSONAL BEST</span>
          </div>
          <div className="flex items-center gap-1 text-white/50">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>YELLOW SECTOR</span>
          </div>
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="carbon-card rounded-lg overflow-x-auto">
        <table className="w-full text-left font-mono border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-surface-container text-[11px] font-black text-on-surface-variant uppercase tracking-wider border-b border-white/10">
              <th className="py-3 px-4 w-12 text-center">POS</th>
              <th className="py-3 px-2 w-10">NO</th>
              <th className="py-3 px-3">DRIVER / TEAM</th>
              <th className="py-3 px-4 w-28">GAP</th>
              <th className="py-3 px-3 w-28 text-center">STATUS</th>
              <th className="py-3 px-4 text-right">LAST LAP</th>
              <th className="py-3 px-4 text-center">S1</th>
              <th className="py-3 px-4 text-center">S2</th>
              <th className="py-3 px-4 text-center">S3</th>
              <th className="py-3 px-4 text-center w-28">TYRES</th>
              <th className="py-3 px-3 text-center">PITS</th>
            </tr>
          </thead>
          <tbody>
            {sortedDrivers.map(driver => {
              const isSelected = selectedDriver?.id === driver.id;
              return (
                <tr
                  key={driver.id}
                  onClick={() => setSelectedDriver(driver)}
                  className={`cursor-pointer transition-colors duration-150 border-b border-white/5 hover:bg-white/5 align-middle ${
                    isSelected ? 'bg-white/10 text-white font-semibold' : 'text-on-surface/90'
                  }`}
                >
                  <td className="py-3 text-center font-bold relative">
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-f1-red" />}
                    <span
                      className={
                        driver.currentPosition <= 3
                          ? 'text-f1-red font-black font-sans italic text-sm'
                          : 'text-on-surface-variant'
                      }
                    >
                      {driver.currentPosition}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-[11px] text-white/50 font-bold">{driver.number}</span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-5 rounded-full" style={{ backgroundColor: driver.teamColor }} />
                      <div className="flex flex-col">
                        <span className="font-sans font-extrabold text-sm text-on-surface">
                          {driver.code}
                          <span className="font-mono text-xs text-white/40 font-normal ml-2 hidden lg:inline">
                            {driver.name}
                          </span>
                        </span>
                        <span className="text-[10px] text-on-surface-variant/70 uppercase">{driver.team}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-bold text-on-surface/80">
                    {driver.gapToLeader === 'INTERVAL' ? (
                      <span className="text-[10px] bg-white/5 text-white/50 px-1 rounded">LEADER</span>
                    ) : (
                      driver.gapToLeader
                    )}
                  </td>
                  <td className="py-3 px-3 text-center text-xs">
                    {driver.status === 'pitting' ? (
                      <span className="inline-block bg-amber-600/10 border border-amber-600/30 text-amber-500 font-extrabold px-1.5 py-0.5 rounded text-[10px] tracking-wide animate-pulse uppercase">
                        IN PIT LANE
                      </span>
                    ) : driver.status === 'retired' ? (
                      <span className="inline-block bg-red-950/35 border border-red-900/30 text-red-500/80 font-bold px-1.5 py-0.5 rounded text-[10px] tracking-wide uppercase">
                        RETIRED
                      </span>
                    ) : (
                      <span className="inline-block bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 px-1.5 py-0.5 rounded text-[10px] tracking-wide font-bold uppercase">
                        ON TRACK
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-xs text-on-surface">
                    {driver.lastLapTime}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-xs">
                    <span className={sectorClass(driver.sector1State)}>{driver.sector1.toFixed(3)}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-xs">
                    <span className={sectorClass(driver.sector2State)}>{driver.sector2.toFixed(3)}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-xs">
                    <span className={sectorClass(driver.sector3State)}>{driver.sector3.toFixed(3)}</span>
                  </td>
                  <td className="py-3 px-4 text-center text-xs">
                    <TyrePill compound={driver.tyre} age={driver.tyreAge} />
                  </td>
                  <td className="py-3 px-3 text-center text-xs font-bold text-on-surface-variant">
                    {driver.pitStops}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Live derived stats — no fake values */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-surface-low border border-white/5 rounded p-3 flex justify-between items-center text-xs">
          <span className="text-on-surface-variant font-mono">SESSION BEST</span>
          <span className="text-purple-400 font-bold">
            {sessionBest.driver ? `${sessionBest.driver.code} ${sessionBest.driver.bestLapTime}` : '—'}
          </span>
        </div>
        <div className="bg-surface-low border border-white/5 rounded p-3 flex justify-between items-center text-xs">
          <span className="text-on-surface-variant font-mono">TOP SPEED</span>
          <span className="text-emerald-400 font-bold">
            {topSpeed.driver ? `${topSpeed.driver.code} ${topSpeed.value} km/h` : '—'}
          </span>
        </div>
        <div className="bg-surface-low border border-white/5 rounded p-3 flex justify-between items-center text-xs">
          <span className="text-on-surface-variant font-mono">LONGEST STINT</span>
          <span className="text-amber-400 font-bold">
            {longestStint.driver ? `${longestStint.driver.code} · ${longestStint.value}L` : '—'}
          </span>
        </div>
        <div className="bg-surface-low border border-white/5 rounded p-3 flex justify-between items-center text-xs">
          <span className="text-on-surface-variant font-mono">DRS ACTIVE</span>
          <span className="text-f1-red font-bold">{drsActiveCount} CARS</span>
        </div>
      </div>
    </div>
  );
}
