import { create } from 'zustand';

export const useF1Store = create((set) => ({
  sessionMode: 'idle',
  sessionInfo: null,

  driverStandings: [],
  constructorStandings: [],
  driverRoster: [],
  nextRace: null,
  lastResults: null,

  sidebarCollapsed: false,
  activeYear: new Date().getFullYear(),

  loading: {
    standings: false,
    roster: false,
    session: false,
  },

  setSessionMode: (mode, info) => set({ sessionMode: mode, sessionInfo: info }),
  setDriverStandings: (data) => set({ driverStandings: data }),
  setConstructorStandings: (data) => set({ constructorStandings: data }),
  setDriverRoster: (data) => set({ driverRoster: data }),
  setNextRace: (data) => set({ nextRace: data }),
  setLastResults: (data) => set({ lastResults: data }),
  setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),
  setActiveYear: (year) => set({ activeYear: year }),
  setLoading: (key, val) => set((state) => ({ loading: { ...state.loading, [key]: val } })),
}));
