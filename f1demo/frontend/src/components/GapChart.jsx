import { useMemo, useState } from 'react';
import { getTeamColor } from '../api';

export default function GapChart({ intervalsData = [], roster = [] }) {
  const [hovered, setHovered] = useState(null);

  const W = 640;
  const H = 280;
  const PAD = { top: 16, right: 16, bottom: 32, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const series = useMemo(() => {
    const byDriver = new Map();
    intervalsData.forEach((row) => {
      const key = row.driver_number ?? row.driver ?? row.name_acronym;
      if (key == null) return;
      if (!byDriver.has(key)) byDriver.set(key, []);
      byDriver.get(key).push(row);
    });
    return [...byDriver.entries()].map(([driver, rows]) => {
      const points = rows
        .map((row) => ({
          lap: row.lap_number ?? row.LapNumber ?? row.lap ?? row.position ?? 0,
          gap: Number(row.gap_to_leader ?? row.interval_to_leader ?? row.gap ?? row.interval ?? 0),
          row,
        }))
        .filter((point) => Number.isFinite(point.gap));
      const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${PAD.left + ((point.lap - 1) / Math.max(1, Math.max(...points.map((p) => p.lap)) - 1)) * innerW},${PAD.top + (1 - ((point.gap + 5) / 20)) * innerH}`).join(' ');
      return { driver, points, path };
    });
  }, [intervalsData]);

  const teamColor = (driverCode) => {
    const driver = roster.find((entry) => entry.name_acronym === driverCode || String(entry.driver_number) === String(driverCode));
    return getTeamColor(driver?.team_name || driver?.team || '');
  };

  if (!series.length) return null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Gap to leader</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>OpenF1 intervals</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = PAD.top + ratio * innerH;
          const label = (10 - ratio * 20).toFixed(1);
          return (
            <g key={ratio}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(255,255,255,0.05)" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="var(--text-tertiary)" fontFamily="var(--font-mono)">
                {label}s
              </text>
            </g>
          );
        })}
        <line x1={PAD.left} y1={PAD.top + innerH / 2} x2={W - PAD.right} y2={PAD.top + innerH / 2} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />

        {series.map(({ driver, points, path }) => {
          const color = teamColor(driver);
          return (
            <g key={driver}>
              <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
              {points.map((point, index) => (
                <circle
                  key={`${driver}-${index}`}
                  cx={PAD.left + ((point.lap - 1) / Math.max(1, Math.max(...points.map((p) => p.lap)) - 1)) * innerW}
                  cy={PAD.top + (1 - ((point.gap + 5) / 20)) * innerH}
                  r={3}
                  fill={color}
                  opacity={0.75}
                  onMouseEnter={() => setHovered({ driver, point })}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
            </g>
          );
        })}

        {hovered && (
          <g transform={`translate(${PAD.left + 16},${PAD.top + 16})`}>
            <rect width={122} height={42} rx={6} fill="var(--bg-raised)" stroke="var(--border-normal)" />
            <text x={8} y={16} fontSize={11} fill="var(--text-secondary)" fontFamily="var(--font-sans)">{hovered.driver}</text>
            <text x={8} y={30} fontSize={12} fill="var(--text-primary)" fontFamily="var(--font-mono)">{hovered.point.gap.toFixed(3)}s</text>
          </g>
        )}
      </svg>
    </div>
  );
}