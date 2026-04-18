import { useState, useEffect } from 'react';

export default function KeyboardShortcutsHelp() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function handleKeyPress(e) {
      if (e.key === '?' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        setShow(s => !s);
      }
      if (e.key === 'Escape') {
        setShow(false);
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!show) {
    return (
      <button 
        className="shortcuts-trigger"
        onClick={() => setShow(true)}
        title="Keyboard shortcuts (Press ?)"
      >
        ⌨️
      </button>
    );
  }

  return (
    <div className="shortcuts-modal-overlay" onClick={() => setShow(false)}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h3>Keyboard Shortcuts</h3>
          <button className="shortcuts-close" onClick={() => setShow(false)}>✕</button>
        </div>
        <div className="shortcuts-body">
          <div className="shortcuts-section">
            <h4>Navigation</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item">
                <kbd>Alt</kbd> + <kbd>D</kbd>
                <span>Dashboard</span>
              </div>
              <div className="shortcut-item">
                <kbd>Alt</kbd> + <kbd>R</kbd>
                <span>Drivers</span>
              </div>
              <div className="shortcut-item">
                <kbd>Alt</kbd> + <kbd>T</kbd>
                <span>Constructors</span>
              </div>
              <div className="shortcut-item">
                <kbd>Alt</kbd> + <kbd>C</kbd>
                <span>Calendar</span>
              </div>
              <div className="shortcut-item">
                <kbd>Alt</kbd> + <kbd>L</kbd>
                <span>Telemetry</span>
              </div>
              <div className="shortcut-item">
                <kbd>Alt</kbd> + <kbd>A</kbd>
                <span>Analysis</span>
              </div>
              <div className="shortcut-item">
                <kbd>Alt</kbd> + <kbd>N</kbd>
                <span>News Feed</span>
              </div>
            </div>
          </div>
          <div className="shortcuts-section">
            <h4>General</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item">
                <kbd>?</kbd>
                <span>Toggle this help</span>
              </div>
              <div className="shortcut-item">
                <kbd>Esc</kbd>
                <span>Close modals</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
