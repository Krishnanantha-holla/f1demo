import { useState } from 'react';

export function useLiveSettings() {
  const defaultSettings = {
    notifications: true,
    sound: true,
    overtakeAlerts: true,
    raceControlAlerts: true,
    autoMinimize: false,
  };
  const [settings] = useState(() => {
    try {
      const saved = localStorage.getItem('liveSettings');
      return saved ? JSON.parse(saved) : defaultSettings;
    } catch (e) {
      console.debug('liveSettings parse error', e);
      return defaultSettings;
    }
  });

  return settings;
}
