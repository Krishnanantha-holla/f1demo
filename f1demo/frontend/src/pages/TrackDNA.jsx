import { useState, useEffect } from 'react';
import { api } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

const CIRCUITS = [
  'bahrain', 'jeddah', 'melbourne', 'suzuka', 'monaco',
  'silverstone', 'spa', 'monza', 'singapore', 'interlagos'
];

function LevelBar({ label, level }) {
  const levels = { low: 1, medium: 2, high: 3 };
  const val = levels[level] || 0;
  const colors = ['#4ecdc4', '#ffd700', '#ff3333'];
  return (
    <div className="level-bar-row">
      <span className="level-bar-label">{label}</span>
      <div className="level-bar-dots">
        {[0, 1, 2].map(i => (
          <span key={i} className="level-dot" style={{ background: i < val ? colors[val - 1] : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>
      <span className="level-bar-text">{level}</span>
    </div>
  );
}

export default function TrackDNA() {
  const [circuit, setCircuit] = useState('bahrain');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.trackDna(circuit)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [circuit]);

  return (
    <div className="page-container">
      <h1 className="page-title">Track DNA</h1>
      <div className="h2h-controls">
        <select value={circuit} onChange={e => setCircuit(e.target.value)} aria-label="Circuit">
          {CIRCUITS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      {loading && <Loading />}
      {error && <ErrorMsg text={error} />}
      {data && !loading && (
        <>
          <div className="track-dna-header">
            <h2>{data.name}</h2>
            <p className="page-subtitle">{data.country} • {data.length_km} km • {data.laps} laps • {data.drs_zones} DRS zones</p>
          </div>

          <div className="track-dna-grid">
            <div className="card">
              <h3 className="card-title">Circuit Characteristics</h3>
              <LevelBar label="Downforce" level={data.downforce_level} />
              <LevelBar label="Tire Wear" level={data.tire_wear} />
              <LevelBar label="Braking" level={data.braking_severity} />
              <LevelBar label="Track Evolution" level={data.track_evolution} />
              <div className="track-meta">
                <p><strong>Surface:</strong> {data.surface_type}</p>
                <p><strong>Tire Strategy:</strong> {data.tire_recommendation}</p>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Lap Record</h3>
              <div className="lap-record">
                <span className="lap-record-time">{data.lap_record.time}</span>
                <span className="lap-record-driver">{data.lap_record.driver} ({data.lap_record.year})</span>
              </div>

              <h3 className="card-title" style={{ marginTop: '1rem' }}>Key Overtaking Spots</h3>
              <ul className="overtaking-list">
                {data.key_overtaking_spots.map((spot, i) => (
                  <li key={i}>🟢 {spot}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Key Corners</h3>
            <table className="data-table">
              <thead>
                <tr><th>Turn</th><th>Type</th><th>Speed</th><th>Overtaking</th></tr>
              </thead>
              <tbody>
                {data.corners.map((c, i) => (
                  <tr key={i}>
                    <td><strong>T{c.number}</strong></td>
                    <td>{c.type.replace(/_/g, ' ')}</td>
                    <td>{c.speed}</td>
                    <td>{c.overtaking ? '🟢 Yes' : '⚪ No'}</td>
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
