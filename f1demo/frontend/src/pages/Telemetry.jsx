import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2017 }, (_, i) => CURRENT_YEAR - i);
const SESSION_MAP = { 'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3', 'Qualifying': 'Q', 'Race': 'R', 'Sprint': 'S', 'Sprint Qualifying': 'SQ', 'Sprint Shootout': 'SS' };

const COMPOUND_COLORS = { SOFT: '#e10600', MEDIUM: '#f5c623', HARD: '#eee', INTERMEDIATE: '#45b649', WET: '#2d6dd1', UNKNOWN: '#888' };

function formatTime(s) {
  if (s == null || s === 'None' || typeof s !== 'number') return '—';
  const min = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return min > 0 ? `${min}:${sec.padStart(6, '0')}` : sec;
}

// ── SVG Lap Time Chart ──
function LapTimeChart({ driversData, colors }) {
  if (!driversData.length) return null;
  const W = 820, H = 300, pad = { t: 20, r: 30, b: 40, l: 60 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  // Collect valid lap/time pairs
  const series = driversData.map(d => {
    const pts = [];
    d.time.forEach((t, i) => {
      if (typeof t === 'number' && t > 0 && t < 200) pts.push({ lap: d.lap[i], time: t, compound: d.compound?.[i] });
    });
    return pts;
  });

  const allTimes = series.flat().map(p => p.time);
  const allLaps = series.flat().map(p => p.lap);
  if (!allTimes.length) return null;

  const minT = Math.min(...allTimes) - 1;
  const maxT = Math.max(...allTimes) + 1;
  const minL = Math.min(...allLaps);
  const maxL = Math.max(...allLaps);
  const lapRange = maxL - minL || 1;
  const tRange = maxT - minT || 1;

  const x = lap => pad.l + ((lap - minL) / lapRange) * iW;
  const y = t => pad.t + ((t - minT) / tRange) * iH;

  // Grid lines
  const tSteps = 5;
  const gridLines = Array.from({ length: tSteps + 1 }, (_, i) => {
    const val = minT + (i / tSteps) * tRange;
    return { y: y(val), label: val.toFixed(1) };
  });

  const lapTicks = [];
  const step = Math.max(1, Math.ceil(lapRange / 15));
  for (let l = minL; l <= maxL; l += step) lapTicks.push(l);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={pad.l} y1={g.y} x2={W - pad.r} y2={g.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={pad.l - 8} y={g.y + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)" fontFamily="Titillium Web">{g.label}</text>
        </g>
      ))}
      {lapTicks.map(l => (
        <text key={l} x={x(l)} y={H - pad.b + 16} textAnchor="middle" fontSize="9" fill="var(--text-dim)" fontFamily="Titillium Web">{l}</text>
      ))}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web">Lap Number</text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web" transform={`rotate(-90 14 ${H / 2})`}>Lap Time (s)</text>

      {series.map((pts, si) => {
        if (pts.length < 2) return null;
        const line = pts.map(p => `${x(p.lap)},${y(p.time)}`).join(' ');
        return (
          <g key={si}>
            <polyline points={line} fill="none" stroke={colors[si]} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
            {pts.map((p, pi) => (
              <circle key={pi} cx={x(p.lap)} cy={y(p.time)} r="3" fill={COMPOUND_COLORS[p.compound] || colors[si]} stroke={colors[si]} strokeWidth="1" opacity="0.85">
                <title>{`Lap ${p.lap}: ${formatTime(p.time)} (${p.compound || '?'})`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ── SVG Speed vs Distance Chart ──
function SpeedDistChart({ telData, colors, driverCodes }) {
  if (!telData.length) return null;
  const W = 820, H = 280, pad = { t: 20, r: 30, b: 40, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const allDist = telData.flatMap(t => t.distance || []);
  const allSpeed = telData.flatMap(t => t.speed || []);
  if (!allDist.length) return null;

  const maxD = Math.max(...allDist);
  const maxS = Math.max(...allSpeed) + 10;
  const minS = Math.max(0, Math.min(...allSpeed) - 10);
  const sRange = maxS - minS || 1;

  const x = d => pad.l + (d / (maxD || 1)) * iW;
  const y = s => pad.t + ((maxS - s) / sRange) * iH;

  const sSteps = 5;
  const gridLines = Array.from({ length: sSteps + 1 }, (_, i) => {
    const val = minS + (i / sSteps) * sRange;
    return { y: y(val), label: Math.round(val) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={pad.l} y1={g.y} x2={W - pad.r} y2={g.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={pad.l - 8} y={g.y + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)" fontFamily="Titillium Web">{g.label}</text>
        </g>
      ))}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web">Distance (m)</text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web" transform={`rotate(-90 14 ${H / 2})`}>Speed (km/h)</text>

      {telData.map((td, si) => {
        if (!td.speed?.length || !td.distance?.length) return null;
        const step = Math.max(1, Math.floor(td.speed.length / 400));
        const pts = [];
        for (let i = 0; i < td.speed.length; i += step) {
          pts.push(`${x(td.distance[i])},${y(td.speed[i])}`);
        }
        return (
          <g key={si}>
            <polyline points={pts.join(' ')} fill="none" stroke={colors[si]} strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />
          </g>
        );
      })}

      {/* Legend */}
      {driverCodes.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700" fontFamily="Titillium Web">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Throttle vs Distance Chart ──
function ThrottleChart({ telData, colors, driverCodes }) {
  if (!telData.length) return null;
  const W = 820, H = 180, pad = { t: 15, r: 30, b: 35, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const allDist = telData.flatMap(t => t.distance || []);
  if (!allDist.length) return null;
  const maxD = Math.max(...allDist);

  const x = d => pad.l + (d / (maxD || 1)) * iW;
  const y = v => pad.t + ((100 - v) / 100) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {[0, 25, 50, 75, 100].map((val, i) => (
        <g key={i}>
          <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={pad.l - 8} y={y(val) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)" fontFamily="Titillium Web">{val}%</text>
        </g>
      ))}
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web" transform={`rotate(-90 14 ${H / 2})`}>Throttle</text>

      {telData.map((td, si) => {
        const throttle = td.throttle || td.Throttle || [];
        const dist = td.distance || td.Distance || [];
        if (!throttle.length || !dist.length) return null;
        const step = Math.max(1, Math.floor(throttle.length / 400));
        const pts = [];
        for (let i = 0; i < throttle.length && i < dist.length; i += step) {
          const v = Math.min(100, Math.max(0, throttle[i]));
          pts.push(`${x(dist[i])},${y(v)}`);
        }
        return <polyline key={si} points={pts.join(' ')} fill="none" stroke={colors[si]} strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />;
      })}

      {driverCodes.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700" fontFamily="Titillium Web">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Brake vs Distance Chart ──
function BrakeChart({ telData, colors, driverCodes }) {
  if (!telData.length) return null;
  const W = 820, H = 140, pad = { t: 15, r: 30, b: 30, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const allDist = telData.flatMap(t => t.distance || []);
  if (!allDist.length) return null;
  const maxD = Math.max(...allDist);

  const x = d => pad.l + (d / (maxD || 1)) * iW;
  const y = v => pad.t + ((1 - v) * iH);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      <line x1={pad.l} y1={y(0)} x2={W - pad.r} y2={y(0)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <line x1={pad.l} y1={y(1)} x2={W - pad.r} y2={y(1)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <text x={pad.l - 8} y={y(0) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)" fontFamily="Titillium Web">Off</text>
      <text x={pad.l - 8} y={y(1) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)" fontFamily="Titillium Web">On</text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web" transform={`rotate(-90 14 ${H / 2})`}>Brake</text>

      {telData.map((td, si) => {
        const brake = td.brake || td.Brake || [];
        const dist = td.distance || td.Distance || [];
        if (!brake.length || !dist.length) return null;
        const step = Math.max(1, Math.floor(brake.length / 400));

        // Render as filled regions for brake zones
        let segments = [];
        let inBrake = false, segStart = -1;
        for (let i = 0; i < brake.length && i < dist.length; i += step) {
          const on = brake[i] > 0;
          if (on && !inBrake) { segStart = i; inBrake = true; }
          if (!on && inBrake) {
            segments.push([segStart, i - step]);
            inBrake = false;
          }
        }
        if (inBrake) segments.push([segStart, Math.min(brake.length, dist.length) - 1]);

        return (
          <g key={si}>
            {segments.map((seg, si2) => {
              const x1 = x(dist[seg[0]]);
              const x2 = x(dist[seg[1]]);
              return <rect key={si2} x={x1} y={pad.t + 2} width={Math.max(x2 - x1, 1)} height={iH - 4} fill={colors[si]} opacity="0.6" rx="1" />;
            })}
          </g>
        );
      })}

      {driverCodes.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700" fontFamily="Titillium Web">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Gear vs Distance Chart ──
function GearChart({ telData, colors, driverCodes }) {
  if (!telData.length) return null;
  const W = 820, H = 180, pad = { t: 15, r: 30, b: 35, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const allDist = telData.flatMap(t => t.distance || []);
  if (!allDist.length) return null;
  const maxD = Math.max(...allDist);

  const x = d => pad.l + (d / (maxD || 1)) * iW;
  const y = g => pad.t + ((8 - g) / 8) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {[0, 2, 4, 6, 8].map((val, i) => (
        <g key={i}>
          <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={pad.l - 8} y={y(val) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)" fontFamily="Titillium Web">{val}</text>
        </g>
      ))}
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web" transform={`rotate(-90 14 ${H / 2})`}>Gear</text>

      {telData.map((td, si) => {
        const gear = td.nGear || td.gear || td.Gear || [];
        const dist = td.distance || td.Distance || [];
        if (!gear.length || !dist.length) return null;
        const step = Math.max(1, Math.floor(gear.length / 400));
        const pts = [];
        for (let i = 0; i < gear.length && i < dist.length; i += step) {
          pts.push(`${x(dist[i])},${y(Math.min(8, Math.max(0, gear[i])))}`);
        }
        return <polyline key={si} points={pts.join(' ')} fill="none" stroke={colors[si]} strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />;
      })}

      {driverCodes.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700" fontFamily="Titillium Web">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ── RPM vs Distance Chart ──
function RPMChart({ telData, colors, driverCodes }) {
  if (!telData.length) return null;
  const W = 820, H = 200, pad = { t: 15, r: 30, b: 35, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const allDist = telData.flatMap(t => t.distance || []);
  const allRPM = telData.flatMap(t => (t.rpm || t.RPM || []).filter(v => typeof v === 'number' && v > 0));
  if (!allDist.length || !allRPM.length) return null;
  const maxD = Math.max(...allDist);
  const maxR = Math.max(...allRPM);
  const minR = Math.max(0, Math.min(...allRPM) - 500);
  const rRange = maxR - minR || 1;

  const x = d => pad.l + (d / (maxD || 1)) * iW;
  const y = r => pad.t + ((maxR - r) / rRange) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {Array.from({ length: 6 }, (_, i) => {
        const val = minR + (i / 5) * rRange;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={pad.l - 8} y={y(val) + 4} textAnchor="end" fontSize="8" fill="var(--text-dim)" fontFamily="Titillium Web">{(val / 1000).toFixed(1)}k</text>
          </g>
        );
      })}
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web" transform={`rotate(-90 14 ${H / 2})`}>RPM</text>

      {telData.map((td, si) => {
        const rpm = td.rpm || td.RPM || [];
        const dist = td.distance || td.Distance || [];
        if (!rpm.length || !dist.length) return null;
        const step = Math.max(1, Math.floor(rpm.length / 400));
        const pts = [];
        for (let i = 0; i < rpm.length && i < dist.length; i += step) {
          if (typeof rpm[i] === 'number' && rpm[i] > 0) pts.push(`${x(dist[i])},${y(rpm[i])}`);
        }
        if (pts.length < 2) return null;
        return <polyline key={si} points={pts.join(' ')} fill="none" stroke={colors[si]} strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />;
      })}

      {driverCodes.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700" fontFamily="Titillium Web">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ── DRS vs Distance Chart ──
function DRSChart({ telData, colors, driverCodes }) {
  if (!telData.length) return null;
  const W = 820, H = 100, pad = { t: 15, r: 30, b: 25, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const allDist = telData.flatMap(t => t.distance || []);
  if (!allDist.length) return null;
  const maxD = Math.max(...allDist);
  const x = d => pad.l + (d / (maxD || 1)) * iW;

  const hasDRS = telData.some(td => {
    const drs = td.drs || td.DRS || [];
    return drs.some(v => v > 0);
  });
  if (!hasDRS) return null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web" transform={`rotate(-90 14 ${H / 2})`}>DRS</text>
      <line x1={pad.l} y1={pad.t + iH} x2={W - pad.r} y2={pad.t + iH} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {telData.map((td, si) => {
        const drs = td.drs || td.DRS || [];
        const dist = td.distance || td.Distance || [];
        if (!drs.length || !dist.length) return null;
        const step = Math.max(1, Math.floor(drs.length / 600));
        const barH = Math.max(8, (iH - 8) / telData.length);
        const yOff = pad.t + si * (barH + 2);

        let segments = [];
        let inDRS = false, segStart = -1;
        for (let i = 0; i < drs.length && i < dist.length; i += step) {
          const on = drs[i] > 0;
          if (on && !inDRS) { segStart = i; inDRS = true; }
          if (!on && inDRS) { segments.push([segStart, i - step]); inDRS = false; }
        }
        if (inDRS) segments.push([segStart, Math.min(drs.length, dist.length) - 1]);

        return (
          <g key={si}>
            {segments.map((seg, si2) => {
              const x1 = x(dist[seg[0]]);
              const x2 = x(dist[seg[1]]);
              return <rect key={si2} x={x1} y={yOff} width={Math.max(x2 - x1, 1)} height={barH} fill={colors[si]} opacity="0.7" rx="2" />;
            })}
          </g>
        );
      })}

      {driverCodes.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700" fontFamily="Titillium Web">{code}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Delta Time Chart ──
function DeltaChart({ telData, colors, driverCodes }) {
  if (telData.length < 2) return null;
  const ref = telData[0];
  const W = 820, H = 200, pad = { t: 20, r: 30, b: 35, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const refDist = ref.distance || [];
  const refTime = ref.time || ref.Time || [];
  if (!refDist.length || !refTime.length) return null;
  const maxD = Math.max(...refDist);

  // Build time-at-distance lookup for reference
  const refTimeAtDist = (d) => {
    let lo = 0, hi = refDist.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (refDist[mid] < d) lo = mid + 1; else hi = mid; }
    return refTime[lo];
  };

  // Calculate deltas for each comparison driver
  const deltaArrays = telData.slice(1).map(td => {
    const dist = td.distance || [];
    const time = td.time || td.Time || [];
    const deltas = [];
    const step = Math.max(1, Math.floor(dist.length / 400));
    for (let i = 0; i < dist.length && i < time.length; i += step) {
      const rt = refTimeAtDist(dist[i]);
      if (rt != null && time[i] != null) {
        deltas.push({ dist: dist[i], delta: time[i] - rt });
      }
    }
    return deltas;
  });

  const allDeltas = deltaArrays.flat().map(d => d.delta);
  if (!allDeltas.length) return null;
  const maxDelta = Math.max(Math.abs(Math.min(...allDeltas)), Math.abs(Math.max(...allDeltas)), 0.5);

  const x = d => pad.l + (d / (maxD || 1)) * iW;
  const y = d => pad.t + iH / 2 - (d / maxDelta) * (iH / 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
      {/* Zero line */}
      <line x1={pad.l} y1={y(0)} x2={W - pad.r} y2={y(0)} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />
      {/* Grid */}
      {[-maxDelta, -maxDelta/2, 0, maxDelta/2, maxDelta].map((val, i) => (
        <g key={i}>
          <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <text x={pad.l - 8} y={y(val) + 4} textAnchor="end" fontSize="8" fill="var(--text-dim)" fontFamily="Titillium Web">
            {val > 0 ? '+' : ''}{val.toFixed(1)}s
          </text>
        </g>
      ))}
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web" transform={`rotate(-90 14 ${H / 2})`}>Delta (s)</text>

      {/* Positive = slower (red zone), Negative = faster (green zone) */}
      <rect x={pad.l} y={pad.t} width={iW} height={iH / 2} fill="rgba(225,6,0,0.03)" />
      <rect x={pad.l} y={pad.t + iH / 2} width={iW} height={iH / 2} fill="rgba(0,210,106,0.03)" />
      <text x={W - pad.r - 5} y={pad.t + 14} textAnchor="end" fontSize="8" fill="rgba(225,6,0,0.4)" fontFamily="Titillium Web">SLOWER</text>
      <text x={W - pad.r - 5} y={pad.t + iH - 4} textAnchor="end" fontSize="8" fill="rgba(0,210,106,0.4)" fontFamily="Titillium Web">FASTER</text>

      {deltaArrays.map((deltas, si) => {
        if (deltas.length < 2) return null;
        const pts = deltas.map(d => `${x(d.dist)},${y(d.delta)}`).join(' ');
        return <polyline key={si} points={pts} fill="none" stroke={colors[si + 1]} strokeWidth="2" strokeLinejoin="round" opacity="0.9" />;
      })}

      {driverCodes.map((code, i) => (
        <g key={i} transform={`translate(${pad.l + 10 + i * 90}, ${pad.t + 6})`}>
          <rect width="16" height="3" fill={i === 0 ? '#fff' : colors[i]} rx="1" />
          <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700" fontFamily="Titillium Web">{code}{i === 0 ? ' (ref)' : ''}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Sector Analysis Chart ──
function SectorChart({ driversData, colors, driverCodes }) {
  if (!driversData.length) return null;
  const [visibleSectors, setVisibleSectors] = useState({ s1: true, s2: true, s3: true });

  const W = 820, H = 280, pad = { t: 20, r: 30, b: 40, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  // Collect all sector values
  const allVals = [];
  const allLaps = [];
  driversData.forEach(d => {
    ['s1', 's2', 's3'].forEach(sk => {
      if (!visibleSectors[sk] || !d[sk]) return;
      d[sk].forEach((v, i) => {
        if (typeof v === 'number' && v > 0 && v < 60) {
          allVals.push(v);
          allLaps.push(d.lap[i]);
        }
      });
    });
  });
  if (!allVals.length) return <div className="telem-no-data">No sector data available</div>;

  const minV = Math.min(...allVals) - 0.5;
  const maxV = Math.max(...allVals) + 0.5;
  const minL = Math.min(...allLaps);
  const maxL = Math.max(...allLaps);
  const lapRange = maxL - minL || 1;
  const vRange = maxV - minV || 1;

  const x = lap => pad.l + ((lap - minL) / lapRange) * iW;
  const y = v => pad.t + ((v - minV) / vRange) * iH;

  const sectorColors = { s1: '#3b82f6', s2: '#f5c623', s3: '#e044a7' };

  return (
    <div>
      <div className="sector-toggles">
        {['s1', 's2', 's3'].map(sk => (
          <button key={sk} className={`sector-toggle ${visibleSectors[sk] ? 'active' : ''}`}
            style={{ '--sc': sectorColors[sk] }}
            onClick={() => setVisibleSectors(p => ({ ...p, [sk]: !p[sk] }))}>
            {sk.toUpperCase()}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
        {/* Grid */}
        {Array.from({ length: 6 }, (_, i) => {
          const val = minV + (i / 5) * vRange;
          return (
            <g key={i}>
              <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={pad.l - 8} y={y(val) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)" fontFamily="Titillium Web">{val.toFixed(1)}</text>
            </g>
          );
        })}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web">Lap Number</text>
        <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Titillium Web" transform={`rotate(-90 14 ${H / 2})`}>Sector Time (s)</text>

        {driversData.map((d, di) => (
          ['s1', 's2', 's3'].map(sk => {
            if (!visibleSectors[sk] || !d[sk]) return null;
            const pts = [];
            d[sk].forEach((v, i) => {
              if (typeof v === 'number' && v > 0 && v < 60) pts.push({ lap: d.lap[i], val: v });
            });
            if (pts.length < 2) return null;
            const line = pts.map(p => `${x(p.lap)},${y(p.val)}`).join(' ');
            return (
              <polyline key={`${di}-${sk}`} points={line} fill="none" stroke={sectorColors[sk]} strokeWidth="1.5" strokeLinejoin="round" opacity={0.4 + di * 0.2} strokeDasharray={di > 0 ? '4 2' : 'none'} />
            );
          })
        ))}

        {/* Legend */}
        {driverCodes.map((code, i) => (
          <g key={i} transform={`translate(${pad.l + 10 + i * 80}, ${pad.t + 6})`}>
            <line x1="0" y1="0" x2="16" y2="0" stroke={colors[i]} strokeWidth="2" strokeDasharray={i > 0 ? '4 2' : 'none'} />
            <text x="20" y="4" fontSize="9" fill="var(--text)" fontWeight="700" fontFamily="Titillium Web">{code}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Stint Analysis Chart per Driver ──
function StintChart({ laptimeData, color, driverCode }) {
  if (!laptimeData?.time?.length) return null;

  // Group laps by stint
  const stints = {};
  laptimeData.stint?.forEach((st, i) => {
    if (st == null) return;
    if (!stints[st]) stints[st] = { compound: laptimeData.compound?.[i] || '?', laps: [] };
    const t = laptimeData.time[i];
    if (typeof t === 'number' && t > 0 && t < 200) {
      stints[st].laps.push({ lapInStint: stints[st].laps.length + 1, time: t, lap: laptimeData.lap[i] });
    }
  });

  const stintEntries = Object.entries(stints);
  if (!stintEntries.length) return null;

  const [visible, setVisible] = useState(() => Object.fromEntries(stintEntries.map(([k]) => [k, true])));

  const allTimes = stintEntries.filter(([k]) => visible[k]).flatMap(([, s]) => s.laps.map(l => l.time));
  const allStintLaps = stintEntries.filter(([k]) => visible[k]).flatMap(([, s]) => s.laps.map(l => l.lapInStint));
  if (!allTimes.length) return <div className="telem-no-data">Toggle stints to view</div>;

  const W = 400, H = 200, pad = { t: 15, r: 20, b: 35, l: 50 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const minT = Math.min(...allTimes) - 0.5;
  const maxT = Math.max(...allTimes) + 0.5;
  const maxSL = Math.max(...allStintLaps);
  const tRange = maxT - minT || 1;

  const x = l => pad.l + ((l - 1) / (maxSL - 1 || 1)) * iW;
  const y = t => pad.t + ((t - minT) / tRange) * iH;

  return (
    <div className="stint-chart-container">
      <div className="stint-driver-label" style={{ color }}>{driverCode}</div>
      <div className="stint-toggles">
        {stintEntries.map(([k, s]) => (
          <button key={k} className={`stint-toggle ${visible[k] ? 'active' : ''}`}
            style={{ '--sc': COMPOUND_COLORS[s.compound] || '#888' }}
            onClick={() => setVisible(p => ({ ...p, [k]: !p[k] }))}>
            Stint {k} - {s.compound?.[0] || '?'}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="telem-chart-svg">
        {Array.from({ length: 5 }, (_, i) => {
          const val = minT + (i / 4) * tRange;
          return (
            <g key={i}>
              <line x1={pad.l} y1={y(val)} x2={W - pad.r} y2={y(val)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={pad.l - 6} y={y(val) + 3} textAnchor="end" fontSize="8" fill="var(--text-dim)" fontFamily="Titillium Web">{val.toFixed(1)}</text>
            </g>
          );
        })}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="Titillium Web">Lap number within stint</text>
        <text x={10} y={H / 2} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="Titillium Web" transform={`rotate(-90 10 ${H / 2})`}>Lap time (s)</text>

        {stintEntries.map(([k, s]) => {
          if (!visible[k] || s.laps.length < 1) return null;
          const cColor = COMPOUND_COLORS[s.compound] || '#888';
          const line = s.laps.map(l => `${x(l.lapInStint)},${y(l.time)}`).join(' ');
          return (
            <g key={k}>
              {s.laps.length > 1 && <polyline points={line} fill="none" stroke={cColor} strokeWidth="1.5" strokeLinejoin="round" opacity="0.8" />}
              {s.laps.map((l, li) => (
                <circle key={li} cx={x(l.lapInStint)} cy={y(l.time)} r="3" fill={cColor} opacity="0.9">
                  <title>{`Stint ${k} Lap ${l.lapInStint}: ${formatTime(l.time)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Tyre Strategy Timeline ──
function TyreStrategy({ driversData, colors, driverCodes }) {
  if (!driversData.length) return null;

  const maxLap = Math.max(...driversData.flatMap(d => d.lap || []));
  if (!maxLap) return null;
  const barH = 22, gap = 6, padL = 50, padR = 20;
  const W = 820;
  const totalH = driversData.length * (barH + gap) + 30;
  const barW = W - padL - padR;

  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} className="telem-chart-svg">
      {/* Lap markers */}
      {Array.from({ length: Math.min(maxLap, 30) }, (_, i) => {
        const l = Math.round((i + 1) * maxLap / Math.min(maxLap, 30));
        const xp = padL + (l / maxLap) * barW;
        return (
          <g key={i}>
            <line x1={xp} y1={0} x2={xp} y2={totalH - 20} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={xp} y={totalH - 6} textAnchor="middle" fontSize="8" fill="var(--text-dim)" fontFamily="Titillium Web">{l}</text>
          </g>
        );
      })}

      {driversData.map((d, di) => {
        const yBase = di * (barH + gap) + 4;
        // Build stint segments
        const segments = [];
        let curStint = null, startLap = null;
        d.stint?.forEach((st, i) => {
          if (st !== curStint) {
            if (curStint != null) segments.push({ stint: curStint, startLap, endLap: d.lap[i - 1], compound: d.compound?.[i - 1] });
            curStint = st;
            startLap = d.lap[i];
          }
        });
        if (curStint != null) segments.push({ stint: curStint, startLap, endLap: d.lap[d.lap.length - 1], compound: d.compound?.[d.compound.length - 1] });

        return (
          <g key={di}>
            <text x={padL - 6} y={yBase + barH / 2 + 4} textAnchor="end" fontSize="10" fill={colors[di]} fontWeight="700" fontFamily="Titillium Web">{driverCodes[di]}</text>
            {segments.map((seg, si) => {
              const sx = padL + ((seg.startLap - 1) / maxLap) * barW;
              const sw = ((seg.endLap - seg.startLap + 1) / maxLap) * barW;
              const cc = COMPOUND_COLORS[seg.compound] || '#888';
              return (
                <g key={si}>
                  <rect x={sx} y={yBase} width={Math.max(sw, 2)} height={barH} rx="3" fill={cc} opacity="0.75" />
                  {sw > 20 && <text x={sx + sw / 2} y={yBase + barH / 2 + 4} textAnchor="middle" fontSize="8" fill="#000" fontWeight="700" fontFamily="Titillium Web">{seg.endLap - seg.startLap + 1}</text>}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ── Lap Summary Card ──
function LapSummaryCard({ driver, lapData, lapNum, color }) {
  if (!lapData) return null;
  const idx = lapData.lap?.indexOf(lapNum);
  if (idx == null || idx < 0) return null;

  const time = lapData.time?.[idx];
  const s1 = lapData.s1?.[idx];
  const s2 = lapData.s2?.[idx];
  const s3 = lapData.s3?.[idx];
  const compound = lapData.compound?.[idx];

  return (
    <div className="lap-summary-card" style={{ borderColor: color }}>
      <div className="lap-summary-header">
        <img src={driver.url} alt={driver.driver} className="lap-summary-photo" onError={e => { e.target.style.display = 'none'; }} />
        <div>
          <div className="lap-summary-driver">{driver.fn} {driver.ln}</div>
          <div className="lap-summary-team" style={{ color }}>{driver.team}</div>
        </div>
        <div className="lap-summary-lap">L{lapNum}</div>
      </div>
      <div className="lap-summary-time">{formatTime(time)}</div>
      <div className="lap-summary-sectors">
        <div className="lap-summary-sector"><span className="sector-label">S1</span><span>{formatTime(s1)}</span></div>
        <div className="lap-summary-sector"><span className="sector-label">S2</span><span>{formatTime(s2)}</span></div>
        <div className="lap-summary-sector"><span className="sector-label">S3</span><span>{formatTime(s3)}</span></div>
      </div>
      {compound && (
        <div className="lap-summary-compound">
          <span className="compound-dot" style={{ background: COMPOUND_COLORS[compound] || '#888' }} />
          {compound}
        </div>
      )}
    </div>
  );
}


// ── Main Telemetry Page ──
export default function Telemetry() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [events, setEvents] = useState([]);
  const [event, setEvent] = useState('');
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState('');
  const [driverList, setDriverList] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [laptimeData, setLaptimeData] = useState({});
  const [telemetryData, setTelemetryData] = useState([]);
  const [selectedLaps, setSelectedLaps] = useState({});
  const [status, setStatus] = useState('idle');
  const [loadingStep, setLoadingStep] = useState('');

  const DEFAULT_COLORS = ['#e10600', '#00d7b6', '#4781d7', '#f5c623', '#f47600', '#e044a7', '#45b649'];

  // Load events when year changes
  useEffect(() => {
    setEvents([]);
    setEvent('');
    setSessions([]);
    setSession('');
    setDriverList([]);
    setSelectedDrivers([]);
    setLaptimeData({});
    setTelemetryData([]);
    setSelectedLaps({});
    setStatus('loading');
    setLoadingStep('Loading events...');
    api.tiEvents(year)
      .then(evts => {
        setEvents(evts);
        if (evts.length) setEvent(evts[0]);
        setStatus('idle');
      })
      .catch(() => setStatus('error'));
  }, [year]);

  // Load sessions when event changes
  useEffect(() => {
    if (!event) return;
    setSessions([]);
    setSession('');
    setDriverList([]);
    setSelectedDrivers([]);
    setLaptimeData({});
    setTelemetryData([]);
    setSelectedLaps({});
    setStatus('loading');
    setLoadingStep('Loading sessions...');
    api.tiSessions(year, event)
      .then(sess => {
        setSessions(sess);
        if (sess.length) setSession(sess[0]);
        setStatus('idle');
      })
      .catch(() => setStatus('idle'));
  }, [year, event]);

  // Load drivers when session changes
  useEffect(() => {
    if (!event || !session) return;
    setDriverList([]);
    setSelectedDrivers([]);
    setLaptimeData({});
    setTelemetryData([]);
    setSelectedLaps({});
    setStatus('loading');
    setLoadingStep('Loading drivers...');
    api.tiDrivers(year, event, session)
      .then(data => {
        const drivers = data.drivers || [];
        setDriverList(drivers);
        // Auto-select first 4 drivers
        setSelectedDrivers(drivers.slice(0, 4).map(d => d.driver));
        setStatus('idle');
      })
      .catch(() => setStatus('idle'));
  }, [year, event, session]);

  // Load lap times for selected drivers
  useEffect(() => {
    if (!event || !session || !selectedDrivers.length) {
      setLaptimeData({});
      return;
    }
    setStatus('loading');
    setLoadingStep('Loading lap times...');
    Promise.all(
      selectedDrivers.map(code =>
        api.tiLaptimes(year, event, session, code)
          .then(d => ({ code, data: d }))
          .catch(() => ({ code, data: null }))
      )
    ).then(results => {
      const map = {};
      results.forEach(r => { if (r.data) map[r.code] = r.data; });
      setLaptimeData(map);
      // Auto-select best lap for each driver
      const laps = {};
      Object.entries(map).forEach(([code, d]) => {
        let bestIdx = -1, bestTime = Infinity;
        d.time?.forEach((t, i) => {
          if (typeof t === 'number' && t > 0 && t < bestTime) { bestTime = t; bestIdx = i; }
        });
        if (bestIdx >= 0) laps[code] = d.lap[bestIdx];
      });
      setSelectedLaps(laps);
      setStatus('idle');
    });
  }, [year, event, session, selectedDrivers]);

  // Load telemetry for selected laps
  useEffect(() => {
    const entries = Object.entries(selectedLaps).filter(([code]) => selectedDrivers.includes(code));
    if (!entries.length || !event || !session) {
      setTelemetryData([]);
      return;
    }
    Promise.all(
      entries.map(([code, lap]) =>
        api.tiTelemetry(year, event, session, code, lap)
          .then(d => ({ code, lap, data: d?.tel || d }))
          .catch(() => ({ code, lap, data: null }))
      )
    ).then(results => {
      setTelemetryData(results.filter(r => r.data));
    });
  }, [selectedLaps, year, event, session, selectedDrivers]);

  const toggleDriver = useCallback(code => {
    setSelectedDrivers(prev => {
      if (prev.includes(code)) return prev.filter(c => c !== code);
      if (prev.length >= 5) return prev;
      return [...prev, code];
    });
  }, []);

  const getDriverInfo = code => driverList.find(d => d.driver === code);
  const getColor = (code) => {
    const d = getDriverInfo(code);
    return d?.tc ? `#${d.tc}` : DEFAULT_COLORS[selectedDrivers.indexOf(code) % DEFAULT_COLORS.length];
  };

  const orderedLaptimeData = selectedDrivers.map(c => laptimeData[c]).filter(Boolean);
  const orderedColors = selectedDrivers.map(c => getColor(c));
  const sessionShort = SESSION_MAP[session] || session;

  return (
    <div className="telemetry-page">
      {/* Header */}
      <div className="telem-header">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Telemetry Analysis</h1>
          <span className="season-badge">{year}</span>
        </div>
      </div>

      {/* Selectors Row */}
      <div className="telem-selectors">
        <div className="telem-select-group">
          <label>Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="telem-select-group">
          <label>Event</label>
          <select value={event} onChange={e => setEvent(e.target.value)}>
            {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </div>
        <div className="telem-select-group">
          <label>Session</label>
          <select value={session} onChange={e => setSession(e.target.value)}>
            {sessions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Driver Chips */}
      {driverList.length > 0 && (
        <div className="telem-driver-chips">
          <label>Drivers</label>
          <div className="driver-chips-row">
            {driverList.map(d => {
              const selected = selectedDrivers.includes(d.driver);
              const tc = d.tc ? `#${d.tc}` : '#888';
              return (
                <button
                  key={d.driver}
                  className={`driver-chip ${selected ? 'active' : ''}`}
                  style={selected ? { background: tc, borderColor: tc, color: '#000' } : { borderColor: tc + '60' }}
                  onClick={() => toggleDriver(d.driver)}
                >
                  {d.driver}
                </button>
              );
            })}
          </div>
          <span className="driver-chips-hint">{selectedDrivers.length}/5 selected</span>
        </div>
      )}

      {status === 'loading' && <Loading text={loadingStep || 'Loading...'} />}
      {status === 'error' && <ErrorMsg text="Failed to load data. Check the year and try again." />}

      {orderedLaptimeData.length > 0 && (
        <>
          {/* Lap Time Chart */}
          <div className="telem-section">
            <div className="telem-section-title">
              <h2>Lap Times</h2>
              <span className="telem-section-desc">Lap time progression — dot colors show tyre compound</span>
            </div>
            <div className="telem-chart-card">
              <LapTimeChart driversData={orderedLaptimeData} colors={orderedColors} />
            </div>
          </div>

          {/* Stint Analysis */}
          <div className="telem-section">
            <div className="telem-section-title">
              <h2>Stint Analysis</h2>
              <span className="telem-section-desc">Lap times within each stint — toggle stints per driver</span>
            </div>
            <div className="telem-stint-grid">
              {selectedDrivers.map((code, i) => (
                <StintChart key={code} laptimeData={laptimeData[code]} color={getColor(code)} driverCode={code} />
              ))}
            </div>
          </div>

          {/* Sector Analysis */}
          <div className="telem-section">
            <div className="telem-section-title">
              <h2>Sector Analysis</h2>
              <span className="telem-section-desc">S1, S2, S3 times — toggle sectors, solid = first driver, dashed = others</span>
            </div>
            <div className="telem-chart-card">
              <SectorChart driversData={orderedLaptimeData} colors={orderedColors} driverCodes={selectedDrivers} />
            </div>
          </div>

          {/* Tyre Strategy */}
          <div className="telem-section">
            <div className="telem-section-title">
              <h2>Tyre Strategy</h2>
              <span className="telem-section-desc">Compound usage across the session</span>
            </div>
            <div className="telem-chart-card">
              <TyreStrategy driversData={orderedLaptimeData} colors={orderedColors} driverCodes={selectedDrivers} />
              <div className="tyre-legend">
                {Object.entries(COMPOUND_COLORS).filter(([k]) => k !== 'UNKNOWN').map(([k, v]) => (
                  <span key={k} className="tyre-legend-item"><span className="compound-dot" style={{ background: v }} />{k}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Selected Lap Summaries */}
          <div className="telem-section">
            <div className="telem-section-title">
              <h2>Selected Lap Summaries</h2>
              <span className="telem-section-desc">Best lap auto-selected — click a lap number to change</span>
            </div>
            <div className="lap-selector-row">
              {selectedDrivers.map(code => {
                const d = laptimeData[code];
                if (!d) return null;
                return (
                  <div key={code} className="lap-selector-group">
                    <span className="lap-selector-label" style={{ color: getColor(code) }}>{code}</span>
                    <select value={selectedLaps[code] || ''} onChange={e => setSelectedLaps(p => ({ ...p, [code]: Number(e.target.value) }))}>
                      {d.lap?.map((l, i) => {
                        const t = d.time?.[i];
                        return (typeof t === 'number' && t > 0) ? <option key={l} value={l}>L{l} — {formatTime(t)}</option> : null;
                      })}
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="lap-summary-grid">
              {selectedDrivers.map(code => {
                const dInfo = getDriverInfo(code);
                const lData = laptimeData[code];
                if (!dInfo || !lData) return null;
                return <LapSummaryCard key={code} driver={dInfo} lapData={lData} lapNum={selectedLaps[code]} color={getColor(code)} />;
              })}
            </div>
          </div>

          {/* Speed vs Distance (telemetry comparison) */}
          {telemetryData.length > 0 && (
            <>
              <div className="telem-section">
                <div className="telem-section-title">
                  <h2>Speed Trace</h2>
                  <span className="telem-section-desc">Speed vs distance for selected laps</span>
                </div>
                <div className="telem-chart-card">
                  <SpeedDistChart
                    telData={telemetryData.map(td => td.data)}
                    colors={telemetryData.map(td => getColor(td.code))}
                    driverCodes={telemetryData.map(td => `${td.code} L${td.lap}`)}
                  />
                </div>
              </div>

              <div className="telem-section">
                <div className="telem-section-title">
                  <h2>Throttle Application</h2>
                  <span className="telem-section-desc">Throttle input (0-100%) vs distance</span>
                </div>
                <div className="telem-chart-card">
                  <ThrottleChart
                    telData={telemetryData.map(td => td.data)}
                    colors={telemetryData.map(td => getColor(td.code))}
                    driverCodes={telemetryData.map(td => `${td.code} L${td.lap}`)}
                  />
                </div>
              </div>

              <div className="telem-section">
                <div className="telem-section-title">
                  <h2>Brake Zones</h2>
                  <span className="telem-section-desc">Braking application highlighted by driver</span>
                </div>
                <div className="telem-chart-card">
                  <BrakeChart
                    telData={telemetryData.map(td => td.data)}
                    colors={telemetryData.map(td => getColor(td.code))}
                    driverCodes={telemetryData.map(td => `${td.code} L${td.lap}`)}
                  />
                </div>
              </div>

              <div className="telem-section">
                <div className="telem-section-title">
                  <h2>Gear Selection</h2>
                  <span className="telem-section-desc">Gear changes across the lap</span>
                </div>
                <div className="telem-chart-card">
                  <GearChart
                    telData={telemetryData.map(td => td.data)}
                    colors={telemetryData.map(td => getColor(td.code))}
                    driverCodes={telemetryData.map(td => `${td.code} L${td.lap}`)}
                  />
                </div>
              </div>

              <div className="telem-section">
                <div className="telem-section-title">
                  <h2>Engine RPM</h2>
                  <span className="telem-section-desc">RPM trace vs distance</span>
                </div>
                <div className="telem-chart-card">
                  <RPMChart
                    telData={telemetryData.map(td => td.data)}
                    colors={telemetryData.map(td => getColor(td.code))}
                    driverCodes={telemetryData.map(td => `${td.code} L${td.lap}`)}
                  />
                </div>
              </div>

              <div className="telem-section">
                <div className="telem-section-title">
                  <h2>DRS Activation</h2>
                  <span className="telem-section-desc">DRS open zones per driver</span>
                </div>
                <div className="telem-chart-card">
                  <DRSChart
                    telData={telemetryData.map(td => td.data)}
                    colors={telemetryData.map(td => getColor(td.code))}
                    driverCodes={telemetryData.map(td => `${td.code} L${td.lap}`)}
                  />
                </div>
              </div>

              <div className="telem-section">
                <div className="telem-section-title">
                  <h2>Delta Time</h2>
                  <span className="telem-section-desc">Time delta vs first selected driver — green = faster, red = slower</span>
                </div>
                <div className="telem-chart-card">
                  <DeltaChart
                    telData={telemetryData.map(td => td.data)}
                    colors={telemetryData.map(td => getColor(td.code))}
                    driverCodes={telemetryData.map(td => `${td.code} L${td.lap}`)}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {status === 'idle' && !orderedLaptimeData.length && driverList.length > 0 && (
        <div className="telem-empty-state">
          <h3>Select drivers to begin analysis</h3>
          <p>Choose up to 5 drivers from the chips above to load telemetry data.</p>
        </div>
      )}

      {status === 'idle' && !driverList.length && events.length > 0 && (
        <div className="telem-empty-state">
          <h3>No data available</h3>
          <p>Select a valid event and session to load driver data.</p>
        </div>
      )}
    </div>
  );
}
