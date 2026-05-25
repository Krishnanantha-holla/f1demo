import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

export default function LiveTrackMap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchPositions = () => {
    api.liveTrackMap()
      .then(d => { setData(d); setError(null); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => {
    fetchPositions();
    intervalRef.current = setInterval(fetchPositions, 4000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const positions = data?.positions || [];

  // Normalize positions to SVG viewport
  const xs = positions.filter(p => p.x != null).map(p => p.x);
  const ys = positions.filter(p => p.y != null).map(p => p.y);
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 100);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 100);
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
  const W = 500, H = 400, pad = 30;
  const scaleX = (x) => pad + ((x - minX) / rangeX) * (W - 2 * pad);
  const scaleY = (y) => pad + ((y - minY) / rangeY) * (H - 2 * pad);

  return (
    <div className="page-container">
      <h1 className="page-title">Live Track Map</h1>
      <p className="page-subtitle">
        {positions.length > 0
          ? `Showing ${positions.length} drivers • Updates every 4s`
          : 'Waiting for live session data...'}
      </p>

      {loading && <Loading />}
      {error && <ErrorMsg text={error} />}
      {!loading && positions.length > 0 && (
        <div className="card track-map-card">
          <svg viewBox={`0 0 ${W} ${H}`} className="track-map-svg" role="img" aria-label="Live track positions">
            {positions.map((p, i) => {
              if (p.x == null || p.y == null) return null;
              const cx = scaleX(p.x), cy = scaleY(p.y);
              const color = p.team_colour ? `#${p.team_colour}` : '#fff';
              return (
                <g key={p.driver_number || i}>
                  <circle cx={cx} cy={cy} r="8" fill={color} opacity="0.9" />
                  <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="6" fill="#000" fontWeight="700">
                    {p.name_acronym || p.driver_number}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="track-map-legend">
            {positions.map((p, i) => (
              <span key={i} className="track-legend-item">
                <span className="legend-dot" style={{ background: p.team_colour ? `#${p.team_colour}` : '#fff' }} />
                {p.name_acronym || p.driver_number}
              </span>
            ))}
          </div>
        </div>
      )}
      {!loading && positions.length === 0 && !error && (
        <div className="card">
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
            No live position data available. Track map is active during live sessions only.
          </p>
        </div>
      )}
    </div>
  );
}
