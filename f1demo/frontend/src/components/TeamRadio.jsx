import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

function clipTime(clip) {
  return clip?.date || clip?.timestamp || clip?.created_at || clip?.recording_time || '';
}

export default function TeamRadio({ sessionKey, roster = [], isLive = false }) {
  const [clips, setClips] = useState([]);
  const audioRef = useRef(null);
  const lastAutoPlayRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!sessionKey) {
      setClips([]);
      return undefined;
    }

    api.teamRadio(sessionKey)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => new Date(clipTime(b)) - new Date(clipTime(a)));
        setClips(list);
      })
      .catch(() => {
        if (!cancelled) setClips([]);
      });

    return () => { cancelled = true; };
  }, [sessionKey]);

  useEffect(() => {
    const newest = clips[0];
    if (!isLive || !newest) return;
    const clipId = newest.audio_url || newest.date || newest.timestamp;
    if (clipId && clipId === lastAutoPlayRef.current) return;
    lastAutoPlayRef.current = clipId;
    if (audioRef.current) {
      audioRef.current.src = newest.audio_url || newest.url || '';
      audioRef.current.play().catch(() => {});
    }
  }, [clips, isLive]);

  const rosterLookup = useMemo(() => {
    const map = new Map();
    roster.forEach((entry) => {
      map.set(String(entry.driver_number), entry);
      map.set(String(entry.name_acronym || '').toUpperCase(), entry);
    });
    return map;
  }, [roster]);

  const driverLabel = (clip) => {
    const driverNumber = String(clip.driver_number ?? clip.driverNumber ?? '');
    const driver = rosterLookup.get(driverNumber) || rosterLookup.get(String(clip.driver || '').toUpperCase());
    return driver?.full_name || driver?.name_acronym || clip.driver || `#${driverNumber || '?'}`;
  };

  if (!sessionKey || !clips.length) return null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Team radio</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{clips.length} clips</span>
      </div>
      <audio ref={audioRef} controls style={{ width: '100%', marginBottom: 12 }} />
      <div style={{ display: 'grid', gap: 8 }}>
        {clips.map((clip, index) => (
          <div key={`${clip.audio_url || clip.url || index}`} style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            padding: '10px 12px',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{driverLabel(clip)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{clipTime(clip) || 'Unknown time'} · {formatDuration(clip.duration)}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!audioRef.current) return;
                audioRef.current.src = clip.audio_url || clip.url || '';
                audioRef.current.play().catch(() => {});
              }}
              style={{
                border: '1px solid var(--border-normal)',
                background: 'var(--bg-raised)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              Play
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}