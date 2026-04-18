import { useEffect, useRef } from 'react';

export function useNotifications() {
  const permissionGranted = useRef(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        permissionGranted.current = permission === 'granted';
      });
    } else if (Notification.permission === 'granted') {
      permissionGranted.current = true;
    }
  }, []);

  const notify = (title, options = {}) => {
    if (!permissionGranted.current || !('Notification' in window)) return;
    
    try {
      const notification = new Notification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        ...options,
      });

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);
      
      return notification;
    } catch (err) {
      console.warn('[Notifications] Failed to show notification:', err);
    }
  };

  return { notify, permissionGranted: permissionGranted.current };
}
