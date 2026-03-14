import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, getTeamColor } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2017 }, (_, i) => CURRENT_YEAR - i);
const SESSION_TYPES = ['R', 'Q', 'FP1', 'FP2', 'FP3', 'SQ', 'SR', 'S'];
const COMPOUND_COLORS = {
  SOFT: '#e10600', MEDIUM: '#f5c623', HARD: '#e8e8ee',
  INTERMEDIATE: '#45b649', WET: '#2d6dd1', UNKNOWN: '#888',
};

function fmtTime(s) {
  if (s == null || typeof s !== 'number') return '—';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return m > 0 ? `${m}:${sec.padStart(6, '0')}` : sec;
}

// ═══════════════════════════════════════
// CHART 1: LAP TIMES
// ═══════════════════════════════════════
function LapTimesChart({ data, colors, drivers, hideOutliers }) {
  if (!data.length) return null;
  const W = 820, H = 300, pad = { t: 20, r: 30, b: 40, l: 60 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const series = data.map(d => {
    const pts = [];
    d.forEach(row => {
      const t = row.LapTimeSeconds;
      if (typeof t === 'number' && t > 0) pts.push({ lap: row.LapNumber, time: t, compound: row.Compound });
    });
    return pts;
  });

  let allTimes = series.flat().map(p => p.time);
  if (hideOutliers && allTimes.length > 5) {
    const median = [...allTimes].sort((a, b) => a - b)[Math.floor(allTimes.length / 2)];
    const threshold = median * 1.07;
    allTimes = allTimes.filter(t => t <= threshold);
  }
  const allLaps = series.flat().map(p => p.lap);
  if (!allTimes.length) return null;

  const minT = Math.min(...allTimes) - 0.5, maxT = Math.max(...allTimes) + 0.5;
  const minL = Math.min(...allLaps), maxL = Math.max(...allLaps);
  const lapRange = maxL - minL || 1, tRange = maxT - minT || 1;
  const x = lap => pad.l + ((lap - minL) / lapRange) * iW;
  const y = t => pad.t + ((t - minT) / tRange) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {Array.from({ length: 6 }, (_, i) => {
        const val = minT + (i / 5) * tRange;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.06)" />
            <text x={pad.l - 8} y={y(val) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">{val.toFixed(1)}</text>
          </g>
        );
      })}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)">Lap Number</text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" transform={`rotate(-90 14 ${H / 2})`}>Lap Time (s)</text>
      {series.map((pts, si) => {
        const filtered = hideOutliers
          ? pts.filter(p => p.time <= (Math.min(...pts.map(pp => pp.time)) * 1.07))
          : pts;
        if (filtered.length < 2) return null;
        const line = filtered.map(p => `${x(p.lap)},${y(p.time)}`).join(' ');
        return (
          <g key={si}>
            <polyline points={line} fill="none" stroke={colors[si]} strokeWidth="1.8" strokeLinejoin="round" opacity="0.9" />
            {filtered.map((p, pi) => (
              <circle key={pi} cx={x(p.lap)} cy={y(p.time)} r="2.5"
                fill={COMPOUND_COLORS[p.compound] || colors[si]} stroke={colors[si]} strokeWidth="0.8" opacity="0.85">
                <title>{`Lap ${p.lap}: ${fmtTime(p.time)} (${p.compound || '?'})`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {drivers.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════
// CHART 2: TYRE STRATEGY
// ═══════════════════════════════════════
function TyreStrategyChart({ data, colors, drivers }) {
  if (!data.length) return null;
  const maxLap = Math.max(...data.flatMap(d => d.map(r => r.LapNumber)));
  if (!maxLap) return null;
  const barH = 24, gap = 6, padL = 50, padR = 20;
  const W = 820;
  const totalH = data.length * (barH + gap) + 30;
  const barW = W - padL - padR;

  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} className="telem-chart-svg">
      {Array.from({ length: Math.min(maxLap, 20) }, (_, i) => {
        const l = Math.round((i + 1) * maxLap / Math.min(maxLap, 20));
        const xp = padL + (l / maxLap) * barW;
        return (
          <g key={i}>
            <line x1={xp} y1={0} x2={xp} y2={totalH - 20} stroke="rgba(255,255,255,0.04)" />
            <text x={xp} y={totalH - 6} textAnchor="middle" fontSize="8" fill="var(--text-dim)">{l}</text>
          </g>
        );
      })}
      {data.map((driverLaps, di) => {
        const yBase = di * (barH + gap) + 4;
        const segments = [];
        let curStint = null, startLap = null, compound = null;
        driverLaps.forEach(row => {
          if (row.Stint !== curStint) {
            if (curStint != null) segments.push({ startLap, endLap: row.LapNumber - 1, compound });
            curStint = row.Stint;
            startLap = row.LapNumber;
            compound = row.Compound;
          }
        });
        if (curStint != null && driverLaps.length) {
          segments.push({ startLap, endLap: driverLaps[driverLaps.length - 1].LapNumber, compound });
        }
        return (
          <g key={di}>
            <text x={padL - 6} y={yBase + barH / 2 + 4} textAnchor="end" fontSize="10" fill={colors[di]} fontWeight="700">{drivers[di]}</text>
            {segments.map((seg, si) => {
              const sx = padL + ((seg.startLap - 1) / maxLap) * barW;
              const sw = ((seg.endLap - seg.startLap + 1) / maxLap) * barW;
              const cc = COMPOUND_COLORS[seg.compound] || '#888';
              return (
                <g key={si}>
                  <rect x={sx} y={yBase} width={Math.max(sw, 2)} height={barH} rx="3" fill={cc} opacity="0.75" />
                  {sw > 25 && <text x={sx + sw / 2} y={yBase + barH / 2 + 4} textAnchor="middle" fontSize="8" fill="#000" fontWeight="700">{seg.compound?.[0] || '?'}</text>}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════
// CHART 3: SECTOR COMPARISON (grouped bar)
// ═══════════════════════════════════════
function SectorCompChart({ data, colors, drivers }) {
  if (!data.length) return null;

  const bestSectors = data.map(d => {
    const s1 = d.filter(r => r.Sector1Seconds > 0).map(r => r.Sector1Seconds);
    const s2 = d.filter(r => r.Sector2Seconds > 0).map(r => r.Sector2Seconds);
    const s3 = d.filter(r => r.Sector3Seconds > 0).map(r => r.Sector3Seconds);
    return {
      s1: s1.length ? Math.min(...s1) : 0,
      s2: s2.length ? Math.min(...s2) : 0,
      s3: s3.length ? Math.min(...s3) : 0,
    };
  });

  const W = 820, H = 260, pad = { t: 20, r: 30, b: 40, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const sectors = ['s1', 's2', 's3'];
  const sectorLabels = ['Sector 1', 'Sector 2', 'Sector 3'];
  const numDrivers = drivers.length;
  const groupW = iW / 3;
  const barW = Math.min(30, (groupW - 20) / numDrivers);

  const allVals = bestSectors.flatMap(s => [s.s1, s.s2, s.s3]).filter(v => v > 0);
  if (!allVals.length) return null;
  const minV = Math.min(...allVals) - 0.5;
  const maxV = Math.max(...allVals) + 0.5;
  const vRange = maxV - minV || 1;
  const y = v => pad.t + iH - ((v - minV) / vRange) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {Array.from({ length: 6 }, (_, i) => {
        const val = minV + (i / 5) * vRange;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.06)" />
            <text x={pad.l - 8} y={y(val) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">{val.toFixed(1)}</text>
          </g>
        );
      })}
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" transform={`rotate(-90 14 ${H / 2})`}>Best Sector (s)</text>
      {sectors.map((sk, si) => {
        const gx = pad.l + si * groupW + groupW / 2;
        return (
          <g key={si}>
            <text x={gx} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{sectorLabels[si]}</text>
            {bestSectors.map((bs, di) => {
              const val = bs[sk];
              if (!val) return null;
              const bx = gx - (numDrivers * barW) / 2 + di * barW + 1;
              const bh = ((val - minV) / vRange) * iH;
              return (
                <g key={di}>
                  <rect x={bx} y={y(val)} width={barW - 2} height={bh} rx="2" fill={colors[di]} opacity="0.8">
                    <title>{`${drivers[di]} ${sectorLabels[si]}: ${fmtTime(val)}`}</title>
                  </rect>
                </g>
              );
            })}
          </g>
        );
      })}
      {drivers.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="8" fill={colors[i]} rx="2" />
          <text x="20" y="8" fontSize="9" fill="var(--text)" fontWeight="700">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════
// CHART 4: POSITION CHANGES
// ═══════════════════════════════════════
function PositionChart({ data, colors, drivers }) {
  if (!data.length) return null;
  const W = 820, H = 300, pad = { t: 20, r: 30, b: 40, l: 45 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const series = data.map(d => d.filter(r => r.Position > 0).map(r => ({ lap: r.LapNumber, pos: r.Position })));
  const allLaps = series.flat().map(p => p.lap);
  if (!allLaps.length) return null;
  const minL = Math.min(...allLaps), maxL = Math.max(...allLaps);
  const lapRange = maxL - minL || 1;
  const maxPos = 20;

  const x = lap => pad.l + ((lap - minL) / lapRange) * iW;
  const y = pos => pad.t + ((pos - 1) / (maxPos - 1)) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {[1, 5, 10, 15, 20].map(pos => (
        <g key={pos}>
          <line x1={pad.l} y1={y(pos)} x2={W - pad.r} y2={y(pos)} stroke="rgba(255,255,255,0.06)" />
          <text x={pad.l - 8} y={y(pos) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">P{pos}</text>
        </g>
      ))}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)">Lap Number</text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" transform={`rotate(-90 14 ${H / 2})`}>Position</text>
      {series.map((pts, si) => {
        if (pts.length < 2) return null;
        const line = pts.map(p => `${x(p.lap)},${y(p.pos)}`).join(' ');
        return <polyline key={si} points={line} fill="none" stroke={colors[si]} strokeWidth="2" strokeLinejoin="round" opacity="0.85" />;
      })}
      {drivers.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════
// CHART 5: SPEED TRACE (telemetry)
// ═══════════════════════════════════════
function SpeedTraceChart({ telData, colors, drivers }) {
  if (!telData.length) return null;
  const W = 820, H = 280, pad = { t: 20, r: 30, b: 40, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const allDist = telData.flatMap(t => (t || []).map(r => r.Distance));
  const allSpeed = telData.flatMap(t => (t || []).map(r => r.Speed));
  if (!allDist.length) return null;

  const maxD = Math.max(...allDist);
  const maxS = Math.max(...allSpeed) + 10;
  const minS = Math.max(0, Math.min(...allSpeed) - 10);
  const sRange = maxS - minS || 1;
  const x = d => pad.l + (d / (maxD || 1)) * iW;
  const y = s => pad.t + ((maxS - s) / sRange) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {Array.from({ length: 6 }, (_, i) => {
        const val = minS + (i / 5) * sRange;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.06)" />
            <text x={pad.l - 8} y={y(val) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">{Math.round(val)}</text>
          </g>
        );
      })}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)">Distance (m)</text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" transform={`rotate(-90 14 ${H / 2})`}>Speed (km/h)</text>
      {telData.map((td, si) => {
        if (!td?.length) return null;
        const step = Math.max(1, Math.floor(td.length / 400));
        const pts = [];
        for (let i = 0; i < td.length; i += step) pts.push(`${x(td[i].Distance)},${y(td[i].Speed)}`);
        return <polyline key={si} points={pts.join(' ')} fill="none" stroke={colors[si]} strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />;
      })}
      {drivers.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════
// CHART 6: THROTTLE + BRAKE
// ═══════════════════════════════════════
function ThrottleBrakeChart({ telData, colors, drivers }) {
  if (!telData.length) return null;
  const W = 820, H = 200, pad = { t: 15, r: 30, b: 35, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const allDist = telData.flatMap(t => (t || []).map(r => r.Distance));
  if (!allDist.length) return null;
  const maxD = Math.max(...allDist);
  const x = d => pad.l + (d / (maxD || 1)) * iW;
  const yThrottle = v => pad.t + ((100 - Math.min(100, Math.max(0, v))) / 100) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {[0, 25, 50, 75, 100].map((val, i) => (
        <g key={i}>
          <line x1={pad.l} y1={yThrottle(val)} x2={W - pad.r} y2={yThrottle(val)} stroke="rgba(255,255,255,0.06)" />
          <text x={pad.l - 8} y={yThrottle(val) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">{val}%</text>
        </g>
      ))}
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" transform={`rotate(-90 14 ${H / 2})`}>Throttle / Brake</text>
      {telData.map((td, si) => {
        if (!td?.length) return null;
        const step = Math.max(1, Math.floor(td.length / 400));
        // Throttle line (green)
        const throttlePts = [];
        for (let i = 0; i < td.length; i += step) throttlePts.push(`${x(td[i].Distance)},${yThrottle(td[i].Throttle)}`);
        // Brake zones (red rectangles)
        const brakeSegs = [];
        let inBrake = false, segStart = -1;
        for (let i = 0; i < td.length; i += step) {
          const on = td[i].Brake > 0;
          if (on && !inBrake) { segStart = i; inBrake = true; }
          if (!on && inBrake) { brakeSegs.push([segStart, i - step]); inBrake = false; }
        }
        if (inBrake) brakeSegs.push([segStart, td.length - 1]);
        return (
          <g key={si}>
            <polyline points={throttlePts.join(' ')} fill="none" stroke={si === 0 ? '#00d26a' : colors[si]} strokeWidth="1.5" strokeLinejoin="round" opacity="0.7" />
            {brakeSegs.map((seg, bi) => {
              const x1 = x(td[seg[0]].Distance);
              const x2 = x(td[seg[1]].Distance);
              return <rect key={bi} x={x1} y={pad.t + 2} width={Math.max(x2 - x1, 1)} height={iH - 4} fill={si === 0 ? '#e10600' : colors[si]} opacity="0.25" rx="1" />;
            })}
          </g>
        );
      })}
      <g transform={`translate(${pad.l + 10}, ${pad.t + 6})`}>
        <rect width="16" height="3" fill="#00d26a" rx="1" /><text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="600">Throttle</text>
      </g>
      <g transform={`translate(${pad.l + 100}, ${pad.t + 6})`}>
        <rect width="16" height="3" fill="#e10600" rx="1" /><text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="600">Brake</text>
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════
// CHART 7: TYRE DEGRADATION (scatter)
// ═══════════════════════════════════════
function TyreDegChart({ data, colors, drivers }) {
  if (!data.length) return null;
  const W = 820, H = 280, pad = { t: 20, r: 30, b: 40, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  // Group laps by stint for each driver
  const allByStint = data.map(d => {
    const stints = {};
    d.forEach(row => {
      const st = row.Stint || 0;
      if (!stints[st]) stints[st] = { compound: row.Compound, laps: [] };
      if (row.LapTimeSeconds > 0 && row.LapTimeSeconds < 200) {
        stints[st].laps.push({ lapInStint: stints[st].laps.length + 1, time: row.LapTimeSeconds });
      }
    });
    return stints;
  });

  const allTimes = allByStint.flatMap(s => Object.values(s).flatMap(st => st.laps.map(l => l.time)));
  const allStintLaps = allByStint.flatMap(s => Object.values(s).flatMap(st => st.laps.map(l => l.lapInStint)));
  if (!allTimes.length) return null;

  const minT = Math.min(...allTimes) - 0.5, maxT = Math.max(...allTimes) + 0.5;
  const maxSL = Math.max(...allStintLaps, 1);
  const tRange = maxT - minT || 1;
  const x = l => pad.l + ((l - 1) / (maxSL - 1 || 1)) * iW;
  const y = t => pad.t + ((t - minT) / tRange) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {Array.from({ length: 6 }, (_, i) => {
        const val = minT + (i / 5) * tRange;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.06)" />
            <text x={pad.l - 8} y={y(val) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">{val.toFixed(1)}</text>
          </g>
        );
      })}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)">Lap Number in Stint</text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" transform={`rotate(-90 14 ${H / 2})`}>Lap Time (s)</text>
      {allByStint.map((driverStints, di) =>
        Object.entries(driverStints).map(([stintNum, stint]) => {
          const cc = COMPOUND_COLORS[stint.compound] || colors[di];
          return (
            <g key={`${di}-${stintNum}`}>
              {stint.laps.length > 1 && (
                <polyline
                  points={stint.laps.map(l => `${x(l.lapInStint)},${y(l.time)}`).join(' ')}
                  fill="none" stroke={cc} strokeWidth="1" strokeDasharray="3 2" opacity="0.5"
                />
              )}
              {stint.laps.map((l, li) => (
                <circle key={li} cx={x(l.lapInStint)} cy={y(l.time)} r="3" fill={cc} opacity="0.8">
                  <title>{`${drivers[di]} S${stintNum} L${l.lapInStint}: ${fmtTime(l.time)} (${stint.compound})`}</title>
                </circle>
              ))}
            </g>
          );
        })
      )}
      {drivers.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════
function ChartSkeleton() {
  return <div className="skeleton-chart" />;
}

// ═══════════════════════════════════════
// MAIN ANALYSIS PAGE
// ═══════════════════════════════════════
export default function Analysis() {
  const [searchParams] = useSearchParams();

  // Controls state
  const [year, setYear] = useState(CURRENT_YEAR);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [sessionType, setSessionType] = useState('R');
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]);

  // Data state
  const [lapData, setLapData] = useState([]);
  const [telData, setTelData] = useState([]);
  const [status, setStatus] = useState('idle');
  const [loadingStep, setLoadingStep] = useState('');
  const [hideOutliers, setHideOutliers] = useState(true);

  // Load events when year changes
  useEffect(() => {
    setEvents([]);
    setSelectedEvent('');
    setAvailableDrivers([]);
    setSelectedDrivers([]);
    setLapData([]);
    setTelData([]);

    // Try TracingInsights first for event list
    api.tiEvents(year)
      .then(evts => {
        setEvents(evts);
        if (evts.length) setSelectedEvent(evts[evts.length - 1]); // Default to latest event
      })
      .catch(() => {
        // Fallback: try schedule
        api.schedule(year)
          .then(sched => {
            if (Array.isArray(sched)) {
              const names = sched.map(s => s.EventName || s.OfficialEventName).filter(Boolean);
              setEvents(names);
              if (names.length) setSelectedEvent(names[names.length - 1]);
            }
          })
          .catch(() => {});
      });
  }, [year]);

  // Load drivers when event changes
  useEffect(() => {
    if (!selectedEvent) return;
    setAvailableDrivers([]);
    setSelectedDrivers([]);
    setLapData([]);
    setTelData([]);

    api.tiSessions(year, selectedEvent)
      .then(sessions => {
        // Find matching session type
        const sessionNames = { R: 'Race', Q: 'Qualifying', FP1: 'Practice 1', FP2: 'Practice 2', FP3: 'Practice 3', SQ: 'Sprint Qualifying', SR: 'Sprint', S: 'Sprint' };
        const match = sessions.find(s => s === sessionNames[sessionType]) || sessions[sessions.length - 1];
        if (match) {
          return api.tiDrivers(year, selectedEvent, match);
        }
        return [];
      })
      .then(drivers => {
        const drvs = Array.isArray(drivers) ? drivers : (drivers?.drivers || []);
        if (Array.isArray(drvs)) {
          setAvailableDrivers(drvs);
          // Auto-select first 3
          setSelectedDrivers(drvs.slice(0, 3).map(d => d.driver || d.Driver || d.code || d));
        }
      })
      .catch((e) => {
        console.error('Failed to load drivers', e);
      });
  }, [selectedEvent, year, sessionType]);

  // Load data
  async function loadData() {
    if (!selectedEvent || selectedDrivers.length === 0) return;
    setStatus('loading');

    try {
      // Try FastF1 backend for lap data
      setLoadingStep('Loading lap times...');
      const sessionNames = { R: 'R', Q: 'Q', FP1: 'FP1', FP2: 'FP2', FP3: 'FP3', SQ: 'SQ', SR: 'SR', S: 'S' };
      let allLapData = [];

      try {
        const laps = await api.fastf1Laps(year, selectedEvent, sessionNames[sessionType]);
        if (Array.isArray(laps)) {
          allLapData = selectedDrivers.map(code => laps.filter(l => l.Driver === code));
        }
      } catch {
        // Fallback to TracingInsights
        const sessions = await api.tiSessions(year, selectedEvent);
        const sessionName = { R: 'Race', Q: 'Qualifying', FP1: 'Practice 1', FP2: 'Practice 2', FP3: 'Practice 3' };
        const match = sessions.find(s => s === sessionName[sessionType]) || sessions[sessions.length - 1];
        if (match) {
          const driverLaps = await Promise.all(
            selectedDrivers.map(code => api.tiLaptimes(year, selectedEvent, match, code).catch(() => null))
          );
          allLapData = driverLaps.map(dl => {
            if (!dl) return [];
            return (dl.lap || []).map((lap, i) => ({
              Driver: dl.driver || '',
              LapNumber: lap,
              LapTimeSeconds: dl.time?.[i],
              Compound: dl.compound?.[i],
              Sector1Seconds: dl.s1?.[i],
              Sector2Seconds: dl.s2?.[i],
              Sector3Seconds: dl.s3?.[i],
              Stint: dl.stint?.[i],
              Position: dl.position?.[i],
            }));
          });
        }
      }

      setLapData(allLapData);

      // Try telemetry for selected drivers
      setLoadingStep('Loading telemetry...');
      try {
        const telPromises = selectedDrivers.map(code =>
          api.fastf1Telemetry(year, selectedEvent, sessionNames[sessionType], code).catch(() => null)
        );
        const telResults = await Promise.all(telPromises);
        setTelData(telResults.map(t => (Array.isArray(t) ? t : null)));
      } catch {
        setTelData([]);
      }

      setStatus('loaded');
    } catch (e) {
      console.error('Analysis load error:', e);
      setStatus('error');
    }
  }

  function toggleDriver(code) {
    setSelectedDrivers(prev => {
      if (prev.includes(code)) return prev.filter(c => c !== code);
      if (prev.length >= 5) return prev;
      return [...prev, code];
    });
  }

  const driverColors = selectedDrivers.map((_, i) => ['#e10600', '#00d7b6', '#4781d7', '#f5c623', '#ff8c00'][i] || '#888');
  const isRace = sessionType === 'R' || sessionType === 'SR' || sessionType === 'S';

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Analysis</h1>
        <button
          type="button"
          className="info-badge"
          title="Data combines FastF1 and Tracing Insights sources depending on availability."
          aria-label="Analysis data source information"
        >
          i
        </button>
      </div>

      {/* Controls Bar */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          <div className="telem-selectors">
            <div className="telem-select-group">
              <label>Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="telem-select-group">
              <label>Event</label>
              <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>
            <div className="telem-select-group">
              <label>Session</label>
              <select value={sessionType} onChange={e => setSessionType(e.target.value)}>
                {SESSION_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Driver selection pills */}
          {availableDrivers.length > 0 && (
            <div className="telem-driver-chips">
              <label>Drivers (max 5)</label>
              <div className="driver-chips-row">
                {availableDrivers.map(d => {
                  const code = typeof d === 'string' ? d : d.driver || d.Driver || d.code;
                  const team = typeof d === 'object' ? (d.team || d.Team || '') : '';
                  const color = getTeamColor(team);
                  const active = selectedDrivers.includes(code);
                  return (
                    <button
                      key={code}
                      className={`driver-chip${active ? ' active' : ''}`}
                      style={active ? { borderColor: color, color: color, background: `${color}15` } : {}}
                      onClick={() => toggleDriver(code)}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <button
              className="telem-load-btn"
              onClick={loadData}
              disabled={status === 'loading' || selectedDrivers.length === 0}
            >
              {status === 'loading' ? loadingStep : 'Load Analysis ▶'}
            </button>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
              <input type="checkbox" checked={hideOutliers} onChange={e => setHideOutliers(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--f1-red)', cursor: 'pointer' }} />
              Hide outlier laps (&gt;107%)
            </label>
          </div>
        </div>
      </div>

      {/* Error state */}
      {status === 'error' && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-body" style={{ padding: '2rem', textAlign: 'center' }}>
            <ErrorMsg text="Unable to load this session yet. Some datasets become available shortly after the session ends." />
          </div>
        </div>
      )}

      {/* Charts */}
      {status === 'loaded' && lapData.length > 0 && (
        <>
          {/* 1. Lap Times */}
          <div className="telem-section">
            <div className="telem-section-title">Lap Times</div>
            <div className="card"><div className="card-body" style={{ padding: '1rem' }}>
              <LapTimesChart data={lapData} colors={driverColors} drivers={selectedDrivers} hideOutliers={hideOutliers} />
            </div></div>
          </div>

          {/* 2. Tyre Strategy */}
          {isRace && (
            <div className="telem-section">
              <div className="telem-section-title">Tyre Strategy</div>
              <div className="card"><div className="card-body" style={{ padding: '1rem' }}>
                <TyreStrategyChart data={lapData} colors={driverColors} drivers={selectedDrivers} />
              </div></div>
            </div>
          )}

          {/* 3. Sector Comparison */}
          <div className="telem-section">
            <div className="telem-section-title">Best Sector Comparison</div>
            <div className="card"><div className="card-body" style={{ padding: '1rem' }}>
              <SectorCompChart data={lapData} colors={driverColors} drivers={selectedDrivers} />
            </div></div>
          </div>

          {/* 4. Position Changes (race only) */}
          {isRace && (
            <div className="telem-section">
              <div className="telem-section-title">Position Changes</div>
              <div className="axis-direction-hint">Axis note: top of the chart is P1, lower lines are further back.</div>
              <div className="card"><div className="card-body" style={{ padding: '1rem' }}>
                <PositionChart data={lapData} colors={driverColors} drivers={selectedDrivers} />
              </div></div>
            </div>
          )}

          {/* 5. Speed Trace (if telemetry loaded) */}
          {telData.some(t => t && t.length > 0) && (
            <div className="telem-section">
              <div className="telem-section-title">Speed Trace</div>
              <div className="card"><div className="card-body" style={{ padding: '1rem' }}>
                <SpeedTraceChart telData={telData} colors={driverColors} drivers={selectedDrivers} />
              </div></div>
            </div>
          )}

          {/* 6. Throttle & Brake (if telemetry loaded) */}
          {telData.some(t => t && t.length > 0) && (
            <div className="telem-section">
              <div className="telem-section-title">Throttle & Brake</div>
              <div className="card"><div className="card-body" style={{ padding: '1rem' }}>
                <ThrottleBrakeChart telData={telData} colors={driverColors} drivers={selectedDrivers} />
              </div></div>
            </div>
          )}

          {/* 7. Tyre Degradation */}
          {isRace && (
            <div className="telem-section">
              <div className="telem-section-title">Tyre Degradation</div>
              <div className="card"><div className="card-body" style={{ padding: '1rem' }}>
                <TyreDegChart data={lapData} colors={driverColors} drivers={selectedDrivers} />
              </div></div>
            </div>
          )}
        </>
      )}

      {/* Loading skeletons */}
      {status === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <ChartSkeleton /><ChartSkeleton /><ChartSkeleton />
        </div>
      )}
    </>
  );
}
