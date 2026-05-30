import {
  Activity,
  HelpCircle,
  LayoutGrid,
  Map,
  Newspaper,
  Pause,
  Play,
  Settings,
  Timer,
  TrendingUp,
  User,
  Wrench,
  Cloud,
  CloudOff,
  Loader2,
  Keyboard,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppTab, Driver, SessionInfo } from '../types';

export type DataMode = 'loading' | 'live' | 'fallback';

interface NavItem {
  id: AppTab;
  label: string;
  icon: typeof Timer;
}

const SIDE_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'live-timing', label: 'Live Timing', icon: Timer },
  { id: 'track-map', label: 'Track Map', icon: Map },
  { id: 'telemetry', label: 'Telemetry', icon: Activity },
  { id: 'standings', label: 'Standings', icon: TrendingUp },
  { id: 'analysis', label: 'Engineering', icon: Wrench },
  { id: 'intel', label: 'Intel & News', icon: Newspaper },
];

interface Props {
  activeTab: AppTab;
  onChangeTab: (t: AppTab) => void;
  session: SessionInfo;
  selectedDriver: Driver | null;
  isSimulating: boolean;
  onToggleSim: () => void;
  dataMode: DataMode;
  dataError: string | null;
  onRefresh: () => void;
  onOpenShortcuts: () => void;
  children: ReactNode;
}

export function AppShell({
  activeTab,
  onChangeTab,
  session,
  selectedDriver,
  isSimulating,
  onToggleSim,
  dataMode,
  dataError,
  onRefresh,
  onOpenShortcuts,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-background-carbon text-on-surface antialiased overflow-x-hidden pb-20 md:pb-6">
      {/* Top Nav */}
      <nav
        id="top_nav_bar"
        className="fixed top-0 right-0 left-0 md:left-64 h-16 z-40 border-b border-white/5 bg-surface-container/95 backdrop-blur-md flex justify-between items-center px-4"
      >
        <div className="flex items-center gap-6">
          <span
            className="font-sans font-black italic text-f1-red text-lg md:text-xl tracking-tight cursor-pointer"
            onClick={() => onChangeTab('dashboard')}
          >
            APEX TELEMETRY
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className={`hidden sm:flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border transition-colors ${
              dataMode === 'live'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15'
                : dataMode === 'loading'
                  ? 'bg-white/5 border-white/10 text-on-surface-variant'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/15'
            }`}
            title={dataError ?? 'Re-sync OpenF1 + Jolpica'}
          >
            {dataMode === 'live' ? (
              <Cloud size={11} />
            ) : dataMode === 'loading' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <CloudOff size={11} />
            )}
            {dataMode === 'live' ? 'OPENF1 LIVE' : dataMode === 'loading' ? 'SYNCING' : 'SIM FALLBACK'}
          </button>
          <span className="font-mono text-[11px] text-on-surface-variant/75 hidden lg:block uppercase bg-white/5 border border-white/5 px-2 py-1 rounded">
            API LATENCY: {session.apiLatency}ms
          </span>
          <button
            onClick={onToggleSim}
            className={`font-sans font-bold text-[10px] tracking-widest uppercase px-3 py-2 rounded-sm transition-colors text-white flex items-center gap-1.5 ${
              isSimulating
                ? 'bg-f1-red animate-pulse'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
            aria-pressed={isSimulating}
            aria-label={isSimulating ? 'Pause telemetry stream' : 'Resume telemetry stream'}
          >
            {isSimulating ? <Pause size={11} /> : <Play size={11} fill="currentColor" />}
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSimulating ? 'bg-white animate-ping' : 'bg-white/50'
              }`}
            />
            {isSimulating ? 'LIVE' : 'PAUSED'}
          </button>
          <div className="hidden md:flex gap-2 text-on-surface-variant/80">
            <button
              onClick={onOpenShortcuts}
              className="hover:text-f1-red transition-colors"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard size={15} />
            </button>
            <Settings size={15} className="cursor-pointer hover:text-f1-red transition-colors" />
            <HelpCircle size={15} className="cursor-pointer hover:text-f1-red transition-colors" />
            <User size={15} className="cursor-pointer hover:text-f1-red transition-colors" />
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside
        id="side_nav_bar"
        className="h-screen w-64 fixed left-0 top-0 overflow-y-auto hidden md:flex flex-col border-r border-white/5 bg-surface-dim z-50"
      >
        <div className="p-4 border-b border-white/5 bg-surface-low flex flex-col gap-1">
          <h1 className="font-sans font-black tracking-tighter text-f1-red text-base uppercase leading-tight">
            F1 RACE CONTROL
          </h1>
          <p className="font-mono text-[9px] tracking-wider text-on-surface-variant/70 uppercase">
            Active: {session.country || '—'}
          </p>
        </div>
        <nav className="flex flex-col h-full gap-1 py-4">
          {SIDE_NAV.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`flex items-center px-5 py-3.5 font-mono text-xs uppercase font-bold text-left tracking-wider transition-all border-l-4 ${
                  isActive
                    ? 'bg-f1-red/10 border-f1-red text-f1-red font-extrabold'
                    : 'border-transparent text-on-surface-variant hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon size={13} className="mr-3" />
                {item.label}
              </button>
            );
          })}
        </nav>
        {selectedDriver && isSimulating && (
          <div className="p-4 border-t border-white/5 bg-black/35 font-mono text-[10px] flex flex-col gap-1.5 mt-auto">
            <div className="flex justify-between uppercase">
              <span className="text-on-surface-variant/70">Selected car</span>
              <span className="font-extrabold" style={{ color: selectedDriver.teamColor }}>
                {selectedDriver.code} (#{selectedDriver.number})
              </span>
            </div>
            <div className="flex justify-between uppercase">
              <span className="text-on-surface-variant/70">Live velocity</span>
              <span className="font-bold text-on-surface">{selectedDriver.speed} KM/H</span>
            </div>
            <div className="flex justify-between uppercase">
              <span className="text-on-surface-variant/70">Tyre</span>
              <span className="font-bold text-white/90">{selectedDriver.tyre} · {selectedDriver.tyreAge}L</span>
            </div>
          </div>
        )}
        {!isSimulating && (
          <div className="p-4 border-t border-white/5 bg-black/35 font-mono text-[10px] flex flex-col gap-1.5 mt-auto text-center">
            <span className="text-on-surface-variant uppercase">No active session</span>
            <span className="text-on-surface-variant/60">Simulator paused</span>
          </div>
        )}
      </aside>

      <main id="main_content_area" className="md:ml-64 pt-20 p-4 md:p-6 lg:p-8">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav
        id="bottom_nav_bar"
        className="fixed bottom-0 w-full z-50 md:hidden border-t border-white/5 bg-surface-container/95 backdrop-blur-md flex justify-around items-center h-16"
      >
        {[
          { id: 'live-timing' as AppTab, label: 'Timing', icon: Timer },
          { id: 'track-map' as AppTab, label: 'Track', icon: Map },
          { id: 'dashboard' as AppTab, label: 'Home', icon: LayoutGrid },
          { id: 'telemetry' as AppTab, label: 'Telemetry', icon: Activity },
          { id: 'standings' as AppTab, label: 'Standings', icon: TrendingUp },
        ].map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center justify-center p-2 flex-1 ${
                isActive ? 'text-f1-red' : 'text-on-surface-variant'
              }`}
            >
              <item.icon size={item.id === 'dashboard' ? 15 : 14} />
              <span className="font-mono text-[9px] mt-1 font-bold">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
