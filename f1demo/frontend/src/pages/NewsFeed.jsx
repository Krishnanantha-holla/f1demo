import { useEffect, useState } from 'react';
import { api } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const seconds = Math.floor((new Date() - d) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
}

export default function NewsFeed() {
  const [news, setNews] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.news()
      .then(data => {
        if (!data || data.length === 0) setStatus('empty');
        else {
          setNews(data);
          setStatus('ok');
        }
      })
      .catch((e) => {
        console.error("News feed error:", e);
        setStatus('error');
      });
  }, []);

  if (status === 'loading') return <Loading text="Aggregating latest F1 feeds..." />;
  if (status === 'error') return <ErrorMsg text="Failed to load news. Check if the backend is running and can parse the RSS feeds." />;
  if (status === 'empty') return <ErrorMsg text="No news found." />;

  return (
    <div className="news-page" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2.5rem', letterSpacing: '-1px' }}>Latest News</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Latest Breaking F1 News
          </p>
        </div>
      </div>

      <div className="news-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {news.map((item, i) => {
          let sourceColor = 'var(--accent)';
          if (item.source === 'Crash.net') sourceColor = '#E31B23';
          if (item.source === 'GPFans') sourceColor = '#FF6B00';
          if (item.source === 'Sky Sports') sourceColor = '#0072CE';
          if (item.source === 'BBC Sport') sourceColor = '#F5C400';

          return (
            <a 
              key={`${item.link}-${i}`} 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="news-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'all var(--transition-bounce)',
                animation: `fadeUp 0.6s var(--ease-out-quint) backwards`,
                animationDelay: `${Math.min(i * 40, 600)}ms`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'var(--border-hover)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div 
                className="news-card-top" 
                style={{ 
                  height: '6px', 
                  width: '100%', 
                  background: `linear-gradient(90deg, ${sourceColor}, transparent)` 
                }} 
              />
              
              <div style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px' }}>
                  <span style={{ color: sourceColor, textTransform: 'uppercase' }}>{item.source}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{timeAgo(item.published)}</span>
                </div>
                
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '0.75rem', color: '#fff' }}>
                  {item.title}
                </h3>
                
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flexGrow: 1 }}>
                  {stripHtml(item.summary)}
                </p>

                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Read full article</span>
                  <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>→</span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
