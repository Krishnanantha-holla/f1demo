import { useEffect, useState, useCallback } from 'react';
import { api, getTeamColor } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

const ARVID_HEADSHOT = 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/lindblad.png.transform/2col/image.png';

function getDriverHeadshot(driver) {
  if (!driver) return '';
  if (Number(driver.driver_number) === 41) return ARVID_HEADSHOT;
  return driver.headshot_url || '';
}

function fmtLap(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(3).padStart(6, '0');
  return m > 0 ? `${m}:${s}` : s;
}

// ── Pilot Encyclopedia Profile (Slide-Over) ──
function PilotProfile({ driver, standing, allDrivers, standings, bios, onClose }) {
  const [detail, setDetail] = useState(null);
  const [closing, setClosing] = useState(false);
  const teamColor = getTeamColor(driver.team_name);
  const driverHeadshot = getDriverHeadshot(driver);
  const info = bios?.[String(driver.driver_number)] || {};

  const teammate = allDrivers.find(d => d.team_name === driver.team_name && d.driver_number !== driver.driver_number);
  const tmStanding = teammate ? standings[teammate.driver_number] : null;

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 400); // match CSS animation duration
  }, [onClose]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  useEffect(() => {
    (async () => {
      try {
        const [lapData, pitData, stintData] = await Promise.all([
          api.laps(undefined, driver.driver_number).catch(() => []),
          api.pits().catch(() => []),
          api.stints().catch(() => []),
        ]);
        const driverLaps = Array.isArray(lapData) ? lapData.filter(l => l.driver_number === driver.driver_number) : [];
        const driverPits = Array.isArray(pitData) ? pitData.filter(p => p.driver_number === driver.driver_number) : [];
        const driverStints = Array.isArray(stintData) ? stintData.filter(s => s.driver_number === driver.driver_number) : [];

        const lapTimes = driverLaps.filter(l => l.lap_duration && l.lap_duration > 0).map(l => l.lap_duration);
        const bestLap = lapTimes.length ? Math.min(...lapTimes) : null;
        const avgLap = lapTimes.length ? lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length : null;

        // Sector consistency
        const s1 = driverLaps.filter(l => l.duration_sector_1 > 0).map(l => l.duration_sector_1);
        const s2 = driverLaps.filter(l => l.duration_sector_2 > 0).map(l => l.duration_sector_2);
        const s3 = driverLaps.filter(l => l.duration_sector_3 > 0).map(l => l.duration_sector_3);
        const bestS1 = s1.length ? Math.min(...s1) : null;
        const bestS2 = s2.length ? Math.min(...s2) : null;
        const bestS3 = s3.length ? Math.min(...s3) : null;

        setDetail({
          totalLaps: driverLaps.length,
          bestLap, avgLap,
          pitStops: driverPits.length,
          stints: driverStints.length,
          bestS1, bestS2, bestS3,
          tyres: driverStints.map(s => s.compound).filter(Boolean),
        });
      } catch {
        setDetail({ error: true });
      }
    })();
  }, [driver.driver_number]);

  return (
    <>
      <div className={`encyclopedia-backdrop ${closing ? 'closing' : ''}`} onClick={handleClose} />
      <div className={`encyclopedia-panel ${closing ? 'closing' : ''}`}>
        <button className="panel-close" onClick={handleClose}>✕</button>
        
        {/* Massive watermark number */}
        <div className="watermark-number">{driver.driver_number}</div>

        <div className="panel-header">
          {driverHeadshot ? (
            <img
              src={driverHeadshot}
              alt=""
              className="panel-headshot"
              style={{ borderBottom: `4px solid ${teamColor}` }}
              onError={(e) => {
                if (e.currentTarget.src !== ARVID_HEADSHOT) {
                  e.currentTarget.src = ARVID_HEADSHOT;
                } else {
                  e.currentTarget.style.display = 'none';
                }
              }}
            />
          ) : (
            <div className="panel-headshot-placeholder" />
          )}
          <div className="panel-title-area">
            <h2 className="panel-name">{info.full_name || driver.full_name}</h2>
            <h3 className="panel-team" style={{ color: teamColor }}>{driver.team_name}</h3>
          </div>
        </div>

        <div className="panel-scroll-content">
          <div className="bio-section">
            <p className="bio-text">{info.bio || `${driver.full_name} drives for ${driver.team_name}.`}</p>
          </div>

          <div className="stats-showcase">
            <div className="stat-hero">
              <span className="stat-hero-val">{info.championships || 0}</span>
              <span className="stat-hero-label">World Titles</span>
            </div>
            <div className="stat-hero">
              <span className="stat-hero-val">{info.wins || 0}</span>
              <span className="stat-hero-label">Wins</span>
            </div>
            <div className="stat-hero">
              <span className="stat-hero-val">{info.podiums || 0}</span>
              <span className="stat-hero-label">Podiums</span>
            </div>
          </div>

          <br />
          <h4 className="section-divider">Current Season</h4>
          <div className="stats-grid-modern">
            <div className="stat-box">
              <span className="box-val">{standing?.position ?? '—'}</span>
              <span className="box-label">Pos</span>
            </div>
            <div className="stat-box">
              <span className="box-val" style={{ color: teamColor }}>{standing?.points ?? '—'}</span>
              <span className="box-label">Pts</span>
            </div>
            <div className="stat-box">
              <span className="box-val">{detail?.totalLaps ?? '—'}</span>
              <span className="box-label">Laps Driven</span>
            </div>
            <div className="stat-box">
              <span className="box-val">{detail ? fmtLap(detail.bestLap) : '—'}</span>
              <span className="box-label">Best Lap</span>
            </div>
          </div>

          {detail && !detail.error && (detail.bestS1 || detail.bestS2) && (
            <>
              <br />
              <h4 className="section-divider">Performance</h4>
              <div className="stats-grid-modern">
                <div className="stat-box">
                  <span className="box-val">{detail ? fmtLap(detail.bestS1) : '—'}</span>
                  <span className="box-label">Best S1</span>
                </div>
                <div className="stat-box">
                  <span className="box-val">{detail ? fmtLap(detail.bestS2) : '—'}</span>
                  <span className="box-label">Best S2</span>
                </div>
                <div className="stat-box">
                  <span className="box-val">{detail ? fmtLap(detail.bestS3) : '—'}</span>
                  <span className="box-label">Best S3</span>
                </div>
                <div className="stat-box">
                  <span className="box-val">{detail?.pitStops ?? '—'}</span>
                  <span className="box-label">Pit Stops</span>
                </div>
              </div>

              {/* Tyre History */}
              {detail.tyres.length > 0 && (
                <div className="modal-section">
                  <div className="modal-section-title">Tyre Compounds Used</div>
                  <div className="modal-lap-mini">
                    {detail.tyres.map((t, i) => {
                      const c = { SOFT: '#e10600', MEDIUM: '#ffd700', HARD: '#e8e8ee', INTERMEDIATE: '#00d26a', WET: '#00d4ff' };
                      return (
                        <div key={i} className="modal-lap-chip" style={{ borderColor: c[t.toUpperCase()] || 'var(--border)' }}>
                          <span style={{ color: c[t.toUpperCase()] || 'var(--text)', fontWeight: 700 }}>{t}</span>
                          <span className="modal-lap-chip-label">Stint {i + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Head-to-Head */}
              {teammate && tmStanding && (
                <div className="modal-section">
                  <div className="modal-section-title">Teammate Comparison</div>
                  <div className="h2h-grid">
                    <div className="h2h-driver" style={{ color: teamColor }}>{driver.full_name}</div>
                    <div className="h2h-vs">VS</div>
                    <div className="h2h-driver" style={{ textAlign: 'right' }}>{teammate.full_name}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [standings, setStandings] = useState({});
  const [bios, setBios] = useState({});
  const [status, setStatus] = useState('loading');
  const [modalDriver, setModalDriver] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [driverData, standingsData, bioData] = await Promise.all([
          api.drivers(),
          api.driverStandings().catch(() => []),
          api.bios().catch(() => ({ drivers: {} }))
        ]);
        setDrivers(driverData);
        setBios(bioData.drivers || {});
        
        const sMap = {};
        standingsData.forEach(s => {
          const driverNo = Number(s.driver_number ?? s.Driver?.permanentNumber);
          if (driverNo) {
            sMap[driverNo] = {
              ...s,
              position: parseInt(s.position_current ?? s.position, 10),
              points: parseFloat(s.points_current ?? s.points) || 0
            };
          }
        });
        setStandings(sMap);
        setStatus('ok');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  const maxPoints = drivers.length > 0
    ? Math.max(...Object.values(standings).map(s => s.points || 0), 1)
    : 1;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Drivers</h1>
        <span className="season-badge">Season {new Date().getFullYear()}</span>
      </div>

      {status === 'loading' && <Loading text="Loading drivers..." />}
      {status === 'error' && <ErrorMsg text="Failed to load drivers." />}
      {status === 'ok' && (
        <div className="drivers-grid">
          {drivers.map((d, i) => {
            const s = standings[d.driver_number];
            const teamColor = `#${d.team_colour || '555'}`;
            const pointsPct = s ? ((s.points || 0) / maxPoints) * 100 : 0;
            const headshotUrl = getDriverHeadshot(d);
            return (
              <div
                key={d.driver_number}
                className="driver-card"
                onClick={() => setModalDriver(d.driver_number)}
                style={{
                  animationDelay: `${Math.min(i * 50, 600)}ms`,
                  '--card-glow-color': `${teamColor}22`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: teamColor, borderRadius: '10px 0 0 10px' }} />

                <div className="driver-card-top">
                  {headshotUrl ? (
                    <img
                      className="driver-card-img"
                      src={headshotUrl}
                      alt={d.full_name}
                      loading="lazy"
                      onError={(e) => {
                        if (e.currentTarget.src !== ARVID_HEADSHOT) {
                          e.currentTarget.src = ARVID_HEADSHOT;
                        } else {
                          e.currentTarget.style.display = 'none';
                        }
                      }}
                    />
                  ) : (
                    <div className="driver-card-img" />
                  )}
                  <div className="driver-card-info">
                    <div className="driver-card-name">{d.full_name}</div>
                    <div className="driver-card-team">{d.team_name}</div>
                    {s && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--f1-red)', fontWeight: 700 }}>{!isNaN(s.position) ? `P${s.position}` : '—'}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{s.points || 0} pts</span>
                      </div>
                    )}
                    {s && (
                      <div className="points-bar-track">
                        <div className="points-bar-fill" style={{ '--fill': `${pointsPct}%`, width: `${pointsPct}%`, background: `linear-gradient(90deg, ${teamColor}, ${teamColor}88)`, '--bar-delay': `${i * 50 + 400}ms` }} />
                      </div>
                    )}
                  </div>
                  <div className="driver-card-number">{d.driver_number}</div>
                </div>

                <div className="expand-hint">
                  <span className="click-hint">Click for profile →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Driver Modal */}
      {modalDriver && (() => {
        const selectedDriver = drivers.find(d => d.driver_number === modalDriver);
        if (!selectedDriver) return null;
        return (
          <PilotProfile
            driver={selectedDriver}
            standing={standings[modalDriver]}
            allDrivers={drivers}
            standings={standings}
            bios={bios}
            onClose={() => setModalDriver(null)}
          />
        );
      })()}
    </>
  );
}
