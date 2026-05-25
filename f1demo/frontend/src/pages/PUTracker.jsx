import { useState, useEffect } from 'react';
import { api } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

function RiskBadge({ risk }) {
  const colors = { LOW: '#4ecdc4', MEDIUM: '#ffd700', HIGH: '#ff3333' };
  return <span className="risk-badge" style={{ background: colors[risk] || '#888' }}>{risk}</span>;
}

function UsageCell({ used, limit }) {
  const pct = used / limit;
  const color = pct >= 1 ? '#ff3333' : pct >= 0.75 ? '#ffd700' : '#4ecdc4';
  return <td style={{ color, fontWeight: pct >= 1 ? 700 : 400 }}>{used}/{limit}</td>;
}

export default function PUTracker() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.puElements(year)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [year]);

  return (
    <div className="page-container">
      <h1 className="page-title">PU Elements & Gearbox Tracker</h1>
      <div className="h2h-controls">
        <select value={year} onChange={e => setYear(+e.target.value)} aria-label="Year">
          {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <Loading />}
      {error && <ErrorMsg text={error} />}
      {data && !loading && (
        <>
          <p className="page-subtitle">Races completed: {data.races_completed} / 24 • Season allocation limits shown in header</p>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table pu-table">
              <thead>
                <tr>
                  <th>Driver</th><th>Team</th>
                  <th>ICE ({data.allocations.ICE})</th>
                  <th>TC ({data.allocations.TC})</th>
                  <th>MGU-H ({data.allocations.MGU_H})</th>
                  <th>MGU-K ({data.allocations.MGU_K})</th>
                  <th>ES ({data.allocations.ES})</th>
                  <th>CE ({data.allocations.CE})</th>
                  <th>GBX ({data.allocations.GBX})</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map((d, i) => (
                  <tr key={i}>
                    <td><strong>{d.driver}</strong></td>
                    <td>{d.team}</td>
                    <UsageCell used={d.ICE} limit={data.allocations.ICE} />
                    <UsageCell used={d.TC} limit={data.allocations.TC} />
                    <UsageCell used={d.MGU_H} limit={data.allocations.MGU_H} />
                    <UsageCell used={d.MGU_K} limit={data.allocations.MGU_K} />
                    <UsageCell used={d.ES} limit={data.allocations.ES} />
                    <UsageCell used={d.CE} limit={data.allocations.CE} />
                    <UsageCell used={d.GBX} limit={data.allocations.GBX} />
                    <td><RiskBadge risk={d.penalty_risk} /></td>
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
