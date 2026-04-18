import { useEffect, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { api } from '../api';
import { Loading, ErrorMsg } from '../components/Shared';

function stripHtml(html) {
  if (!html) return '';
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  return doc.body.textContent || '';
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const seconds = Math.floor((new Date() - d) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "just now";
}

function NewsCard({ article, index }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('news-card-visible');
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const sourceColors = {
    'Autosport': '#E10600',
    'Motorsport.com': '#FF6B00',
    'RaceFans': '#00D26A',
    'PlanetF1': '#3B82F6',
    'Crash.net': '#E31B23',
    'GPFans': '#FF8C00',
    'Sky Sports F1': '#0072CE',
    'BBC Sport F1': '#F5C400',
    'Formula1.com': '#E10600',
  };

  const sourceColor = sourceColors[article.source] || '#888';
  const summary = stripHtml(article.summary);

  return (
    <a 
      ref={cardRef}
      href={article.link} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="news-card-modern"
      style={{ '--delay': `${Math.min(index * 0.05, 1)}s` }}
    >
      {article.image && !imageError && (
        <div className="news-card-image-wrapper">
          <img 
            src={article.image} 
            alt={article.title}
            className={`news-card-image ${imageLoaded ? 'loaded' : ''}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
          {!imageLoaded && <div className="news-card-image-skeleton" />}
          <div className="news-card-image-overlay" />
        </div>
      )}
      
      <div className="news-card-content">
        <div className="news-card-meta">
          <span className="news-source" style={{ color: sourceColor }}>
            {article.source}
          </span>
          <span className="news-time">{timeAgo(article.published)}</span>
        </div>
        
        <h3 className="news-card-title">{article.title}</h3>
        
        {summary && (
          <p className="news-card-summary">{summary}</p>
        )}

        <div className="news-card-footer">
          <span className="news-read-more">
            Read article
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </span>
        </div>
      </div>

      <div className="news-card-glow" style={{ '--glow-color': sourceColor }} />
    </a>
  );
}

export default function NewsFeed() {
  const [news, setNews] = useState([]);
  const [status, setStatus] = useState('loading');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      try {
        const data = await api.news();
        if (cancelled) return;
        
        if (!data || data.length === 0) {
          setStatus('empty');
        } else {
          setNews(data);
          setStatus('ok');
        }
      } catch (e) {
        console.error("News feed error:", e);
        if (!cancelled) setStatus('error');
      }
    }

    loadNews();
    return () => { cancelled = true; };
  }, []);

  const sources = [...new Set(news.map(n => n.source))].sort();
  
  const filteredNews = news.filter(article => {
    const matchesFilter = filter === 'all' || article.source === filter;
    const matchesSearch = !searchQuery || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stripHtml(article.summary).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (status === 'loading') {
    return (
      <div className="news-page-modern">
        <div className="news-header-modern">
          <div className="news-header-content">
            <div className="news-header-icon">📰</div>
            <div>
              <h1 className="news-title-modern">Latest F1 News</h1>
              <p className="news-subtitle-modern">Real-time updates from top motorsport sources</p>
            </div>
          </div>
        </div>
        <Loading text="Loading latest F1 news..." />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="news-page-modern">
        <div className="news-header-modern">
          <div className="news-header-content">
            <div className="news-header-icon">📰</div>
            <div>
              <h1 className="news-title-modern">Latest F1 News</h1>
              <p className="news-subtitle-modern">Real-time updates from top motorsport sources</p>
            </div>
          </div>
        </div>
        <div className="news-error-state">
          <div className="news-error-icon">⚠️</div>
          <h3>Unable to load news</h3>
          <p>Check your connection and try refreshing the page</p>
          <button className="news-retry-btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="news-page-modern">
        <div className="news-header-modern">
          <div className="news-header-content">
            <div className="news-header-icon">📰</div>
            <div>
              <h1 className="news-title-modern">Latest F1 News</h1>
              <p className="news-subtitle-modern">Real-time updates from top motorsport sources</p>
            </div>
          </div>
        </div>
        <div className="news-error-state">
          <div className="news-error-icon">📭</div>
          <h3>No news available</h3>
          <p>Check back soon for the latest F1 updates</p>
        </div>
      </div>
    );
  }

  return (
    <div className="news-page-modern">
      <div className="news-header-modern">
        <div className="news-header-content">
          <div className="news-header-icon">📰</div>
          <div>
            <h1 className="news-title-modern">Latest F1 News</h1>
            <p className="news-subtitle-modern">
              {filteredNews.length} {filteredNews.length === 1 ? 'article' : 'articles'} from {sources.length} sources
            </p>
          </div>
        </div>

        <div className="news-controls">
          <div className="news-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input 
              type="text"
              placeholder="Search news..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="news-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>

          <select 
            className="news-filter"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">All Sources ({news.length})</option>
            {sources.map(source => (
              <option key={source} value={source}>
                {source} ({news.filter(n => n.source === source).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredNews.length === 0 ? (
        <div className="news-error-state">
          <div className="news-error-icon">🔍</div>
          <h3>No results found</h3>
          <p>Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="news-grid-modern">
          {filteredNews.map((article, i) => (
            <NewsCard key={article.link} article={article} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
