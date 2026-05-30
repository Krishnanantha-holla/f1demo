import { useEffect } from 'react';
import type { AppTab } from '../types';

interface Options {
  onChangeTab: (t: AppTab) => void;
  onToggleSim: () => void;
  onRefresh: () => void;
  onOpenShortcuts: () => void;
}

export function useKeyboardShortcuts({ onChangeTab, onToggleSim, onRefresh, onOpenShortcuts }: Options) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when typing in inputs / contenteditable.
      const target = e.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, [contenteditable="true"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'd':
          onChangeTab('dashboard');
          break;
        case 'l':
          onChangeTab('live-timing');
          break;
        case 't':
          onChangeTab('track-map');
          break;
        case 'g':
          onChangeTab('telemetry');
          break;
        case 's':
          onChangeTab('standings');
          break;
        case 'a':
          onChangeTab('analysis');
          break;
        case 'i':
          onChangeTab('intel');
          break;
        case ' ':
          e.preventDefault();
          onToggleSim();
          break;
        case 'r':
          onRefresh();
          break;
        case '?':
          onOpenShortcuts();
          break;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onChangeTab, onToggleSim, onRefresh, onOpenShortcuts]);
}

export const SHORTCUT_LIST: Array<{ key: string; description: string }> = [
  { key: 'D', description: 'Open Dashboard' },
  { key: 'L', description: 'Open Live Timing' },
  { key: 'T', description: 'Open Track Map' },
  { key: 'G', description: 'Open Telemetry' },
  { key: 'S', description: 'Open Standings' },
  { key: 'A', description: 'Open Analysis' },
  { key: 'I', description: 'Open Intel & News' },
  { key: 'Space', description: 'Pause / resume the simulator' },
  { key: 'R', description: 'Re-sync OpenF1 + Jolpica' },
  { key: '?', description: 'Show this help' },
];
