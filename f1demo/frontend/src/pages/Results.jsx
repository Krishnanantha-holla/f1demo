import { useState, useEffect } from 'react';
import { api, getTeamColor } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

export default function Results() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [round, setRound] = useState(1);
  const [session, setSession] = useState('R');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.resultsArchive(year, round, session)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [year, round, session]);

  return (
    <div className="page-container">
      <h1 className="page-title">Results Archive</h1>
      <div className="h2h-controls">
        <select value={year} onChange={e => setYear(+e.target.value)} aria-label="Year">
          {[2026, 2025, 2024, 2023, 2022].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={round} onChange={e => setRound(+e.target.value)} aria-label="Round">
          {Array.from({ length: 24 }, (_, i) => <option key={i + 1} value={i + 1}>Round {i + 1}</option>)}
        </select>
        <select value={session} onChange={e => setSession(e.target.value)} aria-label="Session">
          <option value="R">Race</option>
          <option value="Q">Qualifying</option>
          <option value="S">Sprint</option>
        </select>
      </div>

      {loading && <Loading />}
      {error && <ErrorMsg text={error} />}
      {data && !loading && (
        <>
          <h2 className="page-subtitle">{data.race_name} — {session === 'R' ? 'Race' : session === 'Q' ? 'Qualifying' : 'Sprint'}</h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pos</th><th>Driver</th><th>Team</th>
                  {session !== 'Q' && <><th>Grid</th><th>Laps</th></>}
                  <th>Time</th>
                  {session !== 'Q' && <><th>Points</th><th>Status</th></>}
                </tr>
              </thead>
              <tbody>
                {data.classifications.map((r, i) => (
                  <tr key={i}>
                    <td><strong>{r.position}</strong></td>
                    <td>{r.driver_code} <span style={{ color: 'var(--text-dim)', fontSize: '0.8em' }}>{r.driver_name}</span></td>
                    <td style={{ borderLeft: `3px solid ${getTeamColor(r.team)}`, paddingLeft: '0.5rem' }}>{r.team}</td>
                    {session !== 'Q' && <><td>{r.grid}</td><td>{r.laps}</td></>}
                    <td>{r.time || '—'}</td>
                    {session !== 'Q' && <><td>{r.points}</td><td>{r.status}</td></>}
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
