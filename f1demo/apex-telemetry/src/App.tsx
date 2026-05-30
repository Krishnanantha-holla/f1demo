import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppTab, Driver, IntelMessage, SessionInfo } from './types';
import {
  INITIAL_DRIVERS,
  INITIAL_SESSION,
  INTEL_MESSAGES,
  simulateDriversTelemetry,
} from './data';
import {
  buildIntelFeed,
  fetchBootstrap,
  mergeStandingsIntoDrivers,
  sessionToInfo,
  type BootstrapData,
} from './services/f1Api';
import DashboardView from './components/DashboardView';
import LiveTimingView from './components/LiveTimingView';
import TrackMapView from './components/TrackMapView';
import TelemetryView from './components/TelemetryView';
import StandingsView from './components/StandingsView';
import AnalysisView from './components/AnalysisView';
import IntelView from './components/IntelView';
import { AppShell, type DataMode } from './components/AppShell';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ShortcutOverlay } from './components/ShortcutOverlay';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const REFRESH_INTERVAL_MS = 90_000;

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [drivers, setDrivers] = useState<Driver[]>(INITIAL_DRIVERS);
  const [session, setSession] = useState<SessionInfo>(INITIAL_SESSION);
  const [intel, setIntel] = useState<IntelMessage[]>(INTEL_MESSAGES);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(
    INITIAL_DRIVERS[0]?.id ?? null,
  );
  const [isSimulating, setIsSimulating] = useState(true);
  const [dataMode, setDataMode] = useState<DataMode>('loading');
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const tickRef = useRef(0);

  const selectedDriver: Driver | null = useMemo(
    () => drivers.find(d => d.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId],
  );

  const setSelectedDriver = useCallback((driver: Driver | null) => {
    setSelectedDriverId(driver?.id ?? null);
  }, []);

  const applyBootstrap = useCallback((data: BootstrapData) => {
    setBootstrap(data);
    if (data.snapshot && data.snapshot.drivers.length > 0) {
      const merged = mergeStandingsIntoDrivers(data.snapshot.drivers, data.driverStandings);
      setDrivers(merged);
      const info = sessionToInfo(data.snapshot.session, data.snapshot.weather);
      setSession(info);
      setSelectedDriverId(prev => prev ?? merged[0]?.id ?? null);
      setDataMode('live');
      setDataError(null);
      // If the session has already ended, don't run the simulator.
      if (info.remainingTime <= 0) {
        setIsSimulating(false);
      }
    } else {
      setDataMode('fallback');
      setDataError('OpenF1 returned no driver data, using simulator.');
    }
    const feed = buildIntelFeed(data.raceControl, data.news);
    if (feed.length > 0) setIntel(feed);
  }, []);

  // Initial bootstrap.
  useEffect(() => {
    const ctrl = new AbortController();
    const t0 = performance.now();
    fetchBootstrap(ctrl.signal)
      .then(data => {
        applyBootstrap(data);
        const latency = Math.round(performance.now() - t0);
        setSession(prev => ({ ...prev, apiLatency: latency }));
      })
      .catch(err => {
        if (err?.name === 'AbortError') return;
        setDataMode('fallback');
        setDataError(err?.message ?? 'Live data unavailable');
      });
    return () => ctrl.abort();
  }, [applyBootstrap]);

  // Periodic background re-sync so news, race control, and weather stay fresh.
  useEffect(() => {
    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        const data = await fetchBootstrap();
        if (!cancelled) applyBootstrap(data);
      } catch {
        /* swallow */
      }
    }, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [applyBootstrap]);

  // Telemetry simulation tick — only runs when explicitly enabled AND the
  // session hasn't ended. When the live session is over, auto-pause.
  useEffect(() => {
    if (!isSimulating) return;
    const intervalId = window.setInterval(() => {
      tickRef.current += 1;
      setDrivers(prev => simulateDriversTelemetry(prev));
      setSession(prev => {
        const nextTime = Math.max(0, prev.remainingTime - 1);
        if (nextTime <= 0 && dataMode === 'live') {
          // Session ended — auto-pause the simulator.
          setIsSimulating(false);
          return { ...prev, remainingTime: 0 };
        }
        const totalSeconds = 3600;
        const lapsDone = prev.totalLaps
          ? Math.min(
              prev.totalLaps,
              Math.floor(((totalSeconds - nextTime) / totalSeconds) * prev.totalLaps),
            )
          : prev.currentLap;
        const wobble = (Math.sin(tickRef.current / 4) + 1) * 6;
        return {
          ...prev,
          remainingTime: nextTime,
          currentLap: Math.max(prev.currentLap, lapsDone),
          apiLatency: Math.round(8 + wobble),
        };
      });
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [isSimulating, dataMode]);

  const handleResetSim = useCallback(() => {
    setIsSimulating(false);
    setDrivers(INITIAL_DRIVERS);
    setSession(INITIAL_SESSION);
    setSelectedDriverId(INITIAL_DRIVERS[0]?.id ?? null);
    setDataMode('fallback');
  }, []);

  const handleRefresh = useCallback(async () => {
    setDataMode('loading');
    try {
      const data = await fetchBootstrap();
      applyBootstrap(data);
    } catch (e) {
      const err = e as Error;
      setDataMode('fallback');
      setDataError(err.message ?? 'Live data unavailable');
    }
  }, [applyBootstrap]);

  useKeyboardShortcuts({
    onChangeTab: setActiveTab,
    onToggleSim: () => setIsSimulating(s => !s),
    onRefresh: handleRefresh,
    onOpenShortcuts: () => setShowShortcuts(o => !o),
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            drivers={drivers}
            session={session}
            intel={intel}
            onNavigate={setActiveTab}
            selectedDriver={selectedDriver}
            setSelectedDriver={setSelectedDriver}
            nextRace={bootstrap?.nextRace ?? null}
            lastRace={bootstrap?.lastRace ?? null}
            pitStops={bootstrap?.pitStops ?? []}
            news={bootstrap?.news ?? []}
            weather={bootstrap?.snapshot?.weather ?? null}
          />
        );
      case 'live-timing':
        return (
          <LiveTimingView
            drivers={drivers}
            selectedDriver={selectedDriver}
            setSelectedDriver={setSelectedDriver}
            isSimulating={isSimulating}
            setIsSimulating={setIsSimulating}
            onResetSim={handleResetSim}
          />
        );
      case 'track-map':
        return (
          <TrackMapView
            drivers={drivers}
            selectedDriver={selectedDriver}
            setSelectedDriver={setSelectedDriver}
            circuit={bootstrap?.circuit ?? null}
            session={bootstrap?.snapshot?.session ?? null}
          />
        );
      case 'telemetry':
        return (
          <TelemetryView
            drivers={drivers}
            selectedDriver={selectedDriver}
            setSelectedDriver={setSelectedDriver}
          />
        );
      case 'standings':
        return (
          <StandingsView
            drivers={drivers}
            driverStandings={bootstrap?.driverStandings ?? null}
            constructorStandings={bootstrap?.constructorStandings ?? null}
            seasonAggregates={bootstrap?.seasonAggregates ?? null}
          />
        );
      case 'analysis':
        return (
          <AnalysisView
            drivers={drivers}
            intel={intel}
            lastRace={bootstrap?.lastRace ?? null}
            seasonAggregates={bootstrap?.seasonAggregates ?? null}
          />
        );
      case 'intel':
        return (
          <IntelView
            drivers={drivers}
            news={bootstrap?.news ?? []}
            raceControl={bootstrap?.raceControl ?? []}
            teamRadio={bootstrap?.teamRadio ?? []}
            pitStops={bootstrap?.pitStops ?? []}
            onRefresh={handleRefresh}
          />
        );
      default:
        return (
          <div className="carbon-card rounded-lg p-10 text-center text-xs font-mono text-on-surface-variant">
            Under active construction. Toggle other available screens.
          </div>
        );
    }
  };

  return (
    <ErrorBoundary>
      <AppShell
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        session={session}
        selectedDriver={selectedDriver}
        isSimulating={isSimulating}
        onToggleSim={() => setIsSimulating(s => !s)}
        dataMode={dataMode}
        dataError={dataError}
        onRefresh={handleRefresh}
        onOpenShortcuts={() => setShowShortcuts(o => !o)}
      >
        <ErrorBoundary>{renderTabContent()}</ErrorBoundary>
      </AppShell>
      <ShortcutOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </ErrorBoundary>
  );
}
