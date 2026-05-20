import { useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live';

export function useWebSocket({ onMessage, enabled = true }) {
  const ws = useRef(null);
  const retryTimer = useRef(null);
  const retryCount = useRef(0);
  const onMessageRef = useRef(onMessage);
  const activeRef = useRef(true);
  // Keep a ref to the connect function so closures can call it safely.
  const connectRef = useRef(null);

  // Keep ref updated without causing reconnects
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        retryCount.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch {
          // Ignore malformed messages.
        }
      };

      ws.current.onclose = () => {
        // Exponential backoff with jitter (0.7x - 1.3x)
        const base = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
        const jitter = 0.7 + Math.random() * 0.6;
        const delay = Math.round(base * jitter);
        retryCount.current += 1;
        clearTimeout(retryTimer.current);
        // Only schedule reconnect if still active and enabled
        if (activeRef.current && enabled) {
          // Use a ref to the connect function to avoid referencing the `connect`
          // identifier before it's fully initialized.
          const fn = connectRef.current || (() => {});
          retryTimer.current = setTimeout(() => fn(), delay);
        }
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };
    } catch {
      // Connection setup failed; retry through the close path.
    }
  }, [enabled]);
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    activeRef.current = true;
    connect();
    return () => {
      // Mark as inactive so pending reconnects won't re-schedule
      activeRef.current = false;
      clearTimeout(retryTimer.current);
      try {
        ws.current?.close();
      } catch {
        // ignore
      }
    };
  }, [connect]);
}
