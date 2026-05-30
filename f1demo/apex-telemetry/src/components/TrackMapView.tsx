import { useMemo, useState } from 'react';
import type { Driver } from '../types';
import type { CircuitGeometry, OpenF1Session } from '../services/f1Api';
import { Info, Layers, Map } from 'lucide-react';
import { SAKHIR_VECTOR_POINTS } from '../data';

interface TrackMapViewProps {
  drivers: Driver[];
  selectedDriver: Driver | null;
  setSelectedDriver: (driver: Driver | null) => void;
  circuit: CircuitGeometry | null;
  session: OpenF1Session | null;
}

// Fallback used when bacinger/f1-circuits has no geometry for the country yet.
const SAKHIR_FALLBACK: CircuitGeometry = {
  id: 'bh-2002',
  country: 'Bahrain',
  name: 'Bahrain International Circuit (Sakhir)',
  lengthMeters: 5412,
  points: SAKHIR_VECTOR_POINTS.map(p => ({ x: p.x, y: p.y })),
  startProgress: 0,
};

const STYLE_TO_STROKE: Record<'carbon' | 'thermal' | 'sectors', string> = {
  carbon: 'stroke-f1-red',
  thermal: 'stroke-amber-500/80',
  sectors: 'stroke-sky-400/85',
};

function pointAt(points: Array<{ x: number; y: number }>, progress: number) {
  if (points.length === 0) return { x: 0, y: 0 };
  const numSegments = points.length - 1;
  const clamped = Math.max(0, Math.min(1, progress));
  const raw = clamped * numSegments;
  const idx = Math.floor(raw);
  const localT = raw - idx;
  const p1 = points[idx];
  const p2 = points[idx + 1] ?? points[0];
  return {
    x: p1.x + (p2.x - p1.x) * localT,
    y: p1.y + (p2.y - p1.y) * localT,
  };
}

export default function TrackMapView({
  drivers,
  selectedDriver,
  setSelectedDriver,
  circuit,
  session,
}: TrackMapViewProps) {
  const [trackStyle, setTrackStyle] = useState<'carbon' | 'thermal' | 'sectors'>('carbon');
  const [showTurnLabels, setShowTurnLabels] = useState(true);

  const geometry = circuit ?? SAKHIR_FALLBACK;
  const isFallback = !circuit;

  const path = useMemo(() => {
    const pts = geometry.points;
    if (pts.length === 0) return '';
    return (
      pts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '') + ' Z'
    );
  }, [geometry]);

  // Derive viewBox from the geometry so any circuit fits.
  const viewBox = useMemo(() => {
    const pts = geometry.points;
    if (pts.length === 0) return '0 0 1000 1000';
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const padding = 60;
    return `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`;
  }, [geometry]);

  const startFinish = geometry.points[0];

  // Sakhir fallback has named turns embedded; real circuits don't.
  const turnLabels = isFallback
    ? SAKHIR_VECTOR_POINTS.filter(p => 'name' in p && p.name).map(p => ({
        x: p.x,
        y: p.y,
        name: p.name as string,
      }))
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
      <div className="col-span-1 lg:col-span-8 carbon-card rounded-lg p-5 flex flex-col justify-between">
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Map size={15} className="text-on-surface-variant" />
            <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
              {session ? `${session.country_name} · ${session.session_name}` : 'Live track overlay'}
            </span>
            <span className="font-mono text-[10px] text-on-surface-variant/70 uppercase">
              {geometry.name}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                setTrackStyle(prev =>
                  prev === 'carbon' ? 'thermal' : prev === 'thermal' ? 'sectors' : 'carbon',
                )
              }
              className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-on-surface-variant px-2.5 py-1.5 rounded text-[10px] font-mono font-bold uppercase border border-white/10 transition-colors"
            >
              <Layers size={11} />
              STYLE: {trackStyle}
            </button>
            <button
              onClick={() => setShowTurnLabels(!showTurnLabels)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-mono font-bold uppercase border transition-colors ${
                showTurnLabels
                  ? 'bg-f1-red/10 border-f1-red/25 text-f1-red'
                  : 'bg-white/5 border-white/10 text-on-surface-variant hover:bg-white/10'
              }`}
            >
              <Info size={11} />
              TURNS
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center min-h-[360px] relative p-4 max-h-[560px]">
          <div className="absolute top-4 left-4 font-mono text-[10px] text-on-surface-variant bg-black/40 p-2.5 border border-white/5 rounded flex flex-col gap-1.5 z-10 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1.5 bg-f1-red rounded-sm" />
              <span>RACING LINE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full border border-f1-red animate-ping" />
              <span>SELECTED CAR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1.5 bg-white/80 rounded-sm" />
              <span>START / FINISH</span>
            </div>
          </div>

          <svg viewBox={viewBox} className="w-full h-full max-w-full max-h-[480px]">
            <path
              d={path}
              fill="none"
              stroke="#2a2a2a"
              strokeWidth={isFallback ? 22 : 18}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-50"
            />
            <path
              d={path}
              fill="none"
              stroke="#131313"
              strokeWidth={isFallback ? 14 : 10}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={path}
              fill="none"
              strokeWidth={isFallback ? 2.5 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-all duration-300 ${STYLE_TO_STROKE[trackStyle]}`}
              strokeDasharray={trackStyle === 'sectors' ? '12, 12' : undefined}
            />

            {startFinish && (
              <circle cx={startFinish.x} cy={startFinish.y} r={isFallback ? 4 : 6} fill="#ffffff" />
            )}

            {showTurnLabels &&
              turnLabels.map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r="10" className="fill-surface-highest stroke-white/10 stroke-1" />
                  <text
                    x={pt.x}
                    y={pt.y + 3.5}
                    className="fill-on-surface-variant font-sans text-[8px] font-black"
                    textAnchor="middle"
                  >
                    {pt.name}
                  </text>
                </g>
              ))}

            {drivers.map(driver => {
              const pos = pointAt(geometry.points, driver.trackProgress);
              const isSelected = selectedDriver?.id === driver.id;
              const dotR = isFallback ? 9 : 7;
              return (
                <g
                  key={driver.id}
                  className="cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedDriver(driver);
                  }}
                >
                  {isSelected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={dotR + 8}
                      className="fill-none stroke-f1-red animate-pulse"
                      strokeWidth="2"
                    />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={dotR}
                    fill={driver.teamColor}
                    className="stroke-black/70 stroke-2 transition-all duration-150"
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 2.5}
                    className="fill-black font-sans font-black text-[7px]"
                    textAnchor="middle"
                  >
                    {driver.code.slice(0, 2)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex justify-between items-center text-[10px] font-mono text-on-surface-variant bg-white/5 p-2 rounded">
          <span className="uppercase">
            {geometry.lengthMeters
              ? `Total length: ${(geometry.lengthMeters / 1000).toFixed(3)} km`
              : 'Layout source: bacinger/f1-circuits'}
          </span>
          <span className="text-f1-red font-black uppercase">
            {isFallback ? 'CACHED LAYOUT' : 'GEOJSON LIVE'}
          </span>
        </div>
      </div>

      <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
        <div className="carbon-card rounded-lg p-5 flex-1 flex flex-col justify-between min-h-[300px]">
          <div>
            <h2 className="font-mono text-xs font-bold tracking-wider text-on-surface-variant border-b border-white/5 pb-2 uppercase">
              Selected car status
            </h2>

            {selectedDriver ? (
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded bg-white/5 flex items-center justify-center font-sans font-black text-lg border border-white/10"
                    style={{ color: selectedDriver.teamColor }}
                  >
                    #{selectedDriver.number}
                  </div>
                  <div>
                    <h3 className="font-sans font-extrabold text-sm text-on-surface">
                      {selectedDriver.name}
                    </h3>
                    <p className="font-mono text-xs text-on-surface-variant uppercase">
                      {selectedDriver.team}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex flex-col">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-on-surface-variant">SPEED</span>
                      <span className="text-on-surface font-bold">{selectedDriver.speed} KM/H</span>
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded overflow-hidden mt-1">
                      <div
                        className="bg-f1-red h-full transition-all duration-150"
                        style={{ width: `${(selectedDriver.speed / 330) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-on-surface-variant">THROTTLE</span>
                        <span className="text-emerald-400 font-bold">{selectedDriver.throttle}%</span>
                      </div>
                      <div className="w-full bg-white/5 h-1.5 rounded overflow-hidden mt-1">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-150"
                          style={{ width: `${selectedDriver.throttle}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-on-surface-variant">BRAKE</span>
                        <span className="text-red-400 font-bold">{selectedDriver.brake}%</span>
                      </div>
                      <div className="w-full bg-white/5 h-1.5 rounded overflow-hidden mt-1">
                        <div
                          className="bg-red-500 h-full transition-all duration-150"
                          style={{ width: `${selectedDriver.brake}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-mono bg-black/35 p-2 rounded">
                    <div>
                      <div className="text-[10px] text-on-surface-variant uppercase">Engine RPM</div>
                      <div className="text-sm font-bold text-on-surface mt-0.5">
                        {selectedDriver.rpm.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-on-surface-variant uppercase">Gear</div>
                      <div className="text-sm font-black text-f1-red text-right mt-0.5">
                        {selectedDriver.gear === 0 ? 'N' : selectedDriver.gear}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-2 rounded text-center text-[10px] font-mono font-bold tracking-widest ${
                      selectedDriver.drs
                        ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                        : 'bg-white/5 border border-white/5 text-white/30'
                    }`}
                  >
                    {selectedDriver.drs ? 'DRS ENABLED · WING OPEN' : 'DRS DISABLED'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-12 text-center text-xs text-on-surface-variant italic">
                Tap any driver bubble or leaderboard row to focus.
              </div>
            )}
          </div>

          <div className="text-[9px] text-on-surface-variant/75 font-mono italic leading-relaxed border-t border-white/5 pt-3 mt-4">
            {isFallback
              ? '* Sakhir layout shipped as a vector fallback when no live circuit is selected.'
              : '* Polyline projected from bacinger/f1-circuits GeoJSON, MIT licensed.'}
          </div>
        </div>
      </div>
    </div>
  );
}
