import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { getCircuitData } from '../circuitData';
import { Loading, ErrorMsg, formatDateFull } from '../components/Shared';

// ── Helpers ──
function fmtLap(secs) {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(3).padStart(6, '0');
  return m > 0 ? `${m}:${s}` : s;
}

function fmtGap(gap) {
  if (!gap && gap !== 0) return '—';
  if (typeof gap === 'string') return gap;
  if (gap === 0) return 'WINNER';
  return `+${gap.toFixed(3)}s`;
}

// ── Helper: rotate point around center ──
function rotatePoint(x, y, angle, cx, cy) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: dx * cos - dy * sin + cx, y: dy * cos + dx * sin + cy };
}

// ── Real Track Map from MultiViewer data ──
function RealTrackMap({ mapData }) {
  if (!mapData || !mapData.x || !mapData.y || mapData.x.length === 0) return null;

  const rotation = (mapData.rotation || 0) + 90;

  // Calculate center
  const cx = mapData.x.reduce((a, b) => a + b, 0) / mapData.x.length;
  const cy = mapData.y.reduce((a, b) => a + b, 0) / mapData.y.length;

  // Rotate all points
  const points = mapData.x.map((x, i) => rotatePoint(x, mapData.y[i], rotation, cx, cy));

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(p => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  });
  const pad = 2000;
  const vbX = minX - pad, vbY = minY - pad;
  const vbW = maxX - minX + pad * 2, vbH = maxY - minY + pad * 2;

  // Build path
  const pathD = `M${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L${p.x},${p.y}`).join(' ') + ' Z';

  // Split track into 3 sectors for coloring
  const third = Math.floor(points.length / 3);
  const sector1 = points.slice(0, third + 1);
  const sector2 = points.slice(third, third * 2 + 1);
  const sector3 = [...points.slice(third * 2), points[0]];
  const sectorPath = (pts) => `M${pts[0].x},${pts[0].y} ` + pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ');

  // Rotate corners
  const corners = (mapData.corners || []).map(c => {
    const pos = rotatePoint(c.trackPosition.x, c.trackPosition.y, rotation, cx, cy);
    return { ...c, pos };
  });

  // Start/finish line (first point)
  const startPoint = points[0];

  // Sector colors: blue, yellow, magenta (like F1 official)
  const sectorColors = ['#3b82f6', '#eab308', '#e040a0'];

  return (
    <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} className="real-track-map" preserveAspectRatio="xMidYMid meet">
      {/* Track outline (thick dark background) */}
      <path d={pathD} className="track-outline" />
      {/* Sector 1 - Blue */}
      <path d={sectorPath(sector1)} fill="none" stroke={sectorColors[0]} strokeWidth="260" strokeLinecap="round" strokeLinejoin="round" className="track-sector" />
      {/* Sector 2 - Yellow */}
      <path d={sectorPath(sector2)} fill="none" stroke={sectorColors[1]} strokeWidth="260" strokeLinecap="round" strokeLinejoin="round" className="track-sector" />
      {/* Sector 3 - Magenta */}
      <path d={sectorPath(sector3)} fill="none" stroke={sectorColors[2]} strokeWidth="260" strokeLinecap="round" strokeLinejoin="round" className="track-sector" />
      {/* Start/Finish marker */}
      <circle cx={startPoint.x} cy={startPoint.y} r={600} fill="#00d26a" opacity="0.9" />
      <text x={startPoint.x} y={startPoint.y + 180} textAnchor="middle" fill="white" fontSize="400" fontWeight="700">S</text>
      {/* Corner markers */}
      {corners.map(c => (
        <g key={c.number}>
          <circle cx={c.pos.x} cy={c.pos.y} r={400} className="corner-dot" />
          <text x={c.pos.x} y={c.pos.y + 120} textAnchor="middle" className="corner-label">{c.number}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Fallback Static Track Layout SVG Component ──
function TrackLayout({ circuit }) {
  if (!circuit) return null;
  return (
    <div className="track-layout-container">
      <svg viewBox={circuit.svgViewBox} className="track-svg">
        <path d={circuit.svgPath} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <path d={circuit.svgPath} fill="none" stroke="url(#trackGradient)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="track-path-line" />
        <defs>
          <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e10600" />
            <stop offset="100%" stopColor="#ff8c00" />
          </linearGradient>
        </defs>
        {circuit.turnPositions?.map(t => (
          <g key={t.n}>
            <circle cx={t.x} cy={t.y} r="8" fill="rgba(225,6,0,0.2)" stroke="#e10600" strokeWidth="1" />
            <text x={t.x} y={t.y + 3.5} textAnchor="middle" fontSize="7" fill="#e8e8ee" fontWeight="700" fontFamily="Titillium Web, sans-serif">{t.n}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Circuit Info Panel ──
function CircuitInfo({ circuit, meeting, weather }) {
  if (!circuit) return null;
  return (
    <div className="circuit-sidebar">
      <div className="circuit-sidebar-title">
        <div className="circuit-info-label">Circuit</div>
        <div className="circuit-sidebar-name">{circuit.fullName || meeting?.circuit_short_name}</div>
      </div>

      <div className="circuit-sidebar-stat">
        <div className="circuit-info-label">Circuit Length</div>
        <div className="circuit-sidebar-big">{circuit.length}<span className="circuit-sidebar-unit">km</span></div>
      </div>

      <div className="circuit-sidebar-row">
        <div>
          <div className="circuit-info-label">Turns</div>
          <div className="circuit-sidebar-val">{circuit.turns}</div>
        </div>
        <div>
          <div className="circuit-info-label">Race Laps</div>
          <div className="circuit-sidebar-val">{circuit.raceLaps}</div>
        </div>
      </div>

      <div className="circuit-sidebar-row">
        <div>
          <div className="circuit-info-label">DRS Zones</div>
          <div className="circuit-sidebar-val">{circuit.drsZones}</div>
        </div>
        <div>
          <div className="circuit-info-label">Track Type</div>
          <div className="circuit-sidebar-val">{circuit.type}</div>
        </div>
      </div>

      <div className="circuit-sidebar-stat">
        <div className="circuit-info-label">Fastest Lap Record</div>
        <div className="circuit-sidebar-big">{circuit.lapRecord.time}</div>
        <div className="circuit-sidebar-sub">{circuit.lapRecord.driver} ({circuit.lapRecord.year})</div>
      </div>

      {circuit.qualifyingRecord && (
        <div className="circuit-sidebar-stat">
          <div className="circuit-info-label">Qualifying Record</div>
          <div className="circuit-sidebar-big">{circuit.qualifyingRecord.time}</div>
          <div className="circuit-sidebar-sub">{circuit.qualifyingRecord.driver} ({circuit.qualifyingRecord.year})</div>
        </div>
      )}

      <div className="circuit-sidebar-row">
        <div>
          <div className="circuit-info-label">First Grand Prix</div>
          <div className="circuit-sidebar-val">{circuit.firstGP || '—'}</div>
        </div>
        <div>
          <div className="circuit-info-label">Race Distance</div>
          <div className="circuit-sidebar-val">{circuit.length && circuit.raceLaps ? `${(circuit.length * circuit.raceLaps).toFixed(1)}km` : '—'}</div>
        </div>
      </div>

      {(circuit.mostWins || circuit.mostPoles) && (
        <div className="circuit-sidebar-row">
          {circuit.mostWins && (
            <div>
              <div className="circuit-info-label">Most Wins</div>
              <div className="circuit-sidebar-val">{circuit.mostWins.count}</div>
              <div className="circuit-sidebar-sub">{circuit.mostWins.driver}</div>
            </div>
          )}
          {circuit.mostPoles && (
            <div>
              <div className="circuit-info-label">Most Poles</div>
              <div className="circuit-sidebar-val">{circuit.mostPoles.count}</div>
              <div className="circuit-sidebar-sub">{circuit.mostPoles.driver}</div>
            </div>
          )}
        </div>
      )}

      {/* Weather */}
      {weather && (
        <div className="circuit-weather">
          <div className="circuit-info-label">Weather Conditions</div>
          <div className="weather-grid">
            <div className="weather-item">
              <span className="weather-icon">🌡</span>
              <div>
                <div className="weather-val">{weather.air_temperature != null ? `${weather.air_temperature}°C` : '—'}</div>
                <div className="weather-label">Air Temp</div>
              </div>
            </div>
            <div className="weather-item">
              <span className="weather-icon">🛣</span>
              <div>
                <div className="weather-val">{weather.track_temperature != null ? `${weather.track_temperature}°C` : '—'}</div>
                <div className="weather-label">Track Temp</div>
              </div>
            </div>
            <div className="weather-item">
              <span className="weather-icon">💧</span>
              <div>
                <div className="weather-val">{weather.humidity != null ? `${weather.humidity}%` : '—'}</div>
                <div className="weather-label">Humidity</div>
              </div>
            </div>
            <div className="weather-item">
              <span className="weather-icon">💨</span>
              <div>
                <div className="weather-val">{weather.wind_speed != null ? `${weather.wind_speed} km/h` : '—'}</div>
                <div className="weather-label">Wind</div>
              </div>
            </div>
            <div className="weather-item">
              <span className="weather-icon">🌧</span>
              <div>
                <div className="weather-val">{weather.rainfall != null ? (weather.rainfall ? 'Yes' : 'No') : '—'}</div>
                <div className="weather-label">Rain</div>
              </div>
            </div>
            <div className="weather-item">
              <span className="weather-icon">🌬</span>
              <div>
                <div className="weather-val">{weather.wind_direction != null ? `${weather.wind_direction}°` : '—'}</div>
                <div className="weather-label">Wind Dir</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Podium Display ──
function Podium({ results, driverMap }) {
  if (!results || results.length < 3) return null;
  const podiumOrder = [results[1], results[0], results[2]]; // P2 P1 P3 layout
  const heights = ['110px', '140px', '90px'];
  const colors = ['#c0c0c0', '#ffd700', '#cd7f32'];
  const labels = ['2nd', '1st', '3rd'];

  return (
    <div className="podium-container">
      {podiumOrder.map((r, i) => {
        const d = driverMap[r.driver_number];
        return (
          <div key={r.driver_number} className="podium-slot" style={{ animationDelay: `${i * 150}ms` }}>
            {d?.headshot_url && (
              <img src={d.headshot_url} alt="" className="podium-img" loading="lazy" />
            )}
            <div className="podium-name">{d ? `${d.first_name} ${d.last_name}` : `#${r.driver_number}`}</div>
            <div className="podium-team" style={{ color: d ? `#${d.team_colour}` : 'var(--text-muted)' }}>
              {d?.team_name || ''}
            </div>
            <div className="podium-gap">{fmtGap(r.gap_to_leader)}</div>
            <div className="podium-block" style={{ height: heights[i], background: `linear-gradient(180deg, ${colors[i]}33, ${colors[i]}11)`, borderTop: `3px solid ${colors[i]}` }}>
              <span className="podium-position" style={{ color: colors[i] }}>{labels[i]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lap Time Chart (pure SVG) ──
function LapTimeChart({ lapData, driverMap }) {
  if (!lapData || Object.keys(lapData).length === 0) return null;

  const drivers = Object.keys(lapData).slice(0, 5);
  const chartW = 600, chartH = 200, padL = 40, padR = 10, padT = 10, padB = 30;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  // Get all valid lap times
  let allTimes = [];
  let maxLaps = 0;
  drivers.forEach(dn => {
    const laps = lapData[dn].filter(l => l.lap_duration && l.lap_duration > 0);
    laps.forEach(l => allTimes.push(l.lap_duration));
    maxLaps = Math.max(maxLaps, laps.length);
  });

  if (allTimes.length === 0 || maxLaps === 0) return null;

  // Filter to reasonable range (exclude outliers like pit laps)
  allTimes.sort((a, b) => a - b);
  const median = allTimes[Math.floor(allTimes.length / 2)];
  const minT = Math.max(median * 0.95, allTimes[0]);
  const maxT = Math.min(median * 1.08, allTimes[allTimes.length - 1]);

  const teamColors = ['#e10600', '#00d4ff', '#ffd700', '#00d26a', '#a855f7'];

  return (
    <div className="lap-chart-container">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="lap-chart-svg">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <g key={i}>
            <line
              x1={padL} y1={padT + innerH * pct}
              x2={padL + innerW} y2={padT + innerH * pct}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1"
            />
            <text x={padL - 5} y={padT + innerH * pct + 4} textAnchor="end" fontSize="8" fill="var(--text-dim)" fontFamily="Titillium Web">
              {fmtLap(minT + (maxT - minT) * pct)}
            </text>
          </g>
        ))}

        {/* Driver lines */}
        {drivers.map((dn, dIdx) => {
          const laps = lapData[dn].filter(l => l.lap_duration && l.lap_duration > 0 && l.lap_duration >= minT && l.lap_duration <= maxT);
          if (laps.length < 2) return null;
          
          const teamName = driverMap[Number(dn)]?.team_name || '';
          const sameTeamIndex = drivers.slice(0, dIdx).filter(prevDn => driverMap[Number(prevDn)]?.team_name === teamName).length;
          
          const color = driverMap[Number(dn)]?.team_colour ? `#${driverMap[Number(dn)].team_colour}` : teamColors[dIdx];
          const dash = sameTeamIndex > 0 ? '4 4' : 'none'; // Distinguish teammates
          
          const points = laps.map((l, i) => {
            const x = padL + (l.lap_number / maxLaps) * innerW;
            const y = padT + ((l.lap_duration - minT) / (maxT - minT)) * innerH;
            return `${x},${y}`;
          }).join(' ');
          return (
            <polyline
              key={dn}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeDasharray={dash}
              strokeLinejoin="round"
              opacity="0.8"
            />
          );
        })}
      </svg>
      {/* Legend */}
      <div className="lap-chart-legend">
        {drivers.map((dn, i) => {
          const d = driverMap[Number(dn)];
          const teamName = d?.team_name || '';
          const sameTeamIndex = drivers.slice(0, i).filter(prevDn => driverMap[Number(prevDn)]?.team_name === teamName).length;
          const color = d?.team_colour ? `#${d.team_colour}` : teamColors[i];
          
          return (
            <div key={dn} className="lap-chart-legend-item">
              <span style={{ 
                width: 12, height: 3, 
                borderRadius: 2, 
                display: 'inline-block',
                borderStyle: sameTeamIndex > 0 ? 'dashed' : 'solid',
                borderColor: color,
                borderWidth: '1.5px 0 0 0',
                background: sameTeamIndex > 0 ? 'transparent' : color
              }} />
              <span>{d?.name_acronym || `#${dn}`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tyre Strategy ──
function TyreStrategy({ stintData, driverMap, results }) {
  if (!stintData || stintData.length === 0 || !results) return null;

  // Group stints by driver, ordered by position
  const resultOrder = results.slice(0, 10).map(r => r.driver_number);
  const stintsByDriver = {};
  stintData.forEach(s => {
    if (!stintsByDriver[s.driver_number]) stintsByDriver[s.driver_number] = [];
    stintsByDriver[s.driver_number].push(s);
  });

  const compoundColors = {
    SOFT: '#e10600',
    MEDIUM: '#ffd700',
    HARD: '#e8e8ee',
    INTERMEDIATE: '#00d26a',
    WET: '#00d4ff',
  };

  return (
    <div className="tyre-strategy-container">
      {resultOrder.map(dn => {
        const stints = stintsByDriver[dn];
        if (!stints || stints.length === 0) return null;
        const d = driverMap[dn];
        const totalLaps = stints.reduce((sum, s) => sum + (s.lap_end - s.lap_start + 1), 0);
        return (
          <div key={dn} className="tyre-row">
            <div className="tyre-driver">
              <span className="tyre-driver-name">{d?.name_acronym || `#${dn}`}</span>
            </div>
            <div className="tyre-bar-track">
              {stints.map((s, i) => {
                const laps = s.lap_end - s.lap_start + 1;
                const pct = (laps / totalLaps) * 100;
                const compound = (s.compound || 'UNKNOWN').toUpperCase();
                const color = compoundColors[compound] || '#555';
                return (
                  <div
                    key={i}
                    className="tyre-bar-segment"
                    style={{ width: `${pct}%`, background: color }}
                    title={`${compound}: Lap ${s.lap_start}–${s.lap_end} (${laps} laps)`}
                  >
                    {pct > 15 && <span className="tyre-bar-label">{compound[0]}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="tyre-legend">
        {Object.entries(compoundColors).slice(0, 3).map(([name, color]) => (
          <div key={name} className="tyre-legend-item">
            <span className="tyre-legend-dot" style={{ background: color }} />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Driver Race Modal (click on result row) ──
function DriverRaceModal({ result, driverMap, gridMap, lapData, stintData, maxLaps, onClose }) {
  const [closing, setClosing] = useState(false);
  const d = driverMap[result.driver_number];
  const teamColor = d ? `#${d.team_colour}` : '#555';

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const gridPos = gridMap[result.driver_number];
  const posGain = gridPos && result.position ? gridPos - result.position : null;
  const isRetired = result.dnf || (result.number_of_laps > 0 && result.number_of_laps < maxLaps * 0.9 && !result.position);

  const driverLaps = lapData[result.driver_number] || [];
  const lapTimes = driverLaps.filter(l => l.lap_duration > 0).map(l => l.lap_duration);
  const bestLap = lapTimes.length ? Math.min(...lapTimes) : null;
  const avgLap = lapTimes.length ? lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length : null;

  const driverStints = (stintData || []).filter(s => s.driver_number === result.driver_number);
  const compoundColors = { SOFT: '#e10600', MEDIUM: '#ffd700', HARD: '#e8e8ee', INTERMEDIATE: '#00d26a', WET: '#00d4ff' };

  const fastestLaps = [...driverLaps].filter(l => l.lap_duration > 0).sort((a, b) => a.lap_duration - b.lap_duration).slice(0, 5);

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={handleClose}>
      <div className={`modal-content${closing ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>×</button>

        <div className="modal-header">
          {d?.headshot_url ? (
            <img src={d.headshot_url} alt="" className="modal-header-img" style={{ borderColor: teamColor }} />
          ) : (
            <div className="modal-header-img" style={{ background: 'var(--bg-dark)', borderColor: teamColor }} />
          )}
          <div className="modal-header-info">
            <div className="modal-header-name">{d ? d.full_name : `#${result.driver_number}`}</div>
            <div className="modal-header-sub">{d?.team_name} · #{result.driver_number}</div>
            <div className="modal-header-badge" style={{
              background: isRetired ? 'rgba(225,6,0,0.15)' : 'rgba(0,210,106,0.15)',
              color: isRetired ? 'var(--f1-red)' : 'var(--green)',
              border: `1px solid ${isRetired ? 'rgba(225,6,0,0.3)' : 'rgba(0,210,106,0.3)'}`,
            }}>
              {isRetired ? 'DNF' : result.position ? `P${result.position}` : 'Finished'}
            </div>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-section-title">Race Performance</div>
            <div className="modal-stats-grid">
              <div className="modal-stat-card">
                <div className="modal-stat-val">{result.position || '—'}</div>
                <div className="modal-stat-label">Finish</div>
              </div>
              <div className="modal-stat-card">
                <div className="modal-stat-val">{gridPos || '—'}</div>
                <div className="modal-stat-label">Grid</div>
              </div>
              <div className="modal-stat-card">
                <div className="modal-stat-val" style={{
                  color: posGain > 0 ? 'var(--green)' : posGain < 0 ? 'var(--f1-red)' : 'var(--text-muted)'
                }}>
                  {posGain !== null ? (posGain > 0 ? `+${posGain}` : `${posGain}`) : '—'}
                </div>
                <div className="modal-stat-label">Gained</div>
              </div>
              <div className="modal-stat-card">
                <div className="modal-stat-val">{result.number_of_laps || '—'}</div>
                <div className="modal-stat-label">Laps</div>
              </div>
              <div className="modal-stat-card">
                <div className="modal-stat-val">{fmtLap(bestLap)}</div>
                <div className="modal-stat-label">Best Lap</div>
              </div>
              <div className="modal-stat-card">
                <div className="modal-stat-val">{fmtLap(avgLap)}</div>
                <div className="modal-stat-label">Avg Lap</div>
              </div>
            </div>
          </div>

          {result.gap_to_leader != null && (
            <div className="modal-section">
              <div className="modal-section-title">Gap to Leader</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: teamColor, fontFamily: 'monospace' }}>
                {fmtGap(result.gap_to_leader)}
              </div>
            </div>
          )}

          {driverStints.length > 0 && (
            <div className="modal-section">
              <div className="modal-section-title">Tyre Strategy</div>
              <div className="modal-lap-mini">
                {driverStints.map((s, i) => {
                  const compound = (s.compound || 'UNKNOWN').toUpperCase();
                  const c = compoundColors[compound] || '#555';
                  const laps = s.lap_end - s.lap_start + 1;
                  return (
                    <div key={i} className="modal-lap-chip" style={{ borderColor: c }}>
                      <span style={{ color: c, fontWeight: 700 }}>{compound}</span>
                      <span className="modal-lap-chip-label">Lap {s.lap_start}–{s.lap_end} ({laps})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {fastestLaps.length > 0 && (
            <div className="modal-section">
              <div className="modal-section-title">Fastest Laps</div>
              <div className="modal-lap-mini">
                {fastestLaps.map((l, i) => (
                  <div key={i} className="modal-lap-chip" style={i === 0 ? { borderColor: 'var(--f1-red)', background: 'rgba(225,6,0,0.05)' } : {}}>
                    <span className="modal-lap-chip-label">Lap {l.lap_number}</span>
                    <span style={{ fontWeight: 700, color: i === 0 ? 'var(--f1-red)' : 'var(--text)' }}>{fmtLap(l.lap_duration)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════
// MAIN RACE DETAIL PAGE
// ═══════════════════════════════════════
export default function RaceDetail() {
  const { meetingKey } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [raceSession, setRaceSession] = useState(null);
  const [results, setResults] = useState([]);
  const [grid, setGrid] = useState([]);
  const [overtakeData, setOvertakeData] = useState([]);
  const [lapData, setLapData] = useState({});
  const [stintData, setStintData] = useState([]);
  const [driverMap, setDriverMap] = useState({});
  const [mapData, setMapData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [selectedResult, setSelectedResult] = useState(null);
  const [allLapData, setAllLapData] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Get meeting & sessions info
        const [meetingsData, sessionsData, driverData] = await Promise.all([
          api.meetings(),
          api.sessionsForMeeting(meetingKey),
          api.drivers(),
        ]);

        if (cancelled) return;

        const mtg = meetingsData.find(m => String(m.meeting_key) === String(meetingKey));
        setMeeting(mtg);

        // Fetch real circuit map if circuit_key is available
        if (mtg?.circuit_key) {
          api.circuitMap(mtg.circuit_key, mtg.year).then(setMapData).catch(() => {});
        }

        const drMap = {};
        driverData.forEach(d => { drMap[d.driver_number] = d; });
        setDriverMap(drMap);

        setSessions(sessionsData);

        // Find race session (prefer 'Race', fallback to last session)
        const race = sessionsData.find(s => s.session_name === 'Race')
          || sessionsData.find(s => s.session_name === 'Sprint')
          || sessionsData[sessionsData.length - 1];
        setRaceSession(race);

        if (race) {
          // 2. Get all race data in parallel
          const [resultData, gridDataRaw, overtakes, laps, stints, weatherRaw] = await Promise.all([
            api.sessionResult(race.session_key).catch(() => []),
            api.startingGrid(race.session_key).catch(() => []),
            api.overtakes(race.session_key).catch(() => []),
            api.laps(race.session_key).catch(() => []),
            api.stints(race.session_key).catch(() => []),
            api.weather(race.session_key).catch(() => []),
          ]);

          // Get the latest weather reading
          if (Array.isArray(weatherRaw) && weatherRaw.length > 0) {
            setWeatherData(weatherRaw[weatherRaw.length - 1]);
          }

          let finalGridData = gridDataRaw;
          // Fallback to Qualifying results if starting_grid endpoint failed
          if (!Array.isArray(finalGridData) || finalGridData.length === 0) {
            const qualiSession = sessionsData.find(s => s.session_name === 'Qualifying');
            if (qualiSession) {
              const qualiRes = await api.sessionResult(qualiSession.session_key).catch(() => []);
              if (Array.isArray(qualiRes) && qualiRes.length > 0) {
                finalGridData = qualiRes;
              }
            }
          }

          // Sort results by position
          const sortedResults = Array.isArray(resultData)
            ? resultData.sort((a, b) => (a.position || 99) - (b.position || 99))
            : [];
          setResults(sortedResults);

          const sortedGrid = Array.isArray(finalGridData)
            ? finalGridData.sort((a, b) => (a.position || 99) - (b.position || 99))
            : [];
          setGrid(sortedGrid);

          setOvertakeData(Array.isArray(overtakes) ? overtakes : []);
          setStintData(Array.isArray(stints) ? stints : []);

          // Group laps by driver for chart (top 5 finishers) + all laps for modal
          const top5 = sortedResults.slice(0, 5).map(r => r.driver_number);
          const lapsByDriver = {};
          const allLapsByDriver = {};
          (Array.isArray(laps) ? laps : []).forEach(l => {
            if (!allLapsByDriver[l.driver_number]) allLapsByDriver[l.driver_number] = [];
            allLapsByDriver[l.driver_number].push(l);
            if (top5.includes(l.driver_number)) {
              if (!lapsByDriver[l.driver_number]) lapsByDriver[l.driver_number] = [];
              lapsByDriver[l.driver_number].push(l);
            }
          });
          setLapData(lapsByDriver);
          setAllLapData(allLapsByDriver);
        }

        setStatus('ok');
      } catch (e) {
        console.error('RaceDetail load error:', e);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [meetingKey]);

  if (status === 'loading') return <Loading text="Loading race data..." />;
  if (status === 'error') return <ErrorMsg text="Failed to load race data." />;

  const circuit = getCircuitData(meeting?.circuit_short_name);

  // Build grid position map for position-gained comparison
  const gridMap = {};
  grid.forEach(g => { gridMap[g.driver_number] = g.position; });

  // Detect retirements: DNF or completed significantly fewer laps than leader
  const maxLaps = results.length > 0 ? Math.max(...results.map(r => r.number_of_laps || 0)) : 0;
  const retirements = results.filter(r => r.dnf || r.dns || (r.number_of_laps > 0 && r.number_of_laps < maxLaps * 0.9 && !r.position)).length;
  const dnsList = results.filter(r => r.dns);

  // Overtake stats
  const totalOvertakes = overtakeData.length;
  const overtakesByDriver = {};
  overtakeData.forEach(o => {
    overtakesByDriver[o.overtaking_driver_number] = (overtakesByDriver[o.overtaking_driver_number] || 0) + 1;
  });
  const topOvertakers = Object.entries(overtakesByDriver)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="race-detail-page">
      {/* Header */}
      <div className="page-header">
        <Link to="/calendar" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← Calendar
        </Link>
      </div>
      <div className="race-detail-header">
        <div>
          <h1 className="page-title">{meeting?.meeting_name || 'Race'}</h1>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {meeting?.circuit_short_name} — {meeting?.location}, {meeting?.country_name}
          </div>
          {meeting?.date_start && (
            <div style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>
              {formatDateFull(meeting.date_start)}
            </div>
          )}
        </div>
        {raceSession && (
          <div className="season-badge">{raceSession.session_name}</div>
        )}
      </div>

      {/* Top section: Track Map (large) + Circuit Info sidebar */}
      <div className="race-detail-top">
        {(mapData || circuit) && (
          <div className="card circuit-map-card" style={{ animationDelay: '0ms' }}>
            <div className="card-header">
              <span className="card-title">{circuit?.fullName || mapData?.circuitName || 'Circuit'}</span>
              <span className="card-badge">{circuit?.type || ''} Circuit</span>
            </div>
            <div className="card-body circuit-map-body">
              {mapData ? <RealTrackMap mapData={mapData} /> : <TrackLayout circuit={circuit} />}
              <div className="sector-legend">
                <div className="sector-legend-item"><span className="sector-dot" style={{ background: '#3b82f6' }} />Sector 1</div>
                <div className="sector-legend-item"><span className="sector-dot" style={{ background: '#eab308' }} />Sector 2</div>
                <div className="sector-legend-item"><span className="sector-dot" style={{ background: '#e040a0' }} />Sector 3</div>
              </div>
            </div>
          </div>
        )}

        {circuit && (
          <div className="card" style={{ animationDelay: '50ms' }}>
            <div className="card-body" style={{ padding: '1.25rem' }}>
              <CircuitInfo circuit={circuit} meeting={meeting} weather={weatherData} />
            </div>
          </div>
        )}
      </div>

      {/* Podium */}
      {results.length >= 3 && (
        <div className="card" style={{ animation: 'cardEntrance 0.6s var(--ease-out-expo) 0.1s both', marginBottom: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Podium</span>
          </div>
          <div className="card-body" style={{ padding: '1.5rem' }}>
            <Podium results={results} driverMap={driverMap} />
          </div>
        </div>
      )}

      {/* Full Race Results */}
      {results.length > 0 && (
        <div className="card" style={{ animation: 'cardEntrance 0.6s var(--ease-out-expo) 0.2s both' }}>
          <div className="card-header">
            <span className="card-title">Race Results</span>
            <span className="card-badge">{results.length} Drivers</span>
          </div>
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-pos">Fin</th>
                  <th>Driver</th>
                  <th>Team</th>
                  <th>Grid</th>
                  <th className="col-pts">+/-</th>
                  <th>Gap</th>
                  <th>Laps</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => {
                  const d = driverMap[r.driver_number];
                  const gridPos = gridMap[r.driver_number];
                  const posGain = gridPos && r.position ? gridPos - r.position : null;
                  const isRetired = r.dnf || (r.number_of_laps > 0 && r.number_of_laps < maxLaps * 0.9 && !r.position);
                  const statusText = isRetired ? 'DNF' : r.dsq ? 'DSQ' : r.dns ? 'DNS' : 'Finished';
                  const statusColor = isRetired || r.dsq || r.dns ? 'var(--f1-red)' : 'var(--green)';
                  return (
                    <tr key={r.driver_number} className="clickable-row" onClick={() => setSelectedResult(r)} title="Click for detailed race stats">
                      <td className="col-pos" style={{ fontWeight: 700 }}>{r.position}</td>
                      <td>
                        <div className="driver-cell">
                          <span className="team-dot" style={{ background: d ? `#${d.team_colour}` : '#555' }} />
                          {d?.headshot_url && <img className="driver-headshot" src={d.headshot_url} alt="" loading="lazy" />}
                          <span className="driver-info-name">{d ? `${d.first_name} ${d.last_name}` : `#${r.driver_number}`}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d?.team_name || ''}</td>
                      <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>{gridPos || '—'}</td>
                      <td className="col-pts" style={{
                        color: posGain > 0 ? 'var(--green)' : posGain < 0 ? 'var(--f1-red)' : 'var(--text-muted)',
                        fontWeight: 700,
                      }}>
                        {posGain !== null ? (posGain > 0 ? `▲${posGain}` : posGain < 0 ? `▼${Math.abs(posGain)}` : '—') : '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{fmtGap(r.gap_to_leader)}</td>
                      <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>{r.number_of_laps || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: statusColor, fontWeight: 600 }}>{statusText}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom grid: Lap Chart + Overtakes + Tyre Strategy */}
      <div className="race-detail-bottom">
        {/* Lap Time Chart */}
        {Object.keys(lapData).length > 0 && (
          <div className="card" style={{ animationDelay: '300ms' }}>
            <div className="card-header">
              <span className="card-title">Lap Times — Top 5</span>
            </div>
            <div className="card-body" style={{ padding: '1.25rem' }}>
              <LapTimeChart lapData={lapData} driverMap={driverMap} />
            </div>
          </div>
        )}

        {/* Overtakes + Stats */}
        <div className="card" style={{ animationDelay: '400ms' }}>
          <div className="card-header">
            <span className="card-title">Race Stats</span>
          </div>
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div className="race-stats-grid">
              <div className="race-stat-big">
                <div className="race-stat-big-value">{totalOvertakes}</div>
                <div className="race-stat-big-label">Total Overtakes</div>
              </div>
              <div className="race-stat-big">
                <div className="race-stat-big-value">{retirements}</div>
                <div className="race-stat-big-label">Retirements</div>
              </div>
              <div className="race-stat-big">
                <div className="race-stat-big-value">{sessions.length}</div>
                <div className="race-stat-big-label">Sessions</div>
              </div>
            </div>
            {topOvertakers.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Top Overtakers
                </div>
                {topOvertakers.map(([dn, count]) => {
                  const d = driverMap[Number(dn)];
                  return (
                    <div key={dn} className="detail-lap-row" style={{ alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {d?.headshot_url && <img src={d.headshot_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} loading="lazy" />}
                        {d?.name_acronym || `#${dn}`}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--f1-red)' }}>{count} passes</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tyre Strategy */}
      {stintData.length > 0 && results.length > 0 && (
        <div className="card" style={{ animation: 'cardEntrance 0.6s var(--ease-out-expo) 0.5s both' }}>
          <div className="card-header">
            <span className="card-title">Tyre Strategy</span>
            <span className="card-badge">Top 10</span>
          </div>
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <TyreStrategy stintData={stintData} driverMap={driverMap} results={results} />
          </div>
        </div>
      )}

      {/* Driver Race Modal */}
      {selectedResult && (
        <DriverRaceModal
          result={selectedResult}
          driverMap={driverMap}
          gridMap={gridMap}
          lapData={allLapData}
          stintData={stintData}
          maxLaps={maxLaps}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
}
