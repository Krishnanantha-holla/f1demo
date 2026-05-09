import { useMemo, useState } from 'react';
import { getTeamColor } from '../api';

function formatLapTime(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  return `${seconds.toFixed(3)}s`;
}

function median(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  const sorted = [...filtered].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export default function LapDeltaChart({ driverData = {}, roster = [] }) {
  const [tooltip, setTooltip] = useState(null);
  const drivers = Object.keys(driverData).filter((driver) => Array.isArray(driverData[driver]) && driverData[driver].length > 0);

  const W = 640;
  const H = 280;
  const PAD = { top: 16, right: 16, bottom: 32, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allLaps = drivers.flatMap((driver) => driverData[driver]);
  const allTimes = allLaps.map((lap) => lap.LapTimeSeconds).filter((value) => Number.isFinite(value));
  const maxLap = Math.max(1, ...allLaps.map((lap) => lap.LapNumber || 1));
  const minT = allTimes.length ? Math.min(...allTimes) - 0.5 : 0;
  const maxT = allTimes.length ? Math.max(...allTimes) + 0.5 : 1;
  const paceRef = median(allTimes);

  const xScale = (lap) => PAD.left + ((Math.max(1, lap) - 1) / Math.max(1, maxLap - 1)) * innerW;
  const yScale = (seconds) => PAD.top + (1 - (seconds - minT) / Math.max(1e-9, maxT - minT)) * innerH;

  const series = useMemo(() => drivers.map((driver) => {
    const laps = driverData[driver].filter((lap) => Number.isFinite(lap.LapTimeSeconds));
    const points = laps.map((lap, index) => {
      const x = xScale(lap.LapNumber || index + 1);
      const y = yScale(lap.LapTimeSeconds);
      return { ...lap, x, y };
    });
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    return { driver, laps: points, path };
  }), [driverData, drivers]);

  const teamColor = (driverCode) => {
    const driver = roster.find((entry) => entry.name_acronym === driverCode || entry.code === driverCode);
    return getTeamColor(driver?.team_name || driver?.team || '');
  };

  if (!drivers.length) return null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Lap time comparison</span>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {drivers.map((driver) => (
            <span key={driver} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ width: 20, height: 2, background: teamColor(driver), borderRadius: 1, display: 'inline-block' }} />
              {driver}
            </span>
          ))}
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = PAD.top + ratio * innerH;
          const label = (maxT - ratio * (maxT - minT)).toFixed(1);
          return (
            <g key={ratio}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="var(--text-tertiary)" fontFamily="var(--font-mono)">
                {label}s
              </text>
            </g>
          );
        })}

        <line
          x1={PAD.left}
          y1={yScale(paceRef)}
          x2={W - PAD.right}
          y2={yScale(paceRef)}
          stroke="rgba(255,255,255,0.22)"
          strokeDasharray="5 4"
        />
        <text x={W - PAD.right} y={yScale(paceRef) - 6} textAnchor="end" fontSize={10} fill="var(--text-secondary)" fontFamily="var(--font-mono)">
          reference pace
        </text>

        {series.map(({ driver, path, laps }) => {
          const color = teamColor(driver);
          return (
            <g key={driver}>
              <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
              {laps.map((lap) => (
                <circle
                  key={`${driver}-${lap.LapNumber}-${lap.LapTimeSeconds}`}
                  cx={lap.x}
                  cy={lap.y}
                  r={3}
                  fill={color}
                  opacity={0.8}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setTooltip({ driver, lap, x: lap.x, y: lap.y })}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </g>
          );
        })}

        {[1, Math.max(1, Math.floor(maxLap / 4)), Math.max(1, Math.floor(maxLap / 2)), Math.max(1, Math.floor((3 * maxLap) / 4)), maxLap].map((lap) => (
          <text key={lap} x={xScale(lap)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)" fontFamily="var(--font-mono)">
            {lap}
          </text>
        ))}

        {tooltip && (
          <g transform={`translate(${Math.min(tooltip.x + 8, W - 128)},${Math.max(tooltip.y - 56, 10)})`}>
            <rect width={120} height={60} rx={6} fill="var(--bg-raised)" stroke="var(--border-normal)" strokeWidth={1} />
            <text x={8} y={16} fontSize={11} fill="var(--text-secondary)" fontFamily="var(--font-sans)">
              {tooltip.driver} · Lap {tooltip.lap.LapNumber}
            </text>
            <text x={8} y={32} fontSize={12} fill="var(--text-primary)" fontFamily="var(--font-mono)" fontWeight={500}>
              {formatLapTime(tooltip.lap.LapTimeSeconds)}
            </text>
            <text x={8} y={47} fontSize={10} fill="var(--text-tertiary)" fontFamily="var(--font-sans)">
              {tooltip.lap.Compound || 'Unknown'} · S1 {formatLapTime(tooltip.lap.S1)}
            </text>
            <text x={8} y={58} fontSize={10} fill="var(--text-tertiary)" fontFamily="var(--font-sans)">
              S2 {formatLapTime(tooltip.lap.S2)} · S3 {formatLapTime(tooltip.lap.S3)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}