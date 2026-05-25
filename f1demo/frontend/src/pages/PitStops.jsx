import { useState, useEffect } from 'react';
import { api, getTeamColor } from '../api';
import { Loading, ErrorMsg, RetryPanel } from '../components/Shared';

function TeamBarChart({ averages }) {
  if (!averages || !averages.length) return null;
  const maxDur = Math.max(...averages.map(a => a.avg_duration)) || 1;
  return (
    <div className="pit-bar-chart">
      {averages.map((a, i) => (
        <div key={i} className="pit-bar-row">
          <span className="pit-bar-label">{a.team}</span>
          <div className="pit-bar-track">
            <div className="pit-bar-fill" style={{
              width: `${(a.avg_duration / maxDur) * 100}%`,
              background: getTeamColor(a.team),
            }} />
          </div>
          <span className="pit-bar-value">{a.avg_duration}s</span>
        </div>
      ))}
    </div>
  );
}

export default function PitStops() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [round, setRound] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const d = await api.pitStops(year, round);
        if (cancelled) return;
        setData(d);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [year, round]);

  return (
    <div className="page-container">
      <h1 className="page-title">Pit Stop Analytics</h1>
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
        api.pitStops(year, round).then(d => { setData(d); setLoading(false); }).catch(e => { setError(e?.message || 'Network error'); setLoading(false); });
      }} onDemo={() => {
        // demo fallback
        setData({ race_name: 'Demo Race', round, pit_stops: [{ stop_number: 1, driver: 'VER', team: 'Red Bull', lap: 12, duration: 2.05 }], team_averages: [{ team: 'Red Bull', avg_duration: 2.05 }] });
      }} />}
      {data && !loading && data.pit_stops && (
        <>
          {data.fastest_stop && (
            <div className="card highlight-card">
              <span className="highlight-label">⚡ Fastest Stop</span>
              <span className="highlight-value">{data.fastest_stop.duration}s</span>
              <span className="highlight-sub">{data.fastest_stop.driver} ({data.fastest_stop.team}) — Lap {data.fastest_stop.lap}</span>
            </div>
          )}

          {data.team_averages && data.team_averages.length > 0 && (
            <div className="card">
              <h3 className="card-title">Team Average Pit Stop Times</h3>
              <TeamBarChart averages={data.team_averages} />
            </div>
          )}

          <div className="card">
            <h3 className="card-title">All Pit Stops — {data.race_name || `Round ${data.round}`}</h3>
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Driver</th><th>Team</th><th>Lap</th><th>Duration</th></tr>
              </thead>
              <tbody>
                {data.pit_stops.map((s, i) => (
                  <tr key={i}>
                    <td>{s.stop_number}</td>
                    <td>{s.driver}</td>
                    <td>{s.team}</td>
                    <td>{s.lap}</td>
                    <td>{s.duration}s</td>
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
