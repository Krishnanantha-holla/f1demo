import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getTeamColor } from '../api';
import { Loading, ErrorMsg, EmptyMsg, formatDate, formatDateFull, pad } from '../components/Shared';

function getCountdown(targetDate) {
  if (!targetDate) return null;
  const diff = new Date(targetDate) - new Date();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins: Math.floor((diff / 60000) % 60),
    secs: Math.floor((diff / 1000) % 60),
  };
}

function eventName(event) {
  return event?.EventName || event?.meeting_name || 'Unknown Event';
}

function eventLocation(event) {
  const location = event?.Location || event?.location;
  const country = event?.Country || event?.country_name;
  return [location, country].filter(Boolean).join(', ');
}

function eventFirstSessionDate(event) {
  return event?.Session1DateUtc || event?.date_start || null;
}

function eventLastSessionDate(event) {
  return event?.Session5DateUtc || event?.date_end || event?.EventDate || null;
}

function eventSessionList(event) {
  if (!event) return [];
  const sessions = [];
  for (let index = 1; index <= 5; index += 1) {
    const name = event[`Session${index}`];
    const date = event[`Session${index}DateUtc`] || event[`Session${index}Date`];
    if (name && date) sessions.push({ name, date });
  }
  return sessions;
}

function mergeDriverMaps(openF1Drivers, freeRoster) {
  const merged = {};

  freeRoster.forEach((driver) => {
    merged[driver.driver_number] = { ...driver };
  });

  openF1Drivers.forEach((driver) => {
    const current = merged[driver.driver_number] || {};
    merged[driver.driver_number] = {
      ...current,
      ...driver,
      full_name: driver.full_name || current.full_name,
      first_name: driver.first_name || current.first_name,
      last_name: driver.last_name || current.last_name,
      team_name: driver.team_name || current.team_name,
      name_acronym: driver.name_acronym || current.name_acronym,
    };
  });

  return merged;
}

function driverDisplay(driver, fallback) {
  if (driver?.first_name || driver?.last_name) {
    return `${driver.first_name || ''} ${driver.last_name || ''}`.trim();
  }
  if (driver?.full_name) return driver.full_name;
  return fallback || 'Unknown Driver';
}

function formatLapTime(seconds) {
  if (!seconds) return '—';
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
}

function isSessionInProgress(session) {
  if (!session?.date_start || !session?.date_end) return false;
  const now = Date.now();
  const start = new Date(session.date_start).getTime();
  const end = new Date(session.date_end).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
}

function sessionElapsedLabel(session) {
  if (!isSessionInProgress(session)) return null;
  const elapsedMs = Date.now() - new Date(session.date_start).getTime();
  const totalMinutes = Math.max(Math.floor(elapsedMs / 60000), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m elapsed` : `${minutes}m elapsed`;
}

function LiveBanner({ modeMeta, freeContext }) {
  const currentEvent = freeContext?.current_event || null;
  const currentSession = modeMeta?.session || freeContext?.current_session || null;
  const inProgress = isSessionInProgress(currentSession);
  const shouldShow = modeMeta?.mode === 'live' || !!currentEvent || inProgress;

  if (!shouldShow) return null;

  return (
    <div className="live-banner live-banner-enhanced">
      <span className="live-dot" />
      <span className="live-text">
        {currentSession?.session_name || 'Session in progress'}
        {currentEvent ? ` • ${eventName(currentEvent)}` : ''}
      </span>
      {inProgress && <span className="live-banner-pill">In Progress</span>}
      {modeMeta?.reason === 'openf1_live_restricted' && <span className="live-banner-pill">Live Data Limited</span>}
    </div>
  );
}

function NextRace({ event, currentSession, isWeekendLive }) {
  const targetDate = isWeekendLive ? (currentSession?.date_end || eventLastSessionDate(event)) : eventFirstSessionDate(event);
  const [cd, setCd] = useState(getCountdown(targetDate));

  useEffect(() => {
    setCd(getCountdown(targetDate));
    if (!targetDate) return undefined;
    const id = setInterval(() => setCd(getCountdown(targetDate)), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!event) {
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
    <div className="card next-race-card">
      <div className="next-race-content">
        <div className="next-race-label">{isWeekendLive ? 'Weekend Live' : 'Next Event'}</div>
        <div className="next-race-name">{eventName(event)}</div>
        <div className="next-race-circuit">{eventLocation(event)}</div>
        <div className="next-race-meta">
          <div>
            <div className="meta-item-label">Headline</div>
            <div className="meta-item-value">{isWeekendLive ? (currentSession?.session_name || 'Session in progress') : 'Weekend start'}</div>
          </div>
          <div>
            <div className="meta-item-label">Date</div>
            <div className="meta-item-value">{formatDateFull(targetDate || eventLastSessionDate(event))}</div>
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
          <div className="dashboard-pill-row">
            <span className="dashboard-pill dashboard-pill-live">{isWeekendLive ? 'Live now' : 'On deck'}</span>
            {currentSession?.session_name && <span className="dashboard-pill">{currentSession.session_name}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function WeekendRadar({ freeContext, modeMeta }) {
  const currentEvent = freeContext?.current_event || null;
  const nextEvent = freeContext?.next_event || null;
  const sessions = eventSessionList(currentEvent || nextEvent);
  const activeSessionName = modeMeta?.session?.session_name || freeContext?.current_session?.session_name;

  if (!sessions.length) return null;

  return (
    <div className="card weekend-radar-card">
      <div className="card-header">
        <span className="card-title">Weekend Radar</span>
        <span className="card-badge">{currentEvent ? 'Current weekend' : 'Next weekend'}</span>
      </div>
      <div className="card-body">
        <div className="session-stack">
          {sessions.map((session) => {
            const active = session.name === activeSessionName;
            return (
              <div key={`${session.name}-${session.date}`} className={`session-row ${active ? 'active' : ''}`}>
                <div>
                  <div className="session-row-name">{session.name}</div>
                  <div className="session-row-date">{formatDateFull(session.date)}</div>
                </div>
                <span className={`dashboard-pill ${active ? 'dashboard-pill-live' : ''}`}>{active ? 'Live' : 'Scheduled'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LiveSession({ drivers, modeMeta, freeContext }) {
  const [session, setSession] = useState(null);
  const [positions, setPositions] = useState([]);
  const [laps, setLaps] = useState({});
  const [status, setStatus] = useState('loading');
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function loadLive() {
      if (modeMeta?.mode !== 'live') {
        if (!cancelled) setStatus('empty');
        return;
      }

      if (modeMeta?.reason === 'openf1_live_restricted') {
        if (!cancelled) setStatus('restricted');
        return;
      }

      try {
        const sessionKey = modeMeta?.session?.session_key;
        const sessData = await api.sessions(sessionKey || undefined);
        const sess = Array.isArray(sessData) ? sessData[0] : null;
        if (!sess) {
          if (!cancelled) setStatus('empty');
          return;
        }

        const [posData, lapData] = await Promise.all([
          api.positions(sess.session_key),
          api.laps(sess.session_key).catch(() => []),
        ]);

        if (cancelled) return;

        const latest = {};
        (posData || []).forEach((entry) => {
          if (!latest[entry.driver_number] || new Date(entry.date) > new Date(latest[entry.driver_number].date)) {
            latest[entry.driver_number] = entry;
          }
        });

        const lapMap = {};
        (lapData || []).forEach((entry) => {
          if (!lapMap[entry.driver_number] || entry.lap_number > lapMap[entry.driver_number].lap_number) {
            lapMap[entry.driver_number] = entry;
          }
        });

        setSession(sess);
        setPositions(Object.values(latest).sort((a, b) => a.position - b.position));
        setLaps(lapMap);
        setStatus('ok');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    loadLive();
    const id = setInterval(loadLive, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [modeMeta]);

  const currentEvent = freeContext?.current_event || null;
  const currentSession = modeMeta?.session || freeContext?.current_session || null;
  const schedule = eventSessionList(currentEvent);
  const activeSession = session || currentSession;
  const activeInProgress = isSessionInProgress(activeSession);
  const elapsed = sessionElapsedLabel(activeSession);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card live-session-card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="card-title">Live Session</span>
        <div className="live-session-meta">
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {status === 'ok'
              ? `${session?.session_name || currentSession?.session_name} — ${session?.circuit_short_name || currentEvent?.Location || ''}`
              : currentEvent
                ? `${currentSession?.session_name || 'Current weekend'} — ${eventName(currentEvent)}`
                : 'Session watch'}
          </span>
          {activeInProgress && (
            <span className="dashboard-pill dashboard-pill-live">In Progress{activeElapsed ? ` • ${activeElapsed}` : ''}</span>
          )}
        </div>
      </div>
      <div className="card-body">
        {status === 'loading' && <Loading text="Loading session..." />}
        {status === 'error' && <EmptyMsg text="Live session temporarily unavailable." />}
        {status === 'empty' && (
          <div className="free-mode-panel">
            <div className="free-mode-copy">
              <div className="free-mode-title">No active timing feed right now.</div>
              <div className="free-mode-text">
                This panel stays active and automatically switches to live timing the moment an on-track session starts.
              </div>
            </div>
            {schedule.length > 0 && (
              <div className="session-stack compact">
                {schedule.map((sessionRow) => {
                  const active = sessionRow.name === currentSession?.session_name;
                  return (
                    <div key={`${sessionRow.name}-${sessionRow.date}`} className={`session-row ${active ? 'active' : ''}`}>
                      <div>
                        <div className="session-row-name">{sessionRow.name}</div>
                        <div className="session-row-date">{formatDateFull(sessionRow.date)}</div>
                      </div>
                      <span className={`dashboard-pill ${active ? 'dashboard-pill-live' : ''}`}>{active ? 'Now' : 'Upcoming'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {status === 'restricted' && (
          <div className="free-mode-panel">
            <div className="free-mode-copy">
              <div className="free-mode-title">Weekend tracker remains active.</div>
              <div className="free-mode-text">
                Detailed live timing is temporarily unavailable, but this card keeps refreshing the active weekend and session schedule automatically.
              </div>
            </div>
            <div className="session-stack compact">
              {schedule.map((sessionRow) => {
                const active = sessionRow.name === currentSession?.session_name;
                return (
                  <div key={`${sessionRow.name}-${sessionRow.date}`} className={`session-row ${active ? 'active' : ''}`}>
                    <div>
                      <div className="session-row-name">{sessionRow.name}</div>
                      <div className="session-row-date">{formatDateFull(sessionRow.date)}</div>
                    </div>
                    <span className={`dashboard-pill ${active ? 'dashboard-pill-live' : ''}`}>{active ? 'Now' : 'Queued'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {status === 'ok' && (
          <table className="data-table">
            <thead>
              <tr><th>Pos</th><th>Driver</th><th>Team</th><th>Last Lap</th><th>Status</th></tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr><td colSpan={5} className="empty-msg">Waiting for live timing...</td></tr>
              ) : positions.slice(0, 20).map((position) => {
                const driver = drivers[position.driver_number];
                const lap = laps[position.driver_number];
                const teamColor = driver?.team_colour ? `#${driver.team_colour}` : getTeamColor(driver?.team_name);
                return (
                  <tr key={position.driver_number}>
                    <td className="col-pos">{position.position}</td>
                    <td>
                      <div className="driver-cell">
                        <span className="team-dot" style={{ background: teamColor }} />
                        <span className="driver-info-name">{driverDisplay(driver, `#${position.driver_number}`)}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{driver?.team_name || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{formatLapTime(lap?.lap_duration)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--green)' }}>Running</td>
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

function DriverStandings({ drivers }) {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    api.driverStandings()
      .then((result) => { setData(result); setStatus(result.length ? 'ok' : 'empty'); })
      .catch((err) => { console.warn('[DriverStandings]', err); setStatus('error'); });
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
              {data.map((standing) => {
                const driverNumber = Number(standing.driver_number ?? standing.Driver?.permanentNumber) || null;
                const driver = driverNumber ? drivers[driverNumber] : null;
                const position = standing.position_current ?? standing.position ?? '—';
                const points = standing.points_current ?? standing.points ?? 0;
                const teamName = standing.team_name || standing.Constructors?.[0]?.name || driver?.team_name || '';
                const teamColor = driver?.team_colour ? `#${driver.team_colour}` : getTeamColor(teamName);
                return (
                  <tr key={driverNumber || standing.position}>
                    <td className="col-pos">{position}</td>
                    <td>
                      <div className="driver-cell">
                        <span className="team-dot" style={{ background: teamColor }} />
                        {driver?.headshot_url && <img className="driver-headshot" src={driver.headshot_url} alt="" loading="lazy" />}
                        <span className="driver-info-name">{driverDisplay(driver, `${standing.Driver?.givenName || ''} ${standing.Driver?.familyName || ''}`.trim())}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{teamName}</td>
                    <td className="col-pts">{points}</td>
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
      .then((result) => { setData(result); setStatus(result.length ? 'ok' : 'empty'); })
      .catch((err) => { console.warn('[ConstructorStandings]', err); setStatus('error'); });
  }, []);

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
              {data.map((standing) => {
                const teamName = standing.Constructor?.name || standing.team_name || 'Unknown';
                const position = standing.position_current ?? standing.position ?? '—';
                const points = standing.points_current ?? standing.points ?? 0;
                return (
                  <tr key={teamName}>
                    <td className="col-pos">{position}</td>
                    <td>
                      <div className="driver-cell">
                        <span className="team-dot" style={{ background: getTeamColor(teamName) }} />
                        <span className="driver-info-name">{teamName}</span>
                      </div>
                    </td>
                    <td className="col-pts">{points}</td>
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

function LastRaceResult() {
  const [race, setRace] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.lastResults()
      .then((result) => {
        setRace(result || null);
        setStatus(result?.Results?.length ? 'ok' : 'empty');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') return <Loading />;
  if (status !== 'ok') return null;

  const topThree = race.Results.slice(0, 3);
  const podiumColors = ['#ffd166', '#d1d5db', '#d97706'];

  return (
    <div className="card podium-card">
      <div className="card-header">
        <span className="card-title">Last Classified Finish</span>
        <span className="card-badge">{race.raceName}</span>
      </div>
      <div className="card-body">
        <div className="dash-podium refined">
          {topThree.map((result, index) => (
            <div key={result.Driver?.driverId || index} className="dash-podium-slot">
              <div className="dash-podium-medal" style={{ color: podiumColors[index] }}>P{result.position}</div>
              <div className="dash-podium-name">{result.Driver?.code || result.Driver?.familyName}</div>
              <div className="dash-podium-team">{result.Constructor?.name}</div>
              <div className="dash-podium-time">{result.Time?.time || result.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarMini({ schedule, currentEvent }) {
  if (!schedule.length) return null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Season Map</span>
        <span className="card-badge">{schedule.length} Rounds</span>
      </div>
      <div className="card-body">
        <div className="calendar-grid enhanced-calendar-grid">
          {schedule.map((event) => {
            const active = currentEvent?.RoundNumber === event.RoundNumber;
            const complete = new Date(eventLastSessionDate(event)) < new Date();
            return (
              <div key={`${event.RoundNumber}-${event.EventName}`} className={`race-event ${active ? 'next-up' : ''} ${complete ? 'completed' : ''}`}>
                <div className="race-round">Round {event.RoundNumber}</div>
                <div className="race-event-name">{event.EventName}</div>
                <div className="race-event-loc">{event.Location}, {event.Country}</div>
                <div className="race-event-date">{formatDate(eventFirstSessionDate(event))} — {formatDate(eventLastSessionDate(event))}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [openF1Drivers, setOpenF1Drivers] = useState([]);
  const [freeRoster, setFreeRoster] = useState([]);
  const [freeContext, setFreeContext] = useState({ schedule: [] });
  const [modeMeta, setModeMeta] = useState({ mode: 'idle' });
  const [loading, setLoading] = useState(true);

  // Memoize the merge so it only recomputes when inputs change, not on every render
  const drivers = useMemo(
    () => mergeDriverMaps(openF1Drivers, freeRoster),
    [openF1Drivers, freeRoster],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const [driversData, rosterData, context, mode] = await Promise.all([
          api.drivers().catch((err) => { console.warn('[Dashboard] drivers fetch failed', err); return []; }),
          api.freeRoster().catch((err) => { console.warn('[Dashboard] freeRoster fetch failed', err); return []; }),
          api.freeContext().catch((err) => { console.warn('[Dashboard] freeContext fetch failed', err); return { schedule: [] }; }),
          api.sessionMode().catch((err) => { console.warn('[Dashboard] sessionMode fetch failed', err); return { mode: 'idle' }; }),
        ]);

        if (cancelled) return;

        setOpenF1Drivers(driversData || []);
        setFreeRoster(rosterData || []);
        setFreeContext(context || { schedule: [] });
        setModeMeta(mode || { mode: 'idle' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function refreshDynamic() {
      try {
        const [context, mode] = await Promise.all([
          api.freeContext().catch((err) => { console.warn('[Dashboard] refresh freeContext failed', err); return { schedule: [] }; }),
          api.sessionMode().catch((err) => { console.warn('[Dashboard] refresh sessionMode failed', err); return { mode: 'idle' }; }),
        ]);
        if (cancelled) return;
        setFreeContext(context || { schedule: [] });
        setModeMeta(mode || { mode: 'idle' });
      } catch (err) {
        console.warn('[Dashboard] refreshDynamic failed', err);
      }
    }

    loadInitial();
    const id = setInterval(refreshDynamic, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) return <Loading text="Loading dashboard..." />;

  const currentEvent = freeContext?.current_event || null;
  const nextEvent = freeContext?.next_event || null;
  const featuredEvent = currentEvent || nextEvent;

  return (
    <>
      <LiveBanner modeMeta={modeMeta} freeContext={freeContext} />
      <div className="page-header dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">Live weekend tracking with resilient fallback coverage.</div>
        </div>
        <span className="season-badge">Season {new Date().getFullYear()}</span>
      </div>

      <div className="top-row" style={{ animationDelay: '0ms' }}>
        <div className="top-row-left">
          <NextRace event={featuredEvent} currentSession={freeContext?.current_session} isWeekendLive={!!currentEvent} />
          <WeekendRadar freeContext={freeContext} modeMeta={modeMeta} />
        </div>
        <LiveSession drivers={drivers} modeMeta={modeMeta} freeContext={freeContext} />
      </div>

      <div className="standings-row" style={{ animation: 'cardEntrance 0.6s var(--ease-out-expo) 0.15s both' }}>
        <DriverStandings drivers={drivers} />
        <ConstructorStandings drivers={drivers} />
      </div>

      <div className="bottom-dashboard-grid">
        <div style={{ animation: 'cardEntrance 0.6s var(--ease-out-expo) 0.25s both' }}>
          <LastRaceResult />
        </div>
        <div style={{ animation: 'cardEntrance 0.6s var(--ease-out-expo) 0.3s both' }}>
          <CalendarMini schedule={freeContext?.schedule || []} currentEvent={currentEvent} />
        </div>
      </div>
    </>
  );
}
