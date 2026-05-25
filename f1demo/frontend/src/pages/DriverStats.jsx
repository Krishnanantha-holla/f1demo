import { useState, useEffect } from 'react';
import { api } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

const DRIVERS = [
  'VER','NOR','LEC','PIA','HAM','RUS','SAI','ALO','GAS','STR',
  'TSU','ALB','HUL','PER','ANT','DOO','HAD','BOR'
];

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-value">{value ?? '—'}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

function ProgressionChart({ data }) {
  if (!data || !data.length) return null;
  const W = 700, H = 180, pad = { t: 15, r: 20, b: 25, l: 40 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const maxPts = Math.max(...data.map(d => d.points)) || 1;
  const x = (i) => pad.l + (i / (data.length - 1 || 1)) * iW;
  const y = (pts) => pad.t + iH - (pts / maxPts) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stats-chart" role="img" aria-label="Season points progression">
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={pad.l} y1={y(f * maxPts)} x2={W - pad.r} y2={y(f * maxPts)} stroke="rgba(255,255,255,0.06)" />
          <text x={pad.l - 5} y={y(f * maxPts) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">{Math.round(f * maxPts)}</text>
        </g>
      ))}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2"
        points={data.map((d, i) => `${x(i)},${y(d.points)}`).join(' ')} />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.points)} r="3" fill="var(--accent)" />
          <text x={x(i)} y={H - 5} textAnchor="middle" fontSize="8" fill="var(--text-dim)">R{d.round}</text>
        </g>
      ))}
    </svg>
  );
}

function StartFinishChart({ data }) {
  if (!data || !data.length) return null;
  const W = 700, H = 200, pad = { t: 20, r: 20, b: 30, l: 40 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const maxPos = 20;
  const x = (i) => pad.l + (i / (data.length - 1 || 1)) * iW;
  const y = (pos) => pad.t + ((pos - 1) / (maxPos - 1)) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stats-chart" role="img" aria-label="Start vs finish positions">
      {[1, 5, 10, 15, 20].map(p => (
        <g key={p}>
          <line x1={pad.l} y1={y(p)} x2={W - pad.r} y2={y(p)} stroke="rgba(255,255,255,0.06)" />
          <text x={pad.l - 5} y={y(p) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">P{p}</text>
        </g>
      ))}
      <polyline fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4"
        points={data.map((d, i) => `${x(i)},${y(d.grid)}`).join(' ')} />
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2"
        points={data.map((d, i) => `${x(i)},${y(d.finish)}`).join(' ')} />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.grid)} r="2.5" fill="rgba(255,255,255,0.4)" />
          <circle cx={x(i)} cy={y(d.finish)} r="3" fill={d.delta > 0 ? '#4ecdc4' : d.delta < 0 ? '#ff6b6b' : 'var(--accent)'} />
          <text x={x(i)} y={H - 5} textAnchor="middle" fontSize="8" fill="var(--text-dim)">R{d.round}</text>
        </g>
      ))}
      <text x={W - pad.r} y={12} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.4)">Grid</text>
      <text x={W - pad.r} y={24} textAnchor="end" fontSize="9" fill="var(--accent)">Finish</text>
    </svg>
  );
}

export default function DriverStats() {
  const [driver, setDriver] = useState('VER');
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.driverStats(driver, year)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [driver, year]);

  return (
    <div className="page-container">
      <h1 className="page-title">Driver Stats</h1>
      <div className="h2h-controls">
        <select value={driver} onChange={e => setDriver(e.target.value)} aria-label="Driver">
          {DRIVERS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)} aria-label="Year">
          {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <Loading />}
      {error && <ErrorMsg text={error} />}
      {data && !loading && (
        <>
          <div className="stats-grid">
            <StatCard label="Championship" value={data.championship_position ? `P${data.championship_position}` : '—'} />
            <StatCard label="Points" value={data.total_points ?? '—'} sub={data.points_per_race ? `${data.points_per_race} per race` : undefined} />
            <StatCard label="Wins" value={data.wins ?? '—'} />
            <StatCard label="Podiums" value={data.podiums ?? '—'} sub={data.podium_pct ? `${data.podium_pct}%` : undefined} />
            <StatCard label="Fastest Laps" value={data.fastest_laps ?? '—'} />
            <StatCard label="Laps Led" value={data.laps_led ?? '—'} />
            <StatCard label="Avg Finish" value={data.avg_finish ?? '—'} />
            <StatCard label="Avg Qualifying" value={data.qualifying_avg ?? '—'} />
          </div>

          <div className="card">
            <h3 className="card-title">Points Progression</h3>
            <ProgressionChart data={data.season_progression} />
          </div>

          <div className="card">
            <h3 className="card-title">Start vs Finish</h3>
            <StartFinishChart data={data.start_vs_finish} />
          </div>
        </>
      )}
    </div>
  );
}
