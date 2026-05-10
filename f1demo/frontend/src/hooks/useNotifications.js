import { useEffect, useRef, useCallback } from 'react';

export function useNotifications() {
  const permissionGranted = useRef(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      permissionGranted.current = true;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;

    try {
      const permission = await Notification.requestPermission();
      permissionGranted.current = permission === 'granted';
      return permissionGranted.current;
    } catch (err) {
      console.warn('[Notifications] Failed to request permission:', err);
      return false;
    }
  }, []);

  const notify = useCallback((title, options = {}) => {
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
  }, []);

  return { notify, requestPermission, permissionGranted: permissionGranted.current };
}
