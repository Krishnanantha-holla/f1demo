import { useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live';
const SSE_URL = '/api/live/sse';
const MAX_WS_RETRIES = 4; // After 4 failures, try SSE

export function useWebSocket({ onMessage, onModeChange, enabled = true }) {
  const ws = useRef(null);
  const es = useRef(null);
  const retryTimer = useRef(null);
  const retryCount = useRef(0);
  const mode = useRef('ws'); // 'ws' | 'sse' | 'offline'
  const onMessageRef = useRef(onMessage);
  const activeRef = useRef(true);
  const connectRef = useRef(null);

  // Keep ref updated without causing reconnects
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Notify parent of mode changes
  const setMode = useCallback((newMode) => {
    if (mode.current !== newMode) {
      mode.current = newMode;
      onModeChange?.(newMode);
      console.debug(`[useWebSocket] mode changed to: ${newMode}`);
    }
  }, [onModeChange]);

  const connectEventSource = useCallback(() => {
    if (!enabled) return;

    try {
      const sessionKey = new URLSearchParams(window.location.search).get('session_key') || 'latest';
      es.current = new EventSource(`${SSE_URL}?session_key=${sessionKey}`);
      setMode('sse');

      es.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch {
          // Ignore malformed messages.
        }
      };

      es.current.onerror = () => {
        console.debug('[useWebSocket] EventSource error');
        es.current?.close();
        setMode('offline');
        // Don't retry SSE, user is truly offline
      };
    } catch (err) {
      console.debug('[useWebSocket] EventSource setup failed:', err);
      setMode('offline');
    }
  }, [enabled, setMode]);

  const connectWebSocket = useCallback(() => {
    if (!enabled) return;

    try {
      ws.current = new WebSocket(WS_URL);
      setMode('ws');

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

        // After MAX_WS_RETRIES, switch to SSE fallback
        if (retryCount.current >= MAX_WS_RETRIES) {
          console.debug(`[useWebSocket] WebSocket failed ${retryCount.current} times, switching to SSE`);
          if (activeRef.current && enabled) {
            connectEventSource();
          }
        } else if (activeRef.current && enabled) {
          retryTimer.current = setTimeout(() => connectRef.current?.(), delay);
        }
      };

      ws.current.onerror = () => {
        console.debug('[useWebSocket] WebSocket error');
        ws.current?.close();
      };
    } catch {
      // Connection setup failed; retry through the close path.
    }
  }, [enabled, setMode, connectEventSource]);

  useEffect(() => {
    connectRef.current = connectWebSocket;
  }, [connectWebSocket]);

  useEffect(() => {
    activeRef.current = true;
    if (enabled) {
      connectWebSocket();
    }
    return () => {
      // Mark as inactive so pending reconnects won't re-schedule
      activeRef.current = false;
      clearTimeout(retryTimer.current);
      try {
        ws.current?.close();
        es.current?.close();
      } catch {
        // ignore
      }
    };
  }, [enabled, connectWebSocket]);
}
