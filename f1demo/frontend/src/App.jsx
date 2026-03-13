
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Drivers from './pages/Drivers';
import Constructors from './pages/Constructors';
import Calendar from './pages/Calendar';
import Telemetry from './pages/Telemetry';
import Analysis from './pages/Analysis';
import RaceDetail from './pages/RaceDetail';
import NewsFeed from './pages/NewsFeed';

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/constructors" element={<Constructors />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/telemetry" element={<Telemetry />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/race/:meetingKey" element={<RaceDetail />} />
            <Route path="/news" element={<NewsFeed />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

