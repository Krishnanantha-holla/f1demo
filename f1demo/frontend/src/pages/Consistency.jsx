import { useState, useEffect } from 'react';
import { api, getTeamColor } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

function Sparkline({ finishes }) {
  if (!finishes || finishes.length < 2) return null;
  const W = 80, H = 24;
  const maxP = 20;
  const x = (i) => (i / (finishes.length - 1)) * W;
  const y = (p) => ((p - 1) / (maxP - 1)) * H;
  const points = finishes.map((p, i) => `${x(i)},${y(p)}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline fill="none" stroke="var(--accent)" strokeWidth="1.5" points={points} />
    </svg>
  );
}

export default function Consistency() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.consistency(year)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [year]);

  return (
    <div className="page-container">
      <h1 className="page-title">Consistency Tracker</h1>
      <div className="h2h-controls">
        <select value={year} onChange={e => setYear(+e.target.value)} aria-label="Year">
          {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <Loading />}
      {error && <ErrorMsg text={error} />}
      {data && !loading && (
        <>
          <p className="page-subtitle">Ranked by consistency score (lower standard deviation = more consistent). {data.total_races} races analyzed.</p>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Driver</th><th>Team</th><th>Avg Finish</th>
                  <th>Std Dev</th><th>Points %</th><th>Best</th><th>Worst</th><th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map((d, i) => (
                  <tr key={i}>
                    <td><strong>{i + 1}</strong></td>
                    <td>{d.code} <span style={{ color: 'var(--text-dim)', fontSize: '0.8em' }}>{d.name}</span></td>
                    <td style={{ borderLeft: `3px solid ${getTeamColor(d.team)}`, paddingLeft: '0.5rem' }}>{d.team}</td>
                    <td>{d.avg_finish}</td>
                    <td style={{ color: d.std_dev < 2 ? '#4ecdc4' : d.std_dev < 4 ? '#ffd700' : '#ff6b6b' }}>
                      {d.std_dev}
                    </td>
                    <td>{d.points_finishes_pct}%</td>
                    <td>P{d.best_finish}</td>
                    <td>P{d.worst_finish}</td>
                    <td><Sparkline finishes={d.finishes} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
