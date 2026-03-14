import { NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

const icons = [
  { to: '/',             label: 'Dashboard',    d: 'M3,3h7v7H3ZM14,3h7v7H14ZM3,14h7v7H3ZM14,14h7v7H14Z' },
  { to: '/drivers',      label: 'Drivers',      d: 'M20,21v-2a4,4,0,0,0-4-4H8a4,4,0,0,0-4,4v2M12,3a4,4,0,1,1,0,8,4,4,0,0,1,0-8Z' },
  { to: '/constructors', label: 'Constructors', d: 'M17,21v-2a4,4,0,0,0-4-4H5a4,4,0,0,0-4,4v2M23,21v-2a4,4,0,0,0-3-3.87M16,3.13a4,4,0,0,1,0,7.75M9,7a4,4,0,1,1,0,8,4,4,0,0,1,0-8Z' },
  { to: '/calendar',     label: 'Calendar',     d: 'M19,4H5A2,2,0,0,0,3,6V20a2,2,0,0,0,2,2H19a2,2,0,0,0,2-2V6A2,2,0,0,0,19,4ZM16,2v4M8,2v4M3,10H21' },
  { to: '/analysis',     label: 'Analysis',     d: 'M3,3v18h18M7,16l4-4,4,4,5-6' },
  { to: '/telemetry',    label: 'Telemetry',    d: 'M22,12A10,10,0,1,1,12,2M22,12l-4-4M22,12l-4,4' },
  { to: '/news',         label: 'News Feed', d: 'M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v10a2 2 0 0 1-2 2z M13 2v6h6' },
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
      {/* Mobile hamburger */}
      <button
        className="hamburger-btn"
        onClick={() => setCollapsed(c => !c)}
        aria-label="Toggle menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={collapsed ? 'M6,18L18,6M6,6L18,18' : 'M3,6h18M3,12h18M3,18h18'} />
        </svg>
      </button>

      <nav ref={navRef} className={`sidebar${collapsed ? ' open' : ''}`}>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.d} />
            </svg>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div className="sidebar-spacer" />
        <div className="sidebar-footer">{new Date().getFullYear()} Season</div>
      </nav>

      {/* Mobile overlay */}
      {collapsed && <div className="sidebar-overlay" onClick={() => setCollapsed(false)} />}
    </>
  );
}
