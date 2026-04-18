import { useState, useEffect } from 'react';

export default function LiveSettings() {
  const [settings, setSettings] = useState({
    notifications: true,
    sound: true,
    overtakeAlerts: true,
    raceControlAlerts: true,
    autoMinimize: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem('liveSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('liveSettings', JSON.stringify(newSettings));
  };

  return (
    <div className="live-settings">
      <h4>Live Companion Settings</h4>
      <div className="settings-list">
        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={e => updateSetting('notifications', e.target.checked)}
          />
          <span>Desktop Notifications</span>
        </label>
        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={e => updateSetting('sound', e.target.checked)}
          />
          <span>Sound Alerts</span>
        </label>
        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.overtakeAlerts}
            onChange={e => updateSetting('overtakeAlerts', e.target.checked)}
          />
          <span>Overtake Alerts</span>
        </label>
        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.raceControlAlerts}
            onChange={e => updateSetting('raceControlAlerts', e.target.checked)}
          />
          <span>Race Control Alerts</span>
        </label>
        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.autoMinimize}
            onChange={e => updateSetting('autoMinimize', e.target.checked)}
          />
          <span>Auto-minimize after 30s</span>
        </label>
      </div>
    </div>
  );
}

export function useLiveSettings() {
  const [settings, setSettings] = useState({
    notifications: true,
    sound: true,
    overtakeAlerts: true,
    raceControlAlerts: true,
    autoMinimize: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem('liveSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {}
    }
  }, []);

  return settings;
}
