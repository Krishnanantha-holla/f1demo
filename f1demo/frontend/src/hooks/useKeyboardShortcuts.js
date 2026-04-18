import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyPress(e) {
      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Alt + key shortcuts for quick navigation
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            navigate('/');
            break;
          case 'r':
            e.preventDefault();
            navigate('/drivers');
            break;
          case 't':
            e.preventDefault();
            navigate('/constructors');
            break;
          case 'c':
            e.preventDefault();
            navigate('/calendar');
            break;
          case 'l':
            e.preventDefault();
            navigate('/telemetry');
            break;
          case 'a':
            e.preventDefault();
            navigate('/analysis');
            break;
          case 'n':
            e.preventDefault();
            navigate('/news');
            break;
          default:
            break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);
}
