import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { useNotifications } from './useNotifications';

// Exponential backoff for 429s
function backoffDelay(attempt) {
  return Math.min(1000 * 2 ** attempt, 60000);
}

export function useLiveSession() {
  const [sessionMode, setSessionMode] = useState({ mode: 'idle' });
  const [liveData, setLiveData] = useState(null);
  const previousMode = useRef('idle');
  const lastOvertakeCount = useRef(0);
  const lastRCMessage = useRef('');
  const { notify } = useNotifications();

  // Poll session mode — 30s idle, 15s live, backs off on errors
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    async function checkMode() {
      try {
        const mode = await api.sessionMode();
        if (cancelled) return;
        attempt = 0; // reset backoff on success

        setSessionMode(mode);

        if (previousMode.current !== 'live' && mode.mode === 'live') {
          const name = mode.session?.session_name || 'Session';
          notify(`🏁 ${name} is LIVE!`, { body: 'Live timing is now available', tag: 'session-start' });
        }
        if (previousMode.current === 'live' && mode.mode !== 'live') {
          notify('🏁 Session Ended', { body: 'Live timing has concluded', tag: 'session-end' });
          document.title = 'F1 Dashboard';
        }
        previousMode.current = mode.mode;
      } catch (err) {
        attempt++;
        console.warn('[useLiveSession] checkMode failed (attempt', attempt, '):', err);
      }
    }

    checkMode();
    // 30s when idle, 15s when live — avoids hammering OpenF1
    const getInterval = () => (previousMode.current === 'live' ? 15000 : 30000);
    let timer;
    function schedule() {
      if (cancelled) return;
      timer = setTimeout(async () => {
        await checkMode();
        schedule();
      }, attempt > 0 ? backoffDelay(attempt) : getInterval());
    }
    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [notify]);

  // Poll live data only when session is active
  useEffect(() => {
    if (sessionMode.mode !== 'live') {
      setLiveData(null);
      return;
    }

    let cancelled = false;

    async function fetchLiveData() {
      try {
        const sessionKey = sessionMode.session?.session_key;
        if (!sessionKey) return;

        const [positions, intervals, overtakes, raceControl, weather] = await Promise.all([
          api.positions(sessionKey).catch(() => []),
          api.intervals(sessionKey).catch(() => []),
          api.overtakes(sessionKey).catch(() => []),
          api.raceControl(sessionKey).catch(() => []),
          api.weather(sessionKey).catch(() => null),
        ]);

        if (cancelled) return;

        // Notify new overtakes
        if (overtakes.length > lastOvertakeCount.current) {
          const newOnes = overtakes.slice(lastOvertakeCount.current);
          newOnes.forEach(ot => {
            notify('🏎️ Overtake!', {
              body: `#${ot.overtaking_driver_number} passed #${ot.being_overtaken_driver_number}`,
              tag: 'overtake',
            });
          });
          lastOvertakeCount.current = overtakes.length;
        }

        // Notify race control events (safety car, red flag)
        const latestRC = raceControl[raceControl.length - 1];
        if (latestRC && latestRC.message !== lastRCMessage.current) {
          if (latestRC.flag === 'RED' || latestRC.flag === 'YELLOW' || latestRC.category === 'SafetyCar') {
            notify(`🚨 ${latestRC.flag || latestRC.category}`, { body: latestRC.message, tag: 'race-control' });
          }
          lastRCMessage.current = latestRC.message;
        }

        setLiveData({ positions, intervals, overtakes, raceControl, weather });
      } catch (err) {
        console.warn('[useLiveSession] fetchLiveData failed:', err);
      }
    }

    fetchLiveData();
    const id = setInterval(fetchLiveData, 8000); // 8s — respectful of rate limits
    return () => { cancelled = true; clearInterval(id); };
  }, [sessionMode, notify]);

  return { sessionMode, liveData, isLive: sessionMode.mode === 'live' };
}
