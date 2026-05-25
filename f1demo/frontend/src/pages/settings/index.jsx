import { useEffect, useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import './styles.css';

const THEMES = ['system', 'dark', 'light'];

function getInitialTheme() {
  try {
    return localStorage.getItem('theme') || 'system';
  } catch {
    return 'system';
  }
}

function getInitialPollInterval() {
  try {
    const value = Number(localStorage.getItem('livePollIntervalSeconds'));
    return Number.isFinite(value) && value >= 5 && value <= 30 ? value : 8;
  } catch {
    return 8;
  }
}

function getInitialNewsMode() {
  try {
    return localStorage.getItem('newsOpenMode') || 'in-app';
  } catch {
    return 'in-app';
  }
}

export default function SettingsPage() {
  const { requestPermission, permissionGranted } = useNotifications();
  const [theme, setTheme] = useState(getInitialTheme);
  const [pollInterval, setPollInterval] = useState(getInitialPollInterval);
  const [newsMode, setNewsMode] = useState(getInitialNewsMode);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('notificationsEnabled');
      return saved == null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.dataset.theme = theme;
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('livePollIntervalSeconds', String(pollInterval));
  }, [pollInterval]);

  useEffect(() => {
    localStorage.setItem('newsOpenMode', newsMode);
  }, [newsMode]);

  useEffect(() => {
    localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
  }, [notificationsEnabled]);

  const enableNotifications = async () => {
    const granted = await requestPermission();
    setNotificationsEnabled(granted);
  };

  const resetPreferences = () => {
    localStorage.removeItem('theme');
    localStorage.removeItem('livePollIntervalSeconds');
    localStorage.removeItem('notificationsEnabled');
    localStorage.removeItem('newsOpenMode');
    window.location.reload();
  };

  return (
    <section className="settings-page">
      <header className="settings-hero">
        <p className="eyebrow">Preferences</p>
        <h1>Settings</h1>
        <p>Adjust theme, live updates, and notifications.</p>
      </header>

      <div className="settings-grid">
        <label className="settings-card">
          <span className="settings-label">Theme</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {THEMES.map((option) => (
              <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
            ))}
          </select>
        </label>

        <label className="settings-card">
          <span className="settings-label">News articles open in</span>
          <select value={newsMode} onChange={(e) => setNewsMode(e.target.value)}>
            <option value="in-app">In-app modal</option>
            <option value="new-tab">New tab</option>
          </select>
        </label>

        <label className="settings-card">
          <span className="settings-label">Live telemetry poll interval: {pollInterval}s</span>
          <input
            type="range"
            min="5"
            max="30"
            step="1"
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
          />
        </label>

        <label className="settings-card">
          <span className="settings-label">Notifications</span>
          <input
            type="checkbox"
            checked={notificationsEnabled && permissionGranted}
            onChange={(e) => {
              setNotificationsEnabled(e.target.checked);
              if (e.target.checked) {
                enableNotifications();
              }
            }}
          />
          <small>{permissionGranted ? 'Browser permission granted' : 'Permission required'}</small>
        </label>

        <button className="settings-card settings-reset" type="button" onClick={resetPreferences}>
          Reset all preferences
        </button>
      </div>
    </section>
  );
}