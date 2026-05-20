import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTeamColor } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useF1Store } from '../store/useF1Store';
import { FlipValue } from './Shared';

const FLAG_COLORS = {
  RED: '#e10600',
  YELLOW: '#ffd700',
  GREEN: '#00d26a',
  BLUE: '#3b82f6',
  CHEQUERED: '#fff',
  CLEAR: '#00d26a',
};

function WeatherIcon({ rainfall, airTemp }) {
  if (rainfall) return <span title="Rain">🌧</span>;
  if (airTemp > 30) return <span title="Hot">☀️</span>;
  return <span title="Clear">⛅</span>;
}

export default function LiveCompanion() {
  const sessionMode = useF1Store((state) => state.sessionMode);
  const sessionInfo = useF1Store((state) => state.sessionInfo);
  const driverRoster = useF1Store((state) => state.driverRoster);
  const [minimized, setMinimized] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [activeAlert, setActiveAlert] = useState(null);
  const alertTimer = useRef(null);
  const prevRCRef = useRef('');

  const isLive = sessionMode === 'live';

  const handleMessage = useCallback((data) => {
    if (data?.error) return;
    setLiveData(data);
  }, []);

  useWebSocket({ onMessage: handleMessage, enabled: isLive });

  const driverMap = useMemo(() => {
    const map = {};
    driverRoster.forEach((driver) => {
      map[driver.driver_number] = driver;
    });
    return map;
  }, [driverRoster]);

  // Live countdown in tab title
  useEffect(() => {
    if (!isLive || !sessionInfo?.date_end) return;
    const tick = () => {
      const remaining = Math.max(0, new Date(sessionInfo.date_end) - Date.now());
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      const label = h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${m}:${String(s).padStart(2,'0')}`;
      setCountdown(label);
      document.title = remaining > 0
        ? `🔴 ${label} · ${sessionInfo.session_name}`
        : `🏁 ${sessionInfo.session_name} · F1`;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { clearInterval(id); document.title = 'F1 Dashboard'; };
  }, [isLive, sessionInfo]);

  // Show race control alerts as banners
  useEffect(() => {
    const rc = liveData?.race_control || liveData?.raceControl;
    if (!rc?.length) return;
    const latest = rc[rc.length - 1];
    if (!latest || latest.message === prevRCRef.current) return;
    prevRCRef.current = latest.message;

    const isImportant = ['RED', 'YELLOW', 'SafetyCar', 'VirtualSafetyCar'].includes(
      latest.flag || latest.category
    );
    if (!isImportant) return;

    // Defer setting state to avoid synchronous setState within effect
    setTimeout(() => setActiveAlert(latest), 0);
    clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(() => setActiveAlert(null), 12000);
  }, [liveData]);

  if (!isLive && !liveData) return null;

  // Build sorted position list with driver info
  const posMap = {};
  (liveData?.positions || []).forEach((p) => {
    if (!posMap[p.driver_number] || new Date(p.date) > new Date(posMap[p.driver_number].date)) {
      posMap[p.driver_number] = p;
    }
  });
  const sorted = Object.values(posMap).sort((a, b) => a.position - b.position).slice(0, 10);

  // Interval gaps
  const intervalMap = {};
  (liveData?.intervals || []).forEach((iv) => { intervalMap[iv.driver_number] = iv; });

  const weather = liveData?.weather;
  const sessionName = sessionInfo?.session_name || 'LIVE';
  const alertColor = FLAG_COLORS[activeAlert?.flag] || FLAG_COLORS[activeAlert?.category] || '#ffd700';

  return (
    <div className={`live-companion-v2 ${minimized ? 'lc-minimized' : ''}`}>
      {/* Off-screen live status announcement */}
      <span className="sr-only" aria-live="polite">
        {isLive ? `${sessionName} is live.` : ''}
      </span>

      {/* Alert banner */}
      {activeAlert && (
        <div
          className="lc-alert"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ '--alert-color': alertColor }}
        >
          <span className="lc-alert-flag" style={{ color: alertColor }}>
            {activeAlert.flag === 'RED' ? '🚨' : activeAlert.flag === 'YELLOW' ? '⚠️' : '🚗'}
          </span>
          <span className="lc-alert-msg">{activeAlert.message}</span>
          <button className="lc-alert-close" onClick={() => setActiveAlert(null)} aria-label="Dismiss alert">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="lc-header">
        <div className="lc-live-dot" />
        <div className="lc-header-info">
          <span className="lc-session-name">{sessionName}</span>
          {countdown && <span className="lc-countdown">{countdown}</span>}
        </div>
        {weather && (
          <div className="lc-weather">
            <WeatherIcon rainfall={weather.rainfall} airTemp={weather.air_temperature} />
            <span>{weather.air_temperature != null ? `${weather.air_temperature}°` : ''}</span>
            <span className="lc-track-temp">Track {weather.track_temperature != null ? `${weather.track_temperature}°` : '—'}</span>
          </div>
        )}
        <button className="lc-toggle" onClick={() => setMinimized(m => !m)} title={minimized ? 'Expand' : 'Minimize'}>
          {minimized ? '▲' : '▼'}
        </button>
      </div>

      {/* Timing tower */}
      {!minimized && (
        <div className="lc-body">
          {sorted.length === 0 ? (
            <div className="lc-waiting">Waiting for timing data…</div>
          ) : (
            <div className="lc-tower" role="region" aria-label="Live timing tower" aria-live="off">
              {sorted.map((p, idx) => {
                const d = driverMap[p.driver_number];
                const iv = intervalMap[p.driver_number];
                const teamColor = d?.team_colour ? `#${d.team_colour}` : getTeamColor(d?.team_name);
                const acronym = d?.name_acronym || `#${p.driver_number}`;
                const gap = iv?.gap_to_leader != null
                  ? (iv.gap_to_leader === 0 ? 'LEADER' : `+${typeof iv.gap_to_leader === 'number' ? iv.gap_to_leader.toFixed(3) : iv.gap_to_leader}`)
                  : null;

                return (
                  <div
                    key={p.driver_number}
                    className="lc-row"
                    style={{ '--team-color': teamColor, animationDelay: `${idx * 0.04}s` }}
                  >
                    <span className="lc-pos">{p.position}</span>
                    <span className="lc-dot" style={{ background: teamColor }} />
                    <span className="lc-acronym">{acronym}</span>
                    <span className="lc-team">{d?.team_name?.split(' ')[0] || ''}</span>
                    {gap && (
                      <FlipValue
                        className="lc-gap"
                        value={gap}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="lc-footer">
            <span>Updates every 8s</span>
            <span className="lc-source">OpenF1</span>
          </div>
        </div>
      )}
    </div>
  );
}
