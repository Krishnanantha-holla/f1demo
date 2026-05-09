import { useMemo } from 'react';
import { getTeamColor } from '../api';

function median(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  const sorted = [...filtered].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

const COMPOUND_COLORS = {
  SOFT: '#dc2626',
  MEDIUM: '#ca8a04',
  HARD: '#d1d5db',
  INTERMEDIATE: '#2563eb',
  WET: '#7c3aed',
};

export default function PaceStrip({ driverData = {}, roster = [] }) {
  const drivers = Object.keys(driverData).filter((driver) => Array.isArray(driverData[driver]) && driverData[driver].length > 0);

  const W = 640;
  const H = 260;
  const PAD = { top: 18, right: 18, bottom: 30, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const ordering = useMemo(() => drivers
    .map((driver) => ({
      driver,
      median: median(driverData[driver].map((lap) => lap.LapTimeSeconds)),
    }))
    .sort((a, b) => a.median - b.median), [driverData, drivers]);

  const allTimes = drivers.flatMap((driver) => driverData[driver].map((lap) => lap.LapTimeSeconds).filter((value) => Number.isFinite(value)));
  const minT = allTimes.length ? Math.min(...allTimes) - 0.5 : 0;
  const maxT = allTimes.length ? Math.max(...allTimes) + 0.5 : 1;

  const xScale = (index) => PAD.left + ((index + 0.5) / Math.max(1, ordering.length)) * innerW;
  const yScale = (seconds) => PAD.top + (1 - (seconds - minT) / Math.max(1e-9, maxT - minT)) * innerH;

  const teamColor = (driverCode) => {
    const driver = roster.find((entry) => entry.name_acronym === driverCode || entry.code === driverCode);
    return getTeamColor(driver?.team_name || driver?.team || '');
  };

  if (!ordering.length) return null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Pace distribution</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>sorted by median lap time</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = PAD.top + ratio * innerH;
          const label = (maxT - ratio * (maxT - minT)).toFixed(1);
          return (
            <g key={ratio}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(255,255,255,0.05)" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="var(--text-tertiary)" fontFamily="var(--font-mono)">
                {label}s
              </text>
            </g>
          );
        })}

        {ordering.map(({ driver }, index) => {
          const x = xScale(index);
          return (
            <g key={driver}>
              <text x={x} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-secondary)" fontFamily="var(--font-mono)">
                {driver}
              </text>
              {driverData[driver]
                .filter((lap) => Number.isFinite(lap.LapTimeSeconds))
                .map((lap) => {
                  const compound = String(lap.Compound || 'UNKNOWN').toUpperCase();
                  const color = COMPOUND_COLORS[compound] || teamColor(driver);
                  return (
                    <circle
                      key={`${driver}-${lap.LapNumber}-${lap.LapTimeSeconds}`}
                      cx={x}
                      cy={yScale(lap.LapTimeSeconds)}
                      r={2.8}
                      fill={color}
                      opacity={0.8}
                    >
                      <title>{`${driver} Lap ${lap.LapNumber}: ${lap.LapTimeSeconds?.toFixed?.(3) || lap.LapTimeSeconds}s`}</title>
                    </circle>
                  );
                })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}