import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Loading, ErrorMsg, RetryPanel } from '../../components/Shared';

const COMPOUND_COLORS = { SOFT: '#ff3333', MEDIUM: '#ffd700', HARD: '#ffffff', INTERMEDIATE: '#4ecdc4', WET: '#3498db' };

function PaceChart({ stints, selectedDrivers }) {
  const filtered = stints.filter(s => selectedDrivers.has(s.driver_code));
  if (!filtered.length) return <p style={{ color: 'var(--text-dim)' }}>Select drivers to view pace data</p>;

  const allLaps = filtered.flatMap(s => s.laps);
  if (!allLaps.length) return null;

  const W = 750, H = 320, pad = { t: 20, r: 20, b: 35, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const minLap = Math.min(...allLaps.map(l => l.lap_num));
  const maxLap = Math.max(...allLaps.map(l => l.lap_num));
  const times = allLaps.map(l => l.lap_time_s);
  const minT = Math.min(...times) - 0.5;
  const maxT = Math.max(...times) + 0.5;
  const lapRange = maxLap - minLap || 1;
  const tRange = maxT - minT || 1;
  const x = (lap) => pad.l + ((lap - minLap) / lapRange) * iW;
  const y = (t) => pad.t + ((t - minT) / tRange) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stats-chart" role="img" aria-label="Race pace scatter plot">
      {Array.from({ length: 5 }, (_, i) => {
        const val = minT + (i / 4) * tRange;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.06)" />
            <text x={pad.l - 5} y={y(val) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">{val.toFixed(1)}s</text>
          </g>
        );
      })}
      {filtered.map((stint, si) => (
        <g key={si}>
          {stint.laps.map((l, li) => (
            <circle key={li} cx={x(l.lap_num)} cy={y(l.lap_time_s)} r="2.5"
              fill={COMPOUND_COLORS[stint.compound] || '#888'} opacity="0.7" />
          ))}
          {stint.laps.length > 1 && (
            <line
              x1={x(stint.laps[0].lap_num)} y1={y(stint.laps[0].lap_time_s)}
              x2={x(stint.laps[stint.laps.length - 1].lap_num)}
              y2={y(stint.laps[0].lap_time_s + stint.deg_slope * stint.laps.length)}
              stroke={COMPOUND_COLORS[stint.compound] || '#888'} strokeWidth="1" strokeDasharray="3" opacity="0.5" />
          )}
        </g>
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const lap = minLap + Math.round((i / 5) * lapRange);
        return <text key={i} x={x(lap)} y={H - 5} textAnchor="middle" fontSize="9" fill="var(--text-dim)">L{lap}</text>;
      })}
    </svg>
  );
}

export default function RacePace() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [round, setRound] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDrivers, setSelectedDrivers] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const d = await api.racePace(year, round);
        if (cancelled) return;
        setData(d);
        const drivers = [...new Set((d.stints || []).map(s => s.driver_code))];
        setSelectedDrivers(new Set(drivers.slice(0, 5)));
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [year, round]);

  const allDrivers = data ? [...new Set(data.stints.map(s => s.driver_code))] : [];

  const toggleDriver = (d) => {
    setSelectedDrivers(prev => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Race Pace & Tire Degradation</h1>
      <div className="h2h-controls">
        <select value={year} onChange={e => setYear(+e.target.value)} aria-label="Year">
          {[2025, 2024, 2023, 2022].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={round} onChange={e => setRound(+e.target.value)} aria-label="Round">
          {Array.from({ length: 24 }, (_, i) => <option key={i + 1} value={i + 1}>Round {i + 1}</option>)}
        </select>
      </div>

      {loading && <Loading />}
      {error && <RetryPanel text={error} onRetry={() => {
        setError(null);
        setLoading(true);
        api.racePace(year, round).then(d => { setData(d); setLoading(false); const drivers = [...new Set((d.stints || []).map(s => s.driver_code))]; setSelectedDrivers(new Set(drivers.slice(0, 5))); }).catch(e => { setError(e?.message || 'Network error'); setLoading(false); });
      }} onDemo={() => {
        setData({ event_name: 'Demo Event', stints: [{ driver_code: 'VER', compound: 'SOFT', laps: [{ lap_num: 1, lap_time_s: 75 }] }], round });
        setSelectedDrivers(new Set(['VER']));
      }} />}
      {data && !loading && (
        <>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>{data.event_name}</h2>

          <div className="driver-filter">
            {allDrivers.map(d => (
              <button key={d} className={`filter-chip ${selectedDrivers.has(d) ? 'active' : ''}`}
                onClick={() => toggleDriver(d)}>{d}</button>
            ))}
          </div>

          <div className="compound-legend">
            {Object.entries(COMPOUND_COLORS).slice(0, 3).map(([name, color]) => (
              <span key={name} className="legend-item">
                <span className="legend-dot" style={{ background: color }} />{name}
              </span>
            ))}
          </div>

          <div className="card">
            <PaceChart stints={data.stints} selectedDrivers={selectedDrivers} />
          </div>

          <div className="card">
            <h3 className="card-title">Stint Summary</h3>
            <table className="data-table">
              <thead>
                <tr><th>Driver</th><th>Stint</th><th>Compound</th><th>Laps</th><th>Avg Pace</th><th>Deg/Lap</th></tr>
              </thead>
              <tbody>
                {data.stints.filter(s => selectedDrivers.has(s.driver_code)).map((s, i) => (
                  <tr key={i}>
                    <td>{s.driver_code}</td>
                    <td>{s.stint_number}</td>
                    <td><span className="compound-badge" style={{ background: COMPOUND_COLORS[s.compound] || '#888' }}>{s.compound}</span></td>
                    <td>{s.laps.length}</td>
                    <td>{s.avg_pace}s</td>
                    <td style={{ color: s.deg_slope > 0.05 ? '#ff6b6b' : s.deg_slope > 0.02 ? '#ffd700' : '#4ecdc4' }}>
                      {s.deg_slope > 0 ? '+' : ''}{s.deg_slope}s
                    </td>
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
