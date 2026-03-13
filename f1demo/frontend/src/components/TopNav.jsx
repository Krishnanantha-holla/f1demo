import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api';

const links = [
  { to: '/',             label: 'Dashboard' },
  { to: '/drivers',      label: 'Drivers' },
  { to: '/constructors', label: 'Constructors' },
  { to: '/calendar',     label: 'Calendar' },
  { to: '/telemetry',    label: 'Telemetry' },
];

export default function TopNav() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    api.health()
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'));
  }, []);

  return (
    <div className="topnav">
      <div className="topnav-left">
        <span className="topnav-logo">F1</span>
      </div>
      <div className="topnav-links">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}
            end={l.to === '/'}
          >
            {l.label}
          </NavLink>
        ))}
      </div>
      <div className="topnav-right">
        <div className="api-status">
          <span className={`status-dot ${status}`} />
          <span>{status === 'checking' ? 'Checking...' : status === 'online' ? 'Connected' : 'Offline'}</span>
        </div>
      </div>
    </div>
  );
}
