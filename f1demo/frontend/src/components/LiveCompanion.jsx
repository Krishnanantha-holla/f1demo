import { useState, useEffect, useRef } from 'react';
import { useLiveSession } from '../hooks/useLiveSession';
import { api, getTeamColor } from '../api';

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
  const { sessionMode, liveData, isLive } = useLiveSession();
  const [minimized, setMinimized] = useState(false);
  const [driverMap, setDriverMap] = useState({});
  const [countdown, setCountdown] = useState('');
  const [activeAlert, setActiveAlert] = useState(null);
  const alertTimer = useRef(null);
  const prevRCRef = useRef('');

  // Load driver names once
  useEffect(() => {
    if (!isLive) return;
    api.drivers().then(drivers => {
      const map = {};
      drivers.forEach(d => { map[d.driver_number] = d; });
      setDriverMap(map);
    }).catch(() => {});
  }, [isLive]);

  // Live countdown in tab title
  useEffect(() => {
    if (!isLive || !sessionMode.session?.date_end) return;
    const tick = () => {
      const remaining = Math.max(0, new Date(sessionMode.session.date_end) - Date.now());
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      const label = h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${m}:${String(s).padStart(2,'0')}`;
      setCountdown(label);
      document.title = remaining > 0
        ? `🔴 ${label} · ${sessionMode.session.session_name}`
        : `🏁 ${sessionMode.session.session_name} · F1`;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { clearInterval(id); document.title = 'F1 Dashboard'; };
  }, [isLive, sessionMode]);

  // Show race control alerts as banners
  useEffect(() => {
    const rc = liveData?.raceControl;
    if (!rc?.length) return;
    const latest = rc[rc.length - 1];
    if (!latest || latest.message === prevRCRef.current) return;
    prevRCRef.current = latest.message;

    const isImportant = ['RED', 'YELLOW', 'SafetyCar', 'VirtualSafetyCar'].includes(
      latest.flag || latest.category
    );
    if (!isImportant) return;

    setActiveAlert(latest);
    clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(() => setActiveAlert(null), 12000);
  }, [liveData?.raceControl]);

  if (!isLive) return null;

  // Build sorted position list with driver info
  const posMap = {};
  (liveData?.positions || []).forEach(p => {
    if (!posMap[p.driver_number] || new Date(p.date) > new Date(posMap[p.driver_number].date)) {
      posMap[p.driver_number] = p;
    }
  });
  const sorted = Object.values(posMap).sort((a, b) => a.position - b.position).slice(0, 10);

  // Interval gaps
  const intervalMap = {};
  (liveData?.intervals || []).forEach(iv => { intervalMap[iv.driver_number] = iv; });

  const weather = liveData?.weather;
  const sessionName = sessionMode.session?.session_name || 'LIVE';
  const alertColor = FLAG_COLORS[activeAlert?.flag] || FLAG_COLORS[activeAlert?.category] || '#ffd700';

  return (
    <div className={`live-companion-v2 ${minimized ? 'lc-minimized' : ''}`}>
      {/* Alert banner */}
      {activeAlert && (
        <div className="lc-alert" style={{ '--alert-color': alertColor }}>
          <span className="lc-alert-flag" style={{ color: alertColor }}>
            {activeAlert.flag === 'RED' ? '🚨' : activeAlert.flag === 'YELLOW' ? '⚠️' : '🚗'}
          </span>
          <span className="lc-alert-msg">{activeAlert.message}</span>
          <button className="lc-alert-close" onClick={() => setActiveAlert(null)}>✕</button>
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
            <div className="lc-tower">
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
                      <span className="lc-gap" style={{ color: gap === 'LEADER' ? '#00d26a' : 'var(--text-muted)' }}>
                        {gap}
                      </span>
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
