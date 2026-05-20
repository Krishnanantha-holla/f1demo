import { useRef, useCallback, useState } from 'react';

export function useNotifications() {
  const permissionGrantedRef = useRef(false);
  const [permissionGranted, setPermissionGranted] = useState(() => (
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  ));

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      permissionGrantedRef.current = granted;
      setPermissionGranted(granted);
      return granted;
    } catch (err) {
      console.warn('[Notifications] Failed to request permission:', err);
      return false;
    }
  }, []);

  const notify = useCallback((title, options = {}) => {
    if (!permissionGrantedRef.current || !('Notification' in window)) return;

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

  return { notify, requestPermission, permissionGranted };
}
