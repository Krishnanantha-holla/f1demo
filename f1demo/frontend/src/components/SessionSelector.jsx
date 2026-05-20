import { useEffect, useState } from 'react';
import { api } from '../api';

export default function SessionSelector({ onChange }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState([]);
  const [event, setEvent] = useState('');
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState('');

  useEffect(() => {
    api.tiEvents(year).then(setEvents).catch(() => setEvents([]));
  }, [year]);

  useEffect(() => {
    if (!event) return;
    api.tiSessions(year, event)
      .then((s) => { setSessions(s); setSession(''); })
      .catch(() => setSessions([]));
  }, [year, event]);

  useEffect(() => {
    if (event && session) onChange?.({ year, event, session });
  }, [year, event, session, onChange]);

  const selectStyle = {
    background: 'var(--bg-raised)',
    border: '1px solid var(--border-normal)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    padding: '7px 10px',
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
  };

  const years = [2024, 2025, 2026];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select style={selectStyle} value={year} onChange={(eventChange) => setYear(Number(eventChange.target.value))}>
        {years.map((value) => <option key={value}>{value}</option>)}
      </select>
      <select style={selectStyle} value={event} onChange={(eventChange) => setEvent(eventChange.target.value)} disabled={!events.length}>
        <option value="">Select event</option>
        {events.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      <select style={selectStyle} value={session} onChange={(eventChange) => setSession(eventChange.target.value)} disabled={!sessions.length}>
        <option value="">Select session</option>
        {sessions.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>
  );
}
