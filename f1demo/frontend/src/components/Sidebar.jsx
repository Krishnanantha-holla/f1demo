import { NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

const icons = [
  { to: '/',             label: 'Dashboard',    d: 'M3,3h7v7H3ZM14,3h7v7H14ZM3,14h7v7H3ZM14,14h7v7H14Z' },
  { to: '/drivers',      label: 'Drivers',      d: 'M20,21v-2a4,4,0,0,0-4-4H8a4,4,0,0,0-4,4v2M12,3a4,4,0,1,1,0,8,4,4,0,0,1,0-8Z' },
  { to: '/constructors', label: 'Constructors', d: 'M17,21v-2a4,4,0,0,0-4-4H5a4,4,0,0,0-4,4v2M23,21v-2a4,4,0,0,0-3-3.87M16,3.13a4,4,0,0,1,0,7.75M9,7a4,4,0,1,1,0,8,4,4,0,0,1,0-8Z' },
  { to: '/calendar',     label: 'Calendar',     d: 'M19,4H5A2,2,0,0,0,3,6V20a2,2,0,0,0,2,2H19a2,2,0,0,0,2-2V6A2,2,0,0,0,19,4ZM16,2v4M8,2v4M3,10H21' },
  { to: '/head-to-head', label: 'Head to Head', d: 'M16,3h5v5M8,3H3v5M21,3L14,10M3,3l7,7M16,21h5v-5M8,21H3v-5M21,21l-7-7M3,21l7-7' },
  { to: '/driver-stats', label: 'Driver Stats', d: 'M12,2a10,10,0,1,0,10,10A10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20ZM12,6v6l4,2' },
  { to: '/race-pace',    label: 'Race Pace',    d: 'M3,3v18h18M7,16l4-4,4,4,5-6' },
  { to: '/analysis',     label: 'Analysis',     d: 'M21,21H3V3M7,14l4-4,4,4,5-6' },
  { to: '/telemetry',    label: 'Telemetry',    d: 'M22,12A10,10,0,1,1,12,2M22,12l-4-4M22,12l-4,4' },
  { to: '/track-map',    label: 'Track Map',    d: 'M12,2C8.13,2,5,5.13,5,9c0,5.25,7,13,7,13s7-7.75,7-13C19,5.13,15.87,2,12,2Zm0,9.5A2.5,2.5,0,1,1,14.5,9,2.5,2.5,0,0,1,12,11.5Z' },
  { to: '/pit-stops',    label: 'Pit Stops',    d: 'M14.7,6.3a1,1,0,0,0,0,1.4l1.6,1.6a1,1,0,0,0,1.4,0l3.77-3.77a6,6,0,0,1-7.94,7.94l-6.91,6.91a2.12,2.12,0,0,1-3-3l6.91-6.91a6,6,0,0,1,7.94-7.94Z' },
  { to: '/pu-tracker',   label: 'PU Tracker',   d: 'M13,2L3,14h9l-1,8,10-12H12Z' },
  { to: '/results',      label: 'Results',      d: 'M9,11l3,3L22,4M21,12v7a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2V5A2,2,0,0,1,5,3h11' },
  { to: '/track-dna',    label: 'Track DNA',    d: 'M12,2a10,10,0,1,0,10,10A10,10,0,0,0,12,2ZM2,12H22M12,2a15.3,15.3,0,0,1,4,10,15.3,15.3,0,0,1-4,10,15.3,15.3,0,0,1-4-10A15.3,15.3,0,0,1,12,2Z' },
  { to: '/consistency',  label: 'Consistency',  d: 'M4,19.5A2.5,2.5,0,0,1,6.5,17H20M4,14.5A2.5,2.5,0,0,1,6.5,12H20M4,4.5A2.5,2.5,0,0,0,6.5,7H20' },
  { to: '/news',         label: 'News Feed',    d: 'M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v10a2 2 0 0 1-2 2z M13 2v6h6' },
  { to: '/ai-chat',      label: 'AI Discussion', d: 'M21,15a2,2,0,0,1-2,2H7l-4,4V5A2,2,0,0,1,5,3H19a2,2,0,0,1,2,2Z' },
  { to: '/settings',     label: 'Settings',     d: 'M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Zm8.94-2.39c.04-.36.06-.73.06-1.11s-.02-.75-.06-1.11l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a8.67 8.67 0 0 0-1.92-1.11l-.38-2.65A.5.5 0 0 0 15.5 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.68.27-1.32.63-1.92 1.11l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64L5.95 11c-.04.36-.06.73-.06 1.11s.02.75.06 1.11L3.84 14.87a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.6.48 1.24.84 1.92 1.11l.38 2.65A.5.5 0 0 0 11.5 22h4a.5.5 0 0 0 .49-.42l.38-2.65c.68-.27 1.32-.63 1.92-1.11l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.32-1.84Z' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    const node = navRef.current;
    if (!node) return undefined;

    const updateFade = () => {
      const canScroll = node.scrollHeight > node.clientHeight + 2;
      if (!canScroll) {
        setShowTopFade(false);
        setShowBottomFade(false);
        return;
      }
      setShowTopFade(node.scrollTop > 4);
      setShowBottomFade(node.scrollTop + node.clientHeight < node.scrollHeight - 4);
    };

    updateFade();
    node.addEventListener('scroll', updateFade);
    window.addEventListener('resize', updateFade);
    return () => {
      node.removeEventListener('scroll', updateFade);
      window.removeEventListener('resize', updateFade);
    };
  }, []);

  return (
    <>
      <button
        className="hamburger-btn"
        onClick={() => setCollapsed(c => !c)}
        aria-label="Toggle menu"
        aria-expanded={collapsed}
        aria-controls="primary-nav"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d={collapsed ? 'M6,18L18,6M6,6L18,18' : 'M3,6h18M3,12h18M3,18h18'} />
        </svg>
      </button>

      <nav id="primary-nav" ref={navRef} className={`sidebar${collapsed ? ' open' : ''}`}>
        <div className={`sidebar-scroll-fade top ${showTopFade ? 'visible' : ''}`} />
        <div className={`sidebar-scroll-fade bottom ${showBottomFade ? 'visible' : ''}`} />
        <div className="sidebar-logo">F1</div>
        {icons.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-icon${isActive ? ' active' : ''}`}
            title={item.label}
            end={item.to === '/'}
            onClick={() => setCollapsed(false)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={item.d} />
            </svg>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div className="sidebar-spacer" />
        <div className="sidebar-footer">{new Date().getFullYear()} Season</div>
      </nav>

      {collapsed && <div className="sidebar-overlay" onClick={() => setCollapsed(false)} />}
    </>
  );
}
