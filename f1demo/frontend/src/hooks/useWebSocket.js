import { useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live';

export function useWebSocket({ onMessage, enabled = true }) {
  const ws = useRef(null);
  const retryTimer = useRef(null);
  const retryCount = useRef(0);

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
          onMessage?.(data);
        } catch {
          // Ignore malformed messages.
        }
      };

      ws.current.onclose = () => {
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
        retryCount.current += 1;
        retryTimer.current = setTimeout(connect, delay);
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };
    } catch {
      // Connection setup failed; retry through the close path.
    }
  }, [enabled, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(retryTimer.current);
      ws.current?.close();
    };
  }, [connect]);
}