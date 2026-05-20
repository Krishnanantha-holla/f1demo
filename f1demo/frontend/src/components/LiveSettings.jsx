import { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';

export default function LiveSettings() {
  const { requestPermission } = useNotifications();
  const defaultSettings = {
    notifications: true,
    sound: true,
    overtakeAlerts: true,
    raceControlAlerts: true,
    autoMinimize: false,
  };
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('liveSettings');
      return saved ? JSON.parse(saved) : defaultSettings;
    } catch (e) {
      console.debug('liveSettings parse error', e);
      return defaultSettings;
    }
  });
  const [notificationPermission, setNotificationPermission] = useState(() => (
    'Notification' in window ? Notification.permission : 'unsupported'
  ));

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('liveSettings', JSON.stringify(newSettings));
  };

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
    if (granted) {
      updateSetting('notifications', true);
    }
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
        <button type="button" className="setting-action" onClick={handleEnableNotifications}>
          {notificationPermission === 'granted' ? 'Notifications enabled' : 'Enable desktop notifications'}
        </button>
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

// useLiveSettings moved to ../hooks/useLiveSettings.js
