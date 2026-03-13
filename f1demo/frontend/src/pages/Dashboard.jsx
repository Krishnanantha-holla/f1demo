import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Loading, ErrorMsg, EmptyMsg, formatDate, formatDateFull, pad } from '../components/Shared';

// ── Live Banner ──
function LiveBanner() {
  const [mode, setMode] = useState('idle');
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        const modeData = await api.sessionMode();
        setMode(modeData.mode || 'idle');
        if (modeData.mode === 'live') {
          if (modeData.session) {
            setSessionInfo(modeData.session);
          } else {
            const sess = await api.sessions();
            if (Array.isArray(sess) && sess.length) setSessionInfo(sess[0]);
          }
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  if (mode !== 'live') return null;

  return (
    <div className="live-banner">
      <span className="live-dot" />
      <span className="live-text">
        LIVE: {sessionInfo ? `${sessionInfo.session_name} — ${sessionInfo.circuit_short_name}` : 'Session in progress'}
      </span>
    </div>
  );
}

function getCountdown(targetDate) {
  const diff = new Date(targetDate) - new Date();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins: Math.floor((diff / 60000) % 60),
    secs: Math.floor((diff / 1000) % 60),
  };
}

// ── Next Race Card ──
function NextRace({ meeting }) {
  const [cd, setCd] = useState(meeting ? getCountdown(meeting.date_start) : null);

  useEffect(() => {
    if (!meeting) return;
    const id = setInterval(() => setCd(getCountdown(meeting.date_start)), 1000);
    return () => clearInterval(id);
  }, [meeting]);

  if (!meeting) {
    return (
      <div className="card next-race-card">
        <div className="next-race-content">
          <div className="next-race-label">Season Complete</div>
          <div className="next-race-name">No upcoming races</div>
        </div>
      </div>
    );
  }

  return (
    <Link to={`/race/${meeting.meeting_key}`} className="card next-race-card clickable" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="next-race-content">
        <div className="next-race-label">Next Race</div>
        <div className="next-race-name">{meeting.meeting_name}</div>
        <div className="next-race-circuit">
          {meeting.circuit_short_name} — {meeting.location}, {meeting.country_name}
        </div>
        <div className="next-race-meta">
          <div>
            <div className="meta-item-label">Date</div>
            <div className="meta-item-value">{formatDateFull(meeting.date_start)}</div>
          </div>
          <div>
            <div className="meta-item-label">Circuit</div>
            <div className="meta-item-value">{meeting.circuit_short_name}</div>
          </div>
        </div>
        {cd ? (
          <div className="countdown">
            <div className="cd-item"><div className="cd-num">{pad(cd.days)}</div><div className="cd-label">Days</div></div>
            <div className="cd-item"><div className="cd-num">{pad(cd.hours)}</div><div className="cd-label">Hours</div></div>
            <div className="cd-item"><div className="cd-num">{pad(cd.mins)}</div><div className="cd-label">Mins</div></div>
            <div className="cd-item"><div className="cd-num">{pad(cd.secs)}</div><div className="cd-label">Secs</div></div>
          </div>
        ) : (
          <div style={{ marginTop: '0.5rem', color: 'var(--green)', fontWeight: 700 }}>Race weekend is live!</div>
        )}
        <div className="click-hint">View race details →</div>
      </div>
    </Link>
  );
}

// ── Live Session Card ──
function LiveSession({ drivers }) {
  const [session, setSession] = useState(null);
  const [positions, setPositions] = useState([]);
  const [laps, setLaps] = useState({});
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    (async () => {
      try {
        const modeData = await api.sessionMode().catch(() => ({ mode: 'idle' }));
        if (modeData.mode !== 'live') {
          setStatus('empty');
          return;
        }

        const sessData = await api.sessions(modeData.session?.session_key || undefined);
        const sess = Array.isArray(sessData) ? sessData[0] : null;
        if (!sess) {
          setStatus('empty');
          return;
        }
        setSession(sess);

        const posData = await api.positions(sess.session_key);
        // Get latest position per driver
        const latest = {};
        posData.forEach(p => {
          if (!latest[p.driver_number] || new Date(p.date) > new Date(latest[p.driver_number].date))
            latest[p.driver_number] = p;
        });
        setPositions(Object.values(latest).sort((a, b) => a.position - b.position));

        try {
          const lapData = await api.laps(sess.session_key);
          const lapMap = {};
          lapData.forEach(l => {
            if (!lapMap[l.driver_number] || l.lap_number > lapMap[l.driver_number].lap_number)
              lapMap[l.driver_number] = l;
          });
          setLaps(lapMap);
        } catch {}

        setStatus('ok');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  const now = new Date();
  const isLive = !!(session && now >= new Date(session.date_start) && now <= new Date(session.date_end));

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="card-title">Live Session</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {session ? `${session.session_name} — ${session.circuit_short_name}` : 'No active session'}
        </span>
      </div>
      <div className="card-body">
        {status === 'loading' && <Loading text="Loading session..." />}
        {status === 'error' && <EmptyMsg text="No active live session" />}
        {status === 'empty' && <EmptyMsg text="No active live session" />}
        {status === 'ok' && (
          <table className="data-table">
            <thead>
              <tr><th>Pos</th><th>Driver</th><th>Team</th><th>Last Lap</th><th>Status</th></tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr><td colSpan={5} className="empty-msg">Waiting for live timing...</td></tr>
              ) : positions.slice(0, 20).map(p => {
                const d = drivers[p.driver_number];
                const lap = laps[p.driver_number];
                const lapTime = lap?.lap_duration
                  ? `${Math.floor(lap.lap_duration / 60)}:${(lap.lap_duration % 60).toFixed(3).padStart(6, '0')}`
                  : '—';
                return (
                  <tr key={p.driver_number}>
                    <td className="col-pos">{p.position}</td>
                    <td>
                      <div className="driver-cell">
                        <span className="team-dot" style={{ background: d ? `#${d.team_colour}` : '#555' }} />
                        <span className="driver-info-name">{d ? `${d.first_name} ${d.last_name}` : `#${p.driver_number}`}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d?.team_name || ''}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{lapTime}</td>
                    <td style={{ fontSize: '0.8rem', color: isLive ? 'var(--green)' : 'var(--text-muted)' }}>
                      {isLive ? 'Racing' : 'Finished'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Standings Table ──
function DriverStandings({ drivers }) {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    api.driverStandings()
      .then(d => { setData(d); setStatus(d.length ? 'ok' : 'empty'); })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="card clickable" onClick={() => navigate('/drivers')}>
      <div className="card-header"><span className="card-title">Driver Standings</span><span className="click-hint">View all →</span></div>
      <div className="card-body">
        {status === 'loading' && <Loading />}
        {status === 'error' && <ErrorMsg text="Failed to load driver standings." />}
        {status === 'empty' && <EmptyMsg text="No driver standings available yet." />}
        {status === 'ok' && (
          <table className="data-table">
            <thead><tr><th className="col-pos">P</th><th>Driver</th><th>Team</th><th className="col-pts">Pts</th></tr></thead>
            <tbody>
              {data.map(s => {
                const dNum = Number(s.driver_number ?? s.Driver?.permanentNumber) || null;
                const d = dNum ? drivers[dNum] : null;
                const pos = s.position_current ?? s.position ?? '—';
                const pts = s.points_current ?? s.points ?? 0;
                const teamName = s.team_name || s.Constructors?.[0]?.name || d?.team_name || '';
                return (
                  <tr key={dNum || s.position}>
                    <td className="col-pos">{pos}</td>
                    <td>
                      <div className="driver-cell">
                        <span className="team-dot" style={{ background: d ? `#${d.team_colour}` : '#555' }} />
                        {d?.headshot_url && <img className="driver-headshot" src={d.headshot_url} alt="" loading="lazy" />}
                        <span className="driver-info-name">{d ? `${d.first_name} ${d.last_name}` : s.full_name || s.Driver?.familyName || `#${dNum}`}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{teamName}</td>
                    <td className="col-pts">{pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ConstructorStandings({ drivers }) {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    api.constructorStandings()
      .then(d => { setData(d); setStatus(d.length ? 'ok' : 'empty'); })
      .catch(() => setStatus('error'));
  }, []);

  function getTeamColor(teamName) {
    for (const d of Object.values(drivers)) {
      if (d.team_name === teamName) return `#${d.team_colour}`;
    }
    return '#555';
  }

  return (
    <div className="card clickable" onClick={() => navigate('/constructors')}>
      <div className="card-header"><span className="card-title">Constructor Standings</span><span className="click-hint">View all →</span></div>
      <div className="card-body">
        {status === 'loading' && <Loading />}
        {status === 'error' && <ErrorMsg text="Failed to load constructor standings." />}
        {status === 'empty' && <EmptyMsg text="No constructor standings available yet." />}
        {status === 'ok' && (
          <table className="data-table">
            <thead><tr><th className="col-pos">P</th><th>Constructor</th><th className="col-pts">Pts</th></tr></thead>
            <tbody>
              {data.map(s => {
                const teamName = s.Constructor?.name || s.team_name || 'Unknown';
                const pos = s.position_current ?? s.position ?? '—';
                const pts = s.points_current ?? s.points ?? 0;
                return (
                  <tr key={teamName}>
                    <td className="col-pos">{pos}</td>
                    <td>
                      <div className="driver-cell">
                        <span className="team-dot" style={{ background: getTeamColor(teamName) }} />
                        <span className="driver-info-name">{teamName}</span>
                      </div>
                    </td>
                    <td className="col-pts">{pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Last Race Result ──
function LastRaceResult({ meetings, drivers }) {
  const [result, setResult] = useState([]);
  const [lastMeeting, setLastMeeting] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const pastMeetings = meetings
          .filter(m => new Date(m.date_end || m.date_start) < now)
          .sort((a, b) => new Date(b.date_start) - new Date(a.date_start));
        if (!pastMeetings.length) { setStatus('empty'); return; }
        const mtg = pastMeetings[0];
        setLastMeeting(mtg);
        const sess = await api.sessionsForMeeting(mtg.meeting_key);
        const raceSession = sess.find(s => s.session_name === 'Race')
          || sess.find(s => s.session_name === 'Sprint')
          || sess[sess.length - 1];
        if (!raceSession) { setStatus('empty'); return; }
        const res = await api.sessionResult(raceSession.session_key);
        const top3 = Array.isArray(res)
          ? res.sort((a, b) => (a.position || 99) - (b.position || 99)).slice(0, 3)
          : [];
        setResult(top3);
        setStatus(top3.length ? 'ok' : 'empty');
      } catch {
        setStatus('error');
      }
    })();
  }, [meetings]);

  if (status === 'loading') return <Loading />;
  if (status === 'error' || status === 'empty') return null;

  const podiumColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
  const podiumLabels = ['1st', '2nd', '3rd'];

  return (
    <div className="card" style={{ animation: 'cardEntrance 0.6s var(--ease-out-expo) 0.1s both' }}>
      <div className="card-header">
        <span className="card-title">Last Race Result</span>
        <span className="card-badge">{lastMeeting?.meeting_name}</span>
      </div>
      <div className="card-body">
        <div className="dash-podium">
          {result.map((r, i) => {
            const d = drivers[r.driver_number];
            return (
              <div key={r.driver_number} className="dash-podium-slot">
                <div className="dash-podium-medal" style={{ color: podiumColors[i] }}>{podiumLabels[i]}</div>
                {d?.headshot_url && (
                  <img src={d.headshot_url} alt="" className="dash-podium-img" loading="lazy" />
                )}
                <div className="dash-podium-name">{d?.name_acronym || `#${r.driver_number}`}</div>
                <div className="dash-podium-team" style={{ color: d ? `#${d.team_colour}` : 'var(--text-muted)' }}>
                  {d?.team_name || ''}
                </div>
              </div>
            );
          })}
        </div>
        {lastMeeting && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link
              to={`/race/${lastMeeting.meeting_key}`}
              className="cal-results-link"
            >
              View Full Results →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar Mini (bottom of Dashboard) ──
function CalendarMini({ meetings }) {
  const now = new Date();
  const nextMeeting = meetings.find(m => new Date(m.date_end) > now);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Race Calendar</span>
        <span className="card-badge">{meetings.length} Races</span>
      </div>
      <div className="card-body">
        <div className="calendar-grid">
          {meetings.map((m, i) => {
            const completed = new Date(m.date_end) < now;
            const isNext = nextMeeting && m.meeting_key === nextMeeting.meeting_key;
            let cls = 'race-event';
            if (completed) cls += ' completed';
            if (isNext) cls += ' next-up';
            return (
              <Link key={m.meeting_key} to={`/race/${m.meeting_key}`} className={`${cls} clickable`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="race-round">Round {i + 1}</div>
                <div className="race-event-name">{m.meeting_name}</div>
                <div className="race-event-loc">{m.location}, {m.country_name}</div>
                <div className="race-event-date">{formatDate(m.date_start)} — {formatDate(m.date_end)}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Page ──
export default function Dashboard() {
  const [drivers, setDrivers] = useState({});
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [driverData, meetingData] = await Promise.all([
          api.drivers(),
          api.meetings(),
        ]);
        const drMap = {};
        driverData.forEach(d => { drMap[d.driver_number] = d; });
        setDrivers(drMap);
        setMeetings(meetingData);
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading text="Loading dashboard..." />;

  const now = new Date();
  const nextMeeting = meetings.find(m => new Date(m.date_end) > now) || null;

  return (
    <>
      <LiveBanner />
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span className="season-badge">Season {new Date().getFullYear()}</span>
      </div>

      <div className="top-row" style={{ animationDelay: '0ms' }}>
        <div className="top-row-left">
          <NextRace meeting={nextMeeting} />
          <LastRaceResult meetings={meetings} drivers={drivers} />
        </div>
        <LiveSession drivers={drivers} />
      </div>

      <div className="standings-row" style={{ animation: 'cardEntrance 0.6s var(--ease-out-expo) 0.15s both' }}>
        <DriverStandings drivers={drivers} />
        <ConstructorStandings drivers={drivers} />
      </div>

      {meetings.length > 0 && (
        <div style={{ animation: 'cardEntrance 0.6s var(--ease-out-expo) 0.3s both' }}>
          <CalendarMini meetings={meetings} />
        </div>
      )}
    </>
  );
}
