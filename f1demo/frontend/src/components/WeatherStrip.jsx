import { useEffect, useState } from 'react';
import { api } from '../api';

function StatTile({ icon, label, value }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-dim)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      minWidth: 110,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

export default function WeatherStrip({ sessionKey }) {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (!sessionKey) {
      setWeather(null);
      return undefined;
    }
    let cancelled = false;
    api.weather(sessionKey)
      .then((data) => {
        if (!cancelled) setWeather(Array.isArray(data) ? data[data.length - 1] : data);
      })
      .catch(() => {
        if (!cancelled) setWeather(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  if (!weather) return null;

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <StatTile icon="🌡" label="Track" value={weather.track_temperature != null ? `${weather.track_temperature}°` : '—'} />
      <StatTile icon="🌬" label="Air" value={weather.air_temperature != null ? `${weather.air_temperature}°` : '—'} />
      <StatTile icon="💧" label="Humidity" value={weather.humidity != null ? `${weather.humidity}%` : '—'} />
      <StatTile icon="💨" label="Wind" value={weather.wind_speed != null ? `${weather.wind_speed}` : '—'} />
      <StatTile icon="🌧" label="Rain" value={weather.rainfall ? 'Yes' : 'No'} />
    </div>
  );
}