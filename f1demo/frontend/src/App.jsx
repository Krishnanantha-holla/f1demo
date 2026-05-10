
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import LiveCompanion from './components/LiveCompanion';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp';
import { Loading } from './components/Shared';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppInit } from './hooks/useAppInit';

// Code-split each page — only loads when navigated to
// Pages with modularized directory structure
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const Drivers      = lazy(() => import('./pages/Drivers'));
const Constructors = lazy(() => import('./pages/Constructors'));
const Calendar     = lazy(() => import('./pages/Calendar'));
const Telemetry    = lazy(() => import('./pages/telemetry'));
const Analysis     = lazy(() => import('./pages/analysis'));
const RaceDetail   = lazy(() => import('./pages/raceDetail'));
const NewsFeed     = lazy(() => import('./pages/NewsFeed'));

export default function App() {
  useAppInit();
  useKeyboardShortcuts();

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <main className="content">
          <ErrorBoundary>
            <Suspense fallback={<Loading text="Loading page..." />}>
              <Routes>
                <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                <Route path="/drivers" element={<ErrorBoundary><Drivers /></ErrorBoundary>} />
                <Route path="/constructors" element={<ErrorBoundary><Constructors /></ErrorBoundary>} />
                <Route path="/calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
                <Route path="/telemetry" element={<ErrorBoundary><Telemetry /></ErrorBoundary>} />
                <Route path="/analysis" element={<ErrorBoundary><Analysis /></ErrorBoundary>} />
                <Route path="/race/:meetingKey" element={<ErrorBoundary><RaceDetail /></ErrorBoundary>} />
                <Route path="/news" element={<ErrorBoundary><NewsFeed /></ErrorBoundary>} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <LiveCompanion />
      <KeyboardShortcutsHelp />
    </div>
  );
}


