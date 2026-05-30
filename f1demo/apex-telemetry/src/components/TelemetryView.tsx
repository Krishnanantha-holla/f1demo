import { useEffect, useMemo, useRef, useState } from 'react';
import type { Driver } from '../types';
import { Activity, Radio } from 'lucide-react';

interface TelemetryViewProps {
  drivers: Driver[];
  selectedDriver: Driver | null;
  setSelectedDriver: (driver: Driver | null) => void;
}

interface TracePoint {
  time: number;
  pSpeed: number;
  cSpeed: number;
  pThrottle: number;
  cThrottle: number;
  pBrake: number;
  cBrake: number;
}

const HISTORY_LENGTH = 60;

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, end);
  const e = polarToCartesian(cx, cy, r, start);
  const large = end - start <= 180 ? '0' : '1';
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export default function TelemetryView({
  drivers,
  selectedDriver,
  setSelectedDriver,
}: TelemetryViewProps) {
  const primaryDriver = selectedDriver ?? drivers[0];
  const initialCompare = useMemo(
    () => drivers.find(d => d.id !== primaryDriver?.id)?.id ?? '',
    [drivers, primaryDriver?.id],
  );
  const [compareDriverId, setCompareDriverId] = useState<string>(initialCompare);
  const compDriver = drivers.find(d => d.id === compareDriverId) ?? drivers[1];

  // Push the latest tick into a fixed-size ring buffer.
  const [history, setHistory] = useState<TracePoint[]>([]);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!primaryDriver) return;
    const id = window.setInterval(() => {
      tickRef.current += 1;
      setHistory(prev => {
        const next = prev.length >= HISTORY_LENGTH ? prev.slice(1) : prev.slice();
        next.push({
          time: tickRef.current,
          pSpeed: primaryDriver.speed,
          cSpeed: compDriver?.speed ?? 0,
          pThrottle: primaryDriver.throttle,
          cThrottle: compDriver?.throttle ?? 0,
          pBrake: primaryDriver.brake,
          cBrake: compDriver?.brake ?? 0,
        });
        return next;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [primaryDriver, compDriver]);

  if (!primaryDriver) {
    return (
      <div className="carbon-card rounded-lg p-10 text-center text-xs font-mono text-on-surface-variant">
        Awaiting driver feed.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* Selectors */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface-container p-4 rounded-lg border border-white/5 gap-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-f1-red animate-pulse" />
          <span className="font-sans font-extrabold text-sm text-on-surface">
            ENGINEERING TELEMETRY COMPARATOR
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DriverPicker
            label="Primary"
            value={primaryDriver.id}
            options={drivers}
            onChange={id => {
              const next = drivers.find(d => d.id === id);
              if (next) setSelectedDriver(next);
            }}
          />
          <span className="text-white/20 hidden sm:inline">|</span>
          <DriverPicker
            label="Comparison"
            value={compareDriverId || compDriver?.id || ''}
            options={drivers.filter(d => d.id !== primaryDriver.id)}
            onChange={setCompareDriverId}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DriverPanel driver={primaryDriver} />
        {compDriver && <DriverPanel driver={compDriver} />}
      </div>

      {/* History trace */}
      <div className="carbon-card rounded-lg p-5">
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-f1-red animate-pulse" />
            <span className="font-mono text-xs font-bold tracking-wider text-on-surface-variant uppercase">
              Live speed trace · last {HISTORY_LENGTH} ticks
            </span>
          </div>
          <div className="flex gap-4 font-mono text-[10px]">
            <Legend color={primaryDriver.teamColor} label={`${primaryDriver.code} SPEED`} />
            {compDriver && (
              <Legend color={compDriver.teamColor} label={`${compDriver.code} SPEED`} dashed />
            )}
          </div>
        </div>

        <div className="h-44 mt-4 relative w-full">
          {history.length > 0 ? (
            <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
              {[20, 50, 80].map(y => (
                <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="rgba(255,255,255,0.04)" />
              ))}
              <polyline
                fill="none"
                stroke={primaryDriver.teamColor}
                strokeWidth="2"
                points={history
                  .map((p, i) => {
                    const x = (i / (history.length - 1 || 1)) * 300;
                    const y = 90 - ((p.pSpeed - 50) / 280) * 80;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              {compDriver && (
                <polyline
                  fill="none"
                  stroke={compDriver.teamColor}
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                  points={history
                    .map((p, i) => {
                      const x = (i / (history.length - 1 || 1)) * 300;
                      const y = 90 - ((p.cSpeed - 50) / 280) * 80;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-on-surface-variant">
              Accumulating trace…
            </div>
          )}

          <div className="absolute top-0 left-1 font-mono text-[8px] text-white/30 flex flex-col justify-between h-full pointer-events-none">
            <span>340 KM/H</span>
            <span>200 KM/H</span>
            <span>60 KM/H</span>
          </div>
          <div className="absolute bottom-1 right-2 font-mono text-[8px] text-white/20 uppercase pointer-events-none">
            Δ scale: live · {HISTORY_LENGTH} samples
          </div>
        </div>
      </div>
    </div>
  );
}

function DriverPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Driver[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-on-surface-variant uppercase">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-black/45 border border-white/10 rounded px-2 py-1 font-mono text-xs text-white uppercase focus:border-f1-red focus:outline-none"
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

function DriverPanel({ driver }: { driver: Driver }) {
  return (
    <div
      className="carbon-card rounded-lg p-5 flex flex-col gap-4 border-t-2"
      style={{ borderTopColor: driver.teamColor }}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: driver.teamColor }} />
          <span className="font-sans font-black text-sm text-on-surface uppercase">{driver.name}</span>
        </div>
        <span className="font-mono text-[10px] bg-white/5 border border-white/5 text-on-surface-variant px-1.5 rounded">
          #{driver.number}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        <div className="col-span-1 sm:col-span-5 flex flex-col items-center">
          <div className="w-36 h-36 relative">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <path
                d={describeArc(50, 50, 42, -120, 120)}
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="5.5"
                strokeLinecap="round"
              />
              <path
                d={describeArc(50, 50, 42, -120, -120 + (driver.rpm / 15000) * 240)}
                fill="none"
                stroke={driver.teamColor}
                strokeWidth="6"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
              <text x="50" y="32" className="fill-white/30 font-mono text-[9px]" textAnchor="middle">
                RPM
              </text>
              <text x="50" y="44" className="fill-white/40 font-mono text-[7px]" textAnchor="middle">
                {driver.rpm.toLocaleString()}
              </text>
              <text x="50" y="70" className="fill-white font-sans font-black text-3xl" textAnchor="middle">
                {driver.gear === 0 ? 'N' : driver.gear}
              </text>
              <text x="50" y="82" className="fill-white/50 font-sans text-[7px] tracking-widest" textAnchor="middle">
                GEAR
              </text>
            </svg>
          </div>
        </div>

        <div className="col-span-1 sm:col-span-7 flex flex-col gap-3 font-mono">
          <div className="bg-black/30 p-2.5 rounded border border-white/5">
            <div className="text-[10px] text-on-surface-variant uppercase">Speed</div>
            <div className="text-xl font-black text-on-surface mt-0.5">
              {driver.speed} <span className="font-normal text-xs text-white/50">KM/H</span>
            </div>
          </div>

          <Bar label="Throttle" value={driver.throttle} color="bg-emerald-500" textColor="text-emerald-400" />
          <Bar label="Brake" value={driver.brake} color="bg-red-500" textColor="text-red-400" />
        </div>
      </div>

      <div className="flex justify-between text-[11px] font-mono text-on-surface-variant bg-white/5 p-2 rounded">
        <span>DRS: {driver.drs ? 'OPEN' : 'STATIC'}</span>
        <span>STEER: {driver.steering}°</span>
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  color,
  textColor,
}: {
  label: string;
  value: number;
  color: string;
  textColor: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-on-surface-variant font-bold uppercase">{label}</span>
        <span className={`font-bold ${textColor}`}>{value}%</span>
      </div>
      <div className="w-full bg-white/5 h-2 rounded mt-1.5 overflow-hidden">
        <div
          className={`${color} h-full transition-all duration-150`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
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
