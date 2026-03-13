import { useEffect, useState, useCallback } from 'react';
import { api, getTeamColor } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

// Car image URLs (year-dynamic)
const CAR_YEAR = new Date().getFullYear();
function carUrl(slug) { return `https://media.formula1.com/d_team_car_fallback_image.png/content/dam/fom-website/teams/${CAR_YEAR}/${slug}.png`; }
const CAR_IMAGES = {
  'McLaren':        carUrl('mclaren'),
  'Ferrari':        carUrl('ferrari'),
  'Red Bull Racing':carUrl('red-bull-racing'),
  'Mercedes':       carUrl('mercedes'),
  'Aston Martin':   carUrl('aston-martin'),
  'Alpine':         carUrl('alpine'),
  'Williams':       carUrl('williams'),
  'RB':             carUrl('rb'),
  'Racing Bulls':   carUrl('rb'),
  'Kick Sauber':    carUrl('kick-sauber'),
  'Haas F1 Team':   carUrl('haas'),
  'Audi':           carUrl('audi'),
  'Cadillac':       carUrl('cadillac'),
};

function getCarImage(teamName) {
  if (!teamName) return null;
  if (CAR_IMAGES[teamName]) return CAR_IMAGES[teamName];
  const lower = teamName.toLowerCase();
  for (const [key, url] of Object.entries(CAR_IMAGES)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return url;
  }
  return null;
}

function fmtLap(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(3).padStart(6, '0');
  return m > 0 ? `${m}:${s}` : s;
}

// ── Team Encyclopedia Profile (Slide-Over) ──
function TeamProfile({ team, teamDrivers, driverStandings, bios, onClose }) {
  const [detail, setDetail] = useState(null);
  const [driverLapData, setDriverLapData] = useState({});
  const [closing, setClosing] = useState(false);
  
  const color = getTeamColor(team.team_name);
  
  // Try to find the constructor key in bios
  let info = {};
  if (bios) {
    const tLower = team.team_name.toLowerCase();
    for (const [k, v] of Object.entries(bios)) {
      if (tLower.includes(v.full_name.toLowerCase()) || tLower.includes(k.replace('_', ''))) {
        info = v;
        break;
      }
    }
  }

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 400); // matches CSS animation duration
  }, [onClose]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  useEffect(() => {
    (async () => {
      try {
        const allLaps = await Promise.all(
          teamDrivers.map(d => api.laps(undefined, d.driver_number).catch(() => []))
        );
        const allPits = await api.pits().catch(() => []);

        let totalLaps = 0, bestLap = null, pitTotal = 0;
        const lapsByDriver = {};

        teamDrivers.forEach((d, idx) => {
          const dLaps = (Array.isArray(allLaps[idx]) ? allLaps[idx] : []).filter(l => l.driver_number === d.driver_number);
          totalLaps += dLaps.length;
          lapsByDriver[d.driver_number] = dLaps;
          const times = dLaps.filter(l => l.lap_duration > 0).map(l => l.lap_duration);
          if (times.length) {
            const min = Math.min(...times);
            if (!bestLap || min < bestLap) bestLap = min;
          }
          const dPits = (Array.isArray(allPits) ? allPits : []).filter(p => p.driver_number === d.driver_number);
          pitTotal += dPits.length;
        });

        setDetail({ totalLaps, bestLap, pitTotal });
        setDriverLapData(lapsByDriver);
      } catch {
        setDetail({ error: true });
      }
    })();
  }, [teamDrivers]);

  const carImg = getCarImage(team.team_name);

  // Head-to-head comparison for 2 drivers
  const d1 = teamDrivers[0], d2 = teamDrivers[1];
  const ds1 = d1 ? driverStandings[d1.driver_number] : null;
  const ds2 = d2 ? driverStandings[d2.driver_number] : null;

  const laps1 = driverLapData[d1?.driver_number] || [];
  const laps2 = driverLapData[d2?.driver_number] || [];
  const times1 = laps1.filter(l => l.lap_duration > 0).map(l => l.lap_duration);
  const times2 = laps2.filter(l => l.lap_duration > 0).map(l => l.lap_duration);
  const best1 = times1.length ? Math.min(...times1) : null;
  const best2 = times2.length ? Math.min(...times2) : null;

  return (
    <>
      <div className={`encyclopedia-backdrop ${closing ? 'closing' : ''}`} onClick={handleClose} />
      <div className={`encyclopedia-panel ${closing ? 'closing' : ''}`}>
        <button className="panel-close" onClick={handleClose}>✕</button>
        
        {/* Massive watermark */}
        <div className="watermark-number">P{team.position_current}</div>

        <div className="panel-header">
          {carImg ? (
            <img src={carImg} alt="" className="panel-headshot" style={{ borderBottom: `4px solid ${color}`, objectFit: 'contain', background: 'transparent' }} />
          ) : (
            <div className="panel-headshot-placeholder" />
          )}
          <div className="panel-title-area">
            <h2 className="panel-name">{info.full_name || team.team_name}</h2>
            <h3 className="panel-team" style={{ color: color }}>
              {info.base || teamDrivers.map(d => d.name_acronym || d.last_name).join(' · ')}
            </h3>
          </div>
        </div>

        <div className="panel-scroll-content">
          {carImg && (
            <div className="team-hero-showcase" style={{ '--team-color': color }}>
              <img src={carImg} alt={`${team.team_name} car`} className="team-hero-car" loading="lazy" />
              <div className="team-hero-meta">
                <span>Factory Line-Up</span>
                <strong>{teamDrivers.length ? teamDrivers.map(d => d.name_acronym || d.last_name).join(' / ') : 'TBD'}</strong>
              </div>
            </div>
          )}

          <div className="bio-section">
            <p className="bio-text">{info.bio || `${team.team_name} is currently P${team.position_current} in the Constructors' Championship.`}</p>
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
              <span className="stat-hero-val" style={{ color }}>{team.points_current}</span>
              <span className="stat-hero-label">Current Points</span>
            </div>
          </div>

          <br />
          <h4 className="section-divider">Current Season</h4>
          <div className="stats-grid-modern">
            <div className="stat-box">
              <span className="box-val">P{team.position_current}</span>
              <span className="box-label">Position</span>
            </div>
            <div className="stat-box">
              <span className="box-val">{detail?.totalLaps ?? '—'}</span>
              <span className="box-label">Laps Driven</span>
            </div>
            <div className="stat-box">
              <span className="box-val">{detail ? fmtLap(detail.bestLap) : '—'}</span>
              <span className="box-label">Best Lap</span>
            </div>
            <div className="stat-box">
              <span className="box-val">{detail?.pitTotal ?? '—'}</span>
              <span className="box-label">Total Pits</span>
            </div>
          </div>

          {d1 && d2 && ds1 && ds2 && (
            <>
              <br />
              <h4 className="section-divider">Garage Battle</h4>
              <div className="modal-section">
                <div className="h2h-grid">
                  <div className="h2h-driver" style={{ color: color }}>{d1.full_name}</div>
                  <div className="h2h-vs">VS</div>
                  <div className="h2h-driver" style={{ textAlign: 'right' }}>{d2.full_name}</div>
                  
                  <div className="h2h-stat" style={{ color: color }}>{ds1.points_current || 0} pts</div>
                  <div className="h2h-stat-label">Points</div>
                  <div className="h2h-stat" style={{ textAlign: 'right' }}>{ds2.points_current || 0} pts</div>
                </div>
                <div className="h2h-bar-container" style={{ marginTop: '0.5rem' }}>
                  <div 
                    className="h2h-bar" 
                    style={{ background: color, width: `${(ds1.points_current || 0) / (((ds1.points_current || 0) + (ds2.points_current || 0)) || 1) * 100}%` }}
                  />
                </div>

                {/* Best Lap Battle */}
                {(best1 || best2) && (
                  <div className="modal-h2h" style={{ marginTop: '1rem' }}>
                    <div className="h2h-col">
                      <div className="h2h-drv" style={{ opacity: best1 && (!best2 || best1 <= best2) ? 1 : 0.5 }}>
                        {fmtLap(best1)}
                      </div>
                    </div>
                    <div className="h2h-vs">Best Lap</div>
                    <div className="h2h-col" style={{ textAlign: 'right' }}>
                      <div className="h2h-drv" style={{ opacity: best2 && (!best1 || best2 <= best1) ? 1 : 0.5 }}>
                        {fmtLap(best2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}

export default function Constructors() {
  const [constructors, setConstructors] = useState([]);
  const [allDrivers, setAllDrivers] = useState([]);
  const [driverStandings, setDriverStandings] = useState({});
  const [bios, setBios] = useState({});
  const [status, setStatus] = useState('loading');
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [stData, drvData, dsData, bioData] = await Promise.all([
          api.constructorStandings().catch(() => []),
          api.drivers().catch(() => []),
          api.driverStandings().catch(() => []),
          api.bios().catch(() => ({ constructors: {} }))
        ]);

        if (!stData || stData.length === 0) {
          setStatus('empty');
          return;
        }

        const uniqueDrivers = [];
        const seen = new Set();
        (drvData || []).forEach(d => {
          if (!seen.has(d.driver_number)) {
            uniqueDrivers.push(d);
            seen.add(d.driver_number);
          }
        });

        const dsMap = {};
        if (Array.isArray(dsData)) {
          dsData.forEach(s => {
            const driverNo = Number(s.driver_number ?? s.Driver?.permanentNumber);
            if (driverNo) {
              dsMap[driverNo] = {
                ...s,
                position_current: parseInt(s.position_current ?? s.position, 10),
                points_current: parseFloat(s.points_current ?? s.points) || 0
              };
            }
          });
        }

        const normalized = stData.map(c => ({
          ...c,
          team_name: c.Constructor?.name || c.team_name,
          position_current: parseInt(c.position || c.position_current, 10),
          points_current: parseFloat(c.points || c.points_current) || 0
        }));
        const sorted = normalized.sort((a, b) => a.position_current - b.position_current);

        setConstructors(sorted);
        setAllDrivers(uniqueDrivers);
        setDriverStandings(dsMap);
        setBios(bioData.constructors || {});
        setStatus('ok');
      } catch (e) {
        setStatus('error');
      }
    })();
  }, []);

  if (status === 'loading') return <Loading text="Accessing Factory Database..." />;
  if (status === 'error') return <ErrorMsg text="Failed to load constructors. Jolpica/FastF1 might be down." />;
  if (status === 'empty') return <ErrorMsg text="No constructor standings available." />;

  const maxPts = Math.max(...constructors.map(c => c.points_current), 1);

  return (
    <div className="encyclopedia-page">
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2.5rem', letterSpacing: '-1px' }}>The Teams</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Grid Encyclopedia {new Date().getFullYear()}
          </p>
        </div>
      </div>

      <div className="pilot-grid">
        {constructors.map((team, i) => {
          const color = getTeamColor(team.team_name);
          const points = team.points_current || 0;
          const barWidth = `${Math.max((points / maxPts) * 100, 2)}%`;
          const carImg = getCarImage(team.team_name);

          // Get the two main drivers for the team
          const teamDrivers = allDrivers
            .filter(d => {
              if (!d.team_name || !team.team_name) return false;
              const a = team.team_name.toLowerCase();
              const b = d.team_name.toLowerCase();
              if (a.includes('red bull')) return b.includes('red bull');
              if (a === 'rb' || a.includes('racing bulls')) return b === 'rb' || b.includes('racing bulls');
              if (a.includes('aston martin')) return b.includes('aston martin');
              if (a.includes('haas')) return b.includes('haas');
              if (a.includes('audi') || a.includes('sauber')) return b.includes('audi') || b.includes('sauber');
              if (a.includes('alpine')) return b.includes('alpine');
              if (a.includes('mclaren')) return b.includes('mclaren');
              if (a.includes('ferrari')) return b.includes('ferrari');
              if (a.includes('mercedes')) return b.includes('mercedes');
              if (a.includes('williams')) return b.includes('williams');
              if (a.includes('cadillac')) return b.includes('cadillac');
              return a.includes(b.split(' ')[0]) || b.includes(a.split(' ')[0]);
            })
            .sort((a, b) => {
              const pA = driverStandings[a.driver_number]?.points_current || 0;
              const pB = driverStandings[b.driver_number]?.points_current || 0;
              return pB - pA;
            })
            .slice(0, 2);

          return (
            <div
              key={team?.team_name || i}
              className="pilot-card"
              onClick={() => setSelectedTeam({ team, teamDrivers })}
              style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
            >
              <div className="pilot-card-bg" style={{ background: `linear-gradient(135deg, ${color}15 0%, transparent 60%)` }} />
              
              <div className="pilot-num-bg">P{team.position_current || '?'}</div>
              
              <div className="pilot-card-top">
                <div className="pilot-card-info" style={{ zIndex: 2 }}>
                  <div className="pilot-name">{team.team_name || 'Grid Team'}</div>
                  <div className="pilot-team" style={{ color: color }}>
                    {teamDrivers.length ? teamDrivers.map(d => d.name_acronym || d.last_name).join(' · ') : 'TBD · TBD'}
                  </div>
                </div>
                {carImg && (
                  <img src={carImg} alt="" className="pilot-card-img" style={{ objectFit: 'contain', width: '100px', height: '60px', opacity: 0.9, zIndex: 2, marginRight: '-10px' }} loading="lazy" onError={e => e.target.style.display = 'none'} />
                )}
              </div>

              <div className="pilot-card-bot">
                <div className="pilot-rank-box" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.5rem' }}>
                    <span className="pr-pos">P{team.position_current || '?'}</span>
                    <span className="pr-pts" style={{ color: color }}>{points} PTS</span>
                  </div>
                  <div className="points-bar-track" style={{ width: '100%', height: '4px' }}>
                    <div 
                      className="points-bar-fill" 
                      style={{ 
                        background: color, 
                        '--fill': barWidth,
                        '--bar-delay': `${Math.min(i * 40, 600)}ms`
                      }} 
                    />
                  </div>
                </div>
                <div className="click-hint" style={{ marginTop: '1rem' }}>View Profile →</div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedTeam && (
        <TeamProfile
          team={selectedTeam.team}
          teamDrivers={selectedTeam.teamDrivers}
          driverStandings={driverStandings}
          bios={bios}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}
