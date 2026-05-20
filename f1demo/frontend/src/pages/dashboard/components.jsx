import { useEffect, useState } from 'react';
import { api, getTeamColor } from '../../api';
import { Loading, EmptyMsg, formatDateFull, pad } from '../../components/Shared';
import {
  eventName,
  eventLocation,
  eventFirstSessionDate,
  eventLastSessionDate,
  eventSessionList,
  getCountdown,
  isSessionInProgress,
  sessionElapsedLabel,
  formatLapTime,
  driverDisplay,
} from './utils';

export function LiveBanner({ modeMeta, freeContext }) {
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

export function NextRace({ event, currentSession, isWeekendLive }) {
  const targetDate = isWeekendLive ? (currentSession?.date_end || eventLastSessionDate(event)) : eventFirstSessionDate(event);
  const [cd, setCd] = useState(() => getCountdown(targetDate));

  useEffect(() => {
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

export function WeekendRadar({ freeContext, modeMeta }) {
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

export function LiveSession({ drivers, modeMeta, freeContext }) {
  const [session, setSession] = useState(null);
  const [positions, setPositions] = useState([]);
  const [laps, setLaps] = useState({});
  const [status, setStatus] = useState('loading');
  const [_tick, setTick] = useState(() => Date.now());

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
            <span className="dashboard-pill dashboard-pill-live">In Progress{elapsed ? ` • ${elapsed}` : ''}</span>
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