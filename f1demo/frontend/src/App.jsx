import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import LiveCompanion from './components/LiveCompanion';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp';
import ToastHost from './components/Toast';
import { PageSkeleton } from './components/Shared';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppInit } from './hooks/useAppInit';

const Dashboard    = lazy(() => import('./pages/dashboard'));
const Drivers      = lazy(() => import('./pages/Drivers'));
const Constructors = lazy(() => import('./pages/Constructors'));
const Calendar     = lazy(() => import('./pages/Calendar'));
const Telemetry    = lazy(() => import('./pages/telemetry'));
const Analysis     = lazy(() => import('./pages/analysis'));
const RaceDetail   = lazy(() => import('./pages/raceDetail'));
const NewsFeed     = lazy(() => import('./pages/NewsFeed'));
const Settings     = lazy(() => import('./pages/settings'));
const HeadToHead   = lazy(() => import('./pages/HeadToHead'));
const DriverStats  = lazy(() => import('./pages/DriverStats'));
const RacePace     = lazy(() => import('./pages/analysis/RacePace'));
const PitStops     = lazy(() => import('./pages/PitStops'));
const PUTracker    = lazy(() => import('./pages/PUTracker'));
const Results      = lazy(() => import('./pages/Results'));
const TrackDNA     = lazy(() => import('./pages/TrackDNA'));
const Consistency  = lazy(() => import('./pages/Consistency'));
const LiveTrackMap = lazy(() => import('./pages/LiveTrackMap'));
const AIChat       = lazy(() => import('./pages/AIChat'));

function RoutedContent() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="route-frame">
      <Routes location={location}>
        <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="/drivers" element={<ErrorBoundary><Drivers /></ErrorBoundary>} />
        <Route path="/constructors" element={<ErrorBoundary><Constructors /></ErrorBoundary>} />
        <Route path="/calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
        <Route path="/telemetry" element={<ErrorBoundary><Telemetry /></ErrorBoundary>} />
        <Route path="/analysis" element={<ErrorBoundary><Analysis /></ErrorBoundary>} />
        <Route path="/race/:meetingKey" element={<ErrorBoundary><RaceDetail /></ErrorBoundary>} />
        <Route path="/news" element={<ErrorBoundary><NewsFeed /></ErrorBoundary>} />
        <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        <Route path="/head-to-head" element={<ErrorBoundary><HeadToHead /></ErrorBoundary>} />
        <Route path="/driver-stats" element={<ErrorBoundary><DriverStats /></ErrorBoundary>} />
        <Route path="/race-pace" element={<ErrorBoundary><RacePace /></ErrorBoundary>} />
        <Route path="/pit-stops" element={<ErrorBoundary><PitStops /></ErrorBoundary>} />
        <Route path="/pu-tracker" element={<ErrorBoundary><PUTracker /></ErrorBoundary>} />
        <Route path="/results" element={<ErrorBoundary><Results /></ErrorBoundary>} />
        <Route path="/track-dna" element={<ErrorBoundary><TrackDNA /></ErrorBoundary>} />
        <Route path="/consistency" element={<ErrorBoundary><Consistency /></ErrorBoundary>} />
        <Route path="/track-map" element={<ErrorBoundary><LiveTrackMap /></ErrorBoundary>} />
        <Route path="/ai-chat" element={<ErrorBoundary><AIChat /></ErrorBoundary>} />
      </Routes>
    </div>
  );
}

export default function App() {
  useAppInit();
  useKeyboardShortcuts();

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">Skip to content</a>
      <Sidebar />
      <div className="main-wrapper">
        <main id="main" className="content" tabIndex={-1}>
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <RoutedContent />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <LiveCompanion />
      <KeyboardShortcutsHelp />
      <ToastHost />
    </div>
  );
}
