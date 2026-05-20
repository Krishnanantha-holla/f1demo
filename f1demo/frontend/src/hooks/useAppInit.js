// NOTE: blocking Promise.all is intentional pre-Phase-2. Glance-first, independent
// widget loading is tracked in PHASE_1_ROADMAP.md > "Post-Phase 1 Work".
import { useEffect } from 'react';
import { api } from '../api';
import { useF1Store } from '../store/useF1Store';

export function useAppInit() {
  const activeYear = useF1Store((state) => state.activeYear);
  const setDriverStandings = useF1Store((state) => state.setDriverStandings);
  const setConstructorStandings = useF1Store((state) => state.setConstructorStandings);
  const setDriverRoster = useF1Store((state) => state.setDriverRoster);
  const setNextRace = useF1Store((state) => state.setNextRace);
  const setLastResults = useF1Store((state) => state.setLastResults);
  const setSessionMode = useF1Store((state) => state.setSessionMode);
  const setLoading = useF1Store((state) => state.setLoading);

  useEffect(() => {
    let cancelled = false;

    setLoading('standings', true);
    Promise.all([
      api.driverStandings(activeYear),
      api.constructorStandings(activeYear),
    ])
      .then(([drivers, constructors]) => {
        if (cancelled) return;
        setDriverStandings(drivers || []);
        setConstructorStandings(constructors || []);
      })
      .catch(() => {})
      .finally(() => setLoading('standings', false));

    setLoading('roster', true);
    api.freeRoster(activeYear)
      .then((roster) => {
        if (!cancelled) setDriverRoster(roster || []);
      })
      .catch(() => {})
      .finally(() => setLoading('roster', false));

    api.nextRace().then((race) => {
      if (!cancelled) setNextRace(race);
    }).catch(() => {});

    api.lastResults().then((results) => {
      if (!cancelled) setLastResults(results);
    }).catch(() => {});

    api.sessionMode().then((mode) => {
      if (!cancelled) setSessionMode(mode?.mode || 'idle', mode?.session || null);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeYear, setConstructorStandings, setDriverRoster, setDriverStandings, setLastResults, setLoading, setNextRace, setSessionMode]);
}
