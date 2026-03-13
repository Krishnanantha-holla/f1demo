import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getCircuitData } from '../circuitData';
import { Loading, ErrorMsg, formatDate, formatDateFull } from '../components/Shared';

// ── Helper: rotate point for track map ──
function rotatePoint(x, y, angle, cx, cy) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: dx * cos - dy * sin + cx, y: dy * cos + dx * sin + cy };
}

// ── Mini Track Map (real data from MultiViewer) ──
function MiniTrackMap({ mapData }) {
  if (!mapData || !mapData.x || mapData.x.length === 0) return null;
  const rotation = (mapData.rotation || 0) + 90;
  const cx = mapData.x.reduce((a, b) => a + b, 0) / mapData.x.length;
  const cy = mapData.y.reduce((a, b) => a + b, 0) / mapData.y.length;
  const points = mapData.x.map((x, i) => rotatePoint(x, mapData.y[i], rotation, cx, cy));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  const pad = 2000;
  const pathD = `M${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L${p.x},${p.y}`).join(' ') + ' Z';
  return (
    <svg viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`} className="cal-mini-track-svg" preserveAspectRatio="xMidYMid meet">
      <path d={pathD} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="700" strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathD} fill="none" stroke="url(#calTrackGrad)" strokeWidth="350" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="calTrackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e10600" />
          <stop offset="100%" stopColor="#ff8c00" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Fallback Mini Track from circuitData SVG ──
function MiniTrackFallback({ circuit }) {
  if (!circuit?.svgPath) return null;
  return (
    <svg viewBox={circuit.svgViewBox} className="cal-mini-track-svg" preserveAspectRatio="xMidYMid meet">
      <path d={circuit.svgPath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d={circuit.svgPath} fill="none" stroke="url(#calTrackFallback)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="calTrackFallback" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e10600" />
          <stop offset="100%" stopColor="#ff8c00" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Race Detail Modal ──
function RaceModal({ meeting, sessions, podium, driverMap, mapData, onClose }) {
  const [closing, setClosing] = useState(false);
  const past = new Date(meeting.date_end || meeting.date_start) < new Date();
  const circuit = getCircuitData(meeting.circuit_short_name);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const podiumLabels = ['🥇', '🥈', '🥉'];

  return (
    <div className={`modal-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`modal-content ${closing ? 'closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <button className="modal-close" onClick={handleClose}>✕</button>
        <div className="modal-header">
          <h2>{meeting.meeting_name}</h2>
          <span className="modal-subtitle">{meeting.location}, {meeting.country_name}</span>
        </div>
        <div className="modal-body">
          {/* Circuit Map */}
          {(mapData || circuit) && (
            <div className="cal-modal-map">
              {mapData ? <MiniTrackMap mapData={mapData} /> : <MiniTrackFallback circuit={circuit} />}
            </div>
          )}

          {/* Date & Circuit Info */}
          <div className="modal-section">
            <div className="modal-stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="modal-stat-card">
                <div className="modal-stat-label">Dates</div>
                <div className="modal-stat-val" style={{ fontSize: '0.9rem' }}>
                  {formatDate(meeting.date_start)} — {formatDate(meeting.date_end || meeting.date_start)}
                </div>
              </div>
              <div className="modal-stat-card">
                <div className="modal-stat-label">Circuit</div>
                <div className="modal-stat-val" style={{ fontSize: '0.9rem' }}>
                  {circuit?.fullName || meeting.circuit_short_name || meeting.location}
                </div>
              </div>
            </div>
          </div>

          {/* Circuit Stats */}
          {circuit && (
            <div className="modal-section">
              <h4 className="modal-section-title">Circuit Info</h4>
              <div className="modal-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="modal-stat-card">
                  <div className="modal-stat-val">{circuit.length} km</div>
                  <div className="modal-stat-label">Length</div>
                </div>
                <div className="modal-stat-card">
                  <div className="modal-stat-val">{circuit.turns}</div>
                  <div className="modal-stat-label">Turns</div>
                </div>
                <div className="modal-stat-card">
                  <div className="modal-stat-val">{circuit.raceLaps}</div>
                  <div className="modal-stat-label">Laps</div>
                </div>
                <div className="modal-stat-card">
                  <div className="modal-stat-val">{circuit.drsZones}</div>
                  <div className="modal-stat-label">DRS Zones</div>
                </div>
                <div className="modal-stat-card">
                  <div className="modal-stat-val">{circuit.type}</div>
                  <div className="modal-stat-label">Type</div>
                </div>
                <div className="modal-stat-card">
                  <div className="modal-stat-val">{circuit.firstGP}</div>
                  <div className="modal-stat-label">First GP</div>
                </div>
              </div>
              {circuit.lapRecord && (
                <div className="cal-modal-record">
                  <span className="cal-modal-record-label">Lap Record</span>
                  <span className="cal-modal-record-time">{circuit.lapRecord.time}</span>
                  <span className="cal-modal-record-driver">{circuit.lapRecord.driver} ({circuit.lapRecord.year})</span>
                </div>
              )}
            </div>
          )}

          {/* Podium for past races */}
          {past && podium.length >= 3 && (
            <div className="modal-section">
              <h4 className="modal-section-title">Podium</h4>
              <div className="cal-modal-podium">
                {podium.map((r, i) => {
                  const d = driverMap[r.driver_number];
                  return (
                    <div key={r.driver_number} className="cal-modal-podium-slot">
                      <span className="cal-modal-medal">{podiumLabels[i]}</span>
                      {d?.headshot_url && <img src={d.headshot_url} alt="" className="cal-modal-headshot" loading="lazy" />}
                      <span className="cal-modal-driver-name">{d ? `${d.first_name} ${d.last_name}` : `#${r.driver_number}`}</span>
                      <span className="cal-modal-team" style={{ color: d ? `#${d.team_colour}` : 'var(--text-muted)' }}>
                        {d?.team_name || ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Session Schedule */}
          <div className="modal-section">
            <h4 className="modal-section-title">Session Schedule</h4>
            {sessions.length > 0 ? (
              <div className="cal-sessions-list">
                {sessions.map(s => (
                  <div key={s.session_key} className="cal-sess-row">
                    <span className="cal-sess-name">{s.session_name}</span>
                    <span className="cal-sess-date">
                      {new Date(s.date_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' · '}
                      {new Date(s.date_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                Session schedule not yet available
              </div>
            )}
          </div>

          {/* Link to full race page */}
          <Link
            to={`/race/${meeting.meeting_key}`}
            className="cal-results-btn"
            style={{ display: 'block', textAlign: 'center', marginTop: '0.5rem' }}
          >
            {past && podium.length > 0 ? 'View Full Results →' : 'View Race Details →'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const [meetings, setMeetings] = useState([]);
  const [sessions, setSessions] = useState({});
  const [results, setResults] = useState({});
  const [driverMap, setDriverMap] = useState({});
  const [mapDataByKey, setMapDataByKey] = useState({});
  const [status, setStatus] = useState('loading');
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, driverData] = await Promise.all([api.meetings(), api.drivers()]);
        m.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
        setMeetings(m);

        const drMap = {};
        driverData.forEach(d => { drMap[d.driver_number] = d; });
        setDriverMap(drMap);

        const now = new Date();
        const sessByMeeting = {};
        const resultsByMeeting = {};
        const mapByKey = {};

        await Promise.all(
          m.map(async mtg => {
            try {
              const s = await api.sessionsForMeeting(mtg.meeting_key);
              sessByMeeting[mtg.meeting_key] = s.sort(
                (a, b) => new Date(a.date_start) - new Date(b.date_start)
              );

              // Fetch circuit map
              if (mtg.circuit_key) {
                try {
                  const md = await api.circuitMap(mtg.circuit_key, mtg.year);
                  if (md && md.x) mapByKey[mtg.meeting_key] = md;
                } catch {}
              }

              // For past races, fetch podium results
              const endDate = s.length
                ? s[s.length - 1].date_end || s[s.length - 1].date_start
                : mtg.date_start;
              if (new Date(endDate) < now) {
                const raceSession = s.find(x => x.session_name === 'Race')
                  || s.find(x => x.session_name === 'Sprint')
                  || s[s.length - 1];
                if (raceSession) {
                  try {
                    const res = await api.sessionResult(raceSession.session_key);
                    if (Array.isArray(res) && res.length > 0) {
                      resultsByMeeting[mtg.meeting_key] = res
                        .sort((a, b) => (a.position || 99) - (b.position || 99))
                        .slice(0, 3);
                    }
                  } catch {}
                }
              }
            } catch {
              sessByMeeting[mtg.meeting_key] = [];
            }
          })
        );

        setSessions(sessByMeeting);
        setResults(resultsByMeeting);
        setMapDataByKey(mapByKey);
        setStatus('ok');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  function isPast(dateStr) {
    return new Date(dateStr) < new Date();
  }

  function getEndDate(m) {
    const sess = sessions[m.meeting_key] || [];
    if (sess.length) return sess[sess.length - 1].date_end || sess[sess.length - 1].date_start;
    return m.date_start;
  }

  // Season stats
  const totalRaces = meetings.length;
  const completedRaces = meetings.filter(m => isPast(getEndDate(m))).length;
  const remainingRaces = totalRaces - completedRaces;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Race Calendar</h1>
        <span className="season-badge">Season {new Date().getFullYear()}</span>
      </div>

      {status === 'loading' && <Loading text="Loading calendar..." />}
      {status === 'error' && <ErrorMsg text="Failed to load calendar." />}
      {status === 'ok' && (
        <>
          {/* Season progress bar */}
          <div className="cal-season-progress">
            <div className="cal-progress-stats">
              <span>{completedRaces} of {totalRaces} races completed</span>
              <span>{remainingRaces} remaining</span>
            </div>
            <div className="cal-progress-bar">
              <div className="cal-progress-fill" style={{ width: `${(completedRaces / totalRaces) * 100}%` }} />
            </div>
          </div>

          <div className="cal-grid">
            {meetings.map((m, i) => {
              const past = isPast(getEndDate(m));
              const next = !past && (i === 0 || isPast(getEndDate(meetings[i - 1])));
              const podium = results[m.meeting_key] || [];
              const circuit = getCircuitData(m.circuit_short_name);
              const mapData = mapDataByKey[m.meeting_key];
              const mSessions = sessions[m.meeting_key] || [];
              let cls = 'cal-card';
              if (past) cls += ' past';
              if (next) cls += ' next-up';
              return (
                <div
                  key={m.meeting_key}
                  className={cls}
                  onClick={() => setSelectedMeeting(m)}
                  style={{ animationDelay: `${Math.min(i * 40, 600)}ms` }}
                >
                  {next && <div className="cal-next-badge">Next Race</div>}

                  {/* Mini circuit map background */}
                  <div className="cal-card-map-bg">
                    {mapData ? <MiniTrackMap mapData={mapData} /> : circuit && <MiniTrackFallback circuit={circuit} />}
                  </div>

                  <div className="cal-card-content">
                    <div className="cal-round">Round {i + 1}</div>
                    <div className="cal-name">{m.meeting_name}</div>
                    <div className="cal-location">{m.location}, {m.country_name}</div>
                    <div className="cal-dates">{formatDate(m.date_start)} — {formatDate(getEndDate(m))}</div>

                    {/* Circuit info chips */}
                    {circuit && (
                      <div className="cal-circuit-chips">
                        <span className="cal-chip">{circuit.length} km</span>
                        <span className="cal-chip">{circuit.turns} turns</span>
                        <span className="cal-chip">{circuit.type}</span>
                      </div>
                    )}

                    {/* Session schedule mini */}
                    {mSessions.length > 0 && (
                      <div className="cal-card-sessions">
                        {mSessions.slice(0, 3).map(s => (
                          <div key={s.session_key} className="cal-card-sess">
                            <span className="cal-card-sess-name">{s.session_name}</span>
                            <span className="cal-card-sess-date">
                              {new Date(s.date_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ))}
                        {mSessions.length > 3 && (
                          <div className="cal-card-sess cal-card-sess-more">+{mSessions.length - 3} more</div>
                        )}
                      </div>
                    )}

                    {/* Mini podium inline for past races */}
                    {past && podium.length >= 3 && (
                      <div className="cal-mini-podium">
                        {podium.map((r, pi) => {
                          const d = driverMap[r.driver_number];
                          return (
                            <div key={r.driver_number} className="cal-podium-entry">
                              <span className="cal-podium-medal">{['🥇','🥈','🥉'][pi]}</span>
                              <span className="cal-podium-name" style={{ color: d ? `#${d.team_colour}` : 'var(--text-muted)' }}>
                                {d?.name_acronym || `#${r.driver_number}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="click-hint">Click for details →</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedMeeting && (
        <RaceModal
          meeting={selectedMeeting}
          sessions={sessions[selectedMeeting.meeting_key] || []}
          podium={results[selectedMeeting.meeting_key] || []}
          driverMap={driverMap}
          mapData={mapDataByKey[selectedMeeting.meeting_key]}
          onClose={() => setSelectedMeeting(null)}
        />
      )}
    </>
  );
}
