import { useState, useEffect, useMemo } from 'react';
import { api, getTeamColor } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

const DRIVERS = [
  'VER','NOR','LEC','PIA','HAM','RUS','SAI','ALO','GAS','STR',
  'TSU','ALB','HUL','PER','ANT','DOO','HAD','BOR'
];

function StatBar({ label, v1, v2, name1, name2, higherBetter = true }) {
  const max = Math.max(v1, v2) || 1;
  const w1 = (v1 / max) * 100;
  const w2 = (v2 / max) * 100;
  const c1 = (higherBetter ? v1 >= v2 : v1 <= v2) ? 'var(--accent)' : 'var(--text-dim)';
  const c2 = (higherBetter ? v2 >= v1 : v2 <= v1) ? 'var(--accent)' : 'var(--text-dim)';
  return (
    <div className="h2h-stat-row">
      <span className="h2h-val" style={{ color: c1 }}>{v1}</span>
      <div className="h2h-bars">
        <div className="h2h-bar-left" style={{ width: `${w1}%`, background: c1 }} />
        <span className="h2h-label">{label}</span>
        <div className="h2h-bar-right" style={{ width: `${w2}%`, background: c2 }} />
      </div>
      <span className="h2h-val" style={{ color: c2 }}>{v2}</span>
    </div>
  );
}

function RaceChart({ races, d1, d2 }) {
  if (!races.length) return null;
  const W = 700, H = 220, pad = { t: 20, r: 20, b: 30, l: 30 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const maxPos = 20;
  const x = (i) => pad.l + (i / (races.length - 1 || 1)) * iW;
  const y = (pos) => pad.t + ((pos - 1) / (maxPos - 1)) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h2h-chart" role="img" aria-label="Race position comparison chart">
      {[1, 5, 10, 15, 20].map(p => (
        <g key={p}>
          <line x1={pad.l} y1={y(p)} x2={W - pad.r} y2={y(p)} stroke="rgba(255,255,255,0.06)" />
          <text x={pad.l - 6} y={y(p) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">P{p}</text>
        </g>
      ))}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2"
        points={races.map((r, i) => `${x(i)},${y(r.d1_pos)}`).join(' ')} />
      <polyline fill="none" stroke="#ff6b6b" strokeWidth="2"
        points={races.map((r, i) => `${x(i)},${y(r.d2_pos)}`).join(' ')} />
      {races.map((r, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(r.d1_pos)} r="3" fill="var(--accent)" />
          <circle cx={x(i)} cy={y(r.d2_pos)} r="3" fill="#ff6b6b" />
          <text x={x(i)} y={H - 5} textAnchor="middle" fontSize="8" fill="var(--text-dim)">R{r.round}</text>
        </g>
      ))}
      <text x={W - pad.r} y={12} textAnchor="end" fontSize="10" fill="var(--accent)">{d1}</text>
      <text x={W - pad.r} y={24} textAnchor="end" fontSize="10" fill="#ff6b6b">{d2}</text>
    </svg>
  );
}

export default function HeadToHead() {
  const [driver1, setDriver1] = useState('VER');
  const [driver2, setDriver2] = useState('NOR');
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.headToHead(driver1, driver2, year)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [driver1, driver2, year]);

  return (
    <div className="page-container">
      <h1 className="page-title">Head to Head</h1>
      <div className="h2h-controls">
        <select value={driver1} onChange={e => setDriver1(e.target.value)} aria-label="Driver 1">
          {DRIVERS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="h2h-vs">VS</span>
        <select value={driver2} onChange={e => setDriver2(e.target.value)} aria-label="Driver 2">
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
          <div className="h2h-header">
            <div className="h2h-driver-name" style={{ color: 'var(--accent)' }}>{data.driver1.code}</div>
            <div className="h2h-driver-name" style={{ color: '#ff6b6b' }}>{data.driver2.code}</div>
          </div>

          <div className="card">
            <StatBar label="Points" v1={data.driver1.points} v2={data.driver2.points} />
            <StatBar label="Wins" v1={data.driver1.wins} v2={data.driver2.wins} />
            <StatBar label="Podiums" v1={data.driver1.podiums} v2={data.driver2.podiums} />
            <StatBar label="Avg Finish" v1={data.driver1.avg_finish} v2={data.driver2.avg_finish} higherBetter={false} />
            <StatBar label="Avg Quali" v1={data.driver1.avg_qualifying} v2={data.driver2.avg_qualifying} higherBetter={false} />
            <StatBar label="DNFs" v1={data.driver1.dnfs} v2={data.driver2.dnfs} higherBetter={false} />
            <StatBar label="Race H2H" v1={data.h2h_race[data.driver1.code]} v2={data.h2h_race[data.driver2.code]} />
            <StatBar label="Quali H2H" v1={data.h2h_qualifying[data.driver1.code]} v2={data.h2h_qualifying[data.driver2.code]} />
          </div>

          <div className="card">
            <h3 className="card-title">Race Positions</h3>
            <RaceChart races={data.races} d1={data.driver1.code} d2={data.driver2.code} />
          </div>
        </>
      )}
    </div>
  );
}
