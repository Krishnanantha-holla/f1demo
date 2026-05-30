/**
 * News aggregator.
 *
 * Resolution order:
 * 1. The local FastAPI backend at VITE_BACKEND_URL — same dedup/order as the
 *    server-side `services/news_service.py` we ship in `f1demo/backend`.
 * 2. Public RSS feeds via api.rss2json.com (CORS-open, free, generous quota).
 *
 * The aggregator is fault-tolerant: any individual feed failure is swallowed
 * so a single broken source can't poison the whole dashboard.
 */

import { fetchJson } from './http';

const BACKEND = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
const RSS2JSON = 'https://api.rss2json.com/v1/api.json';

const RSS_FEEDS: Array<{ url: string; source: string }> = [
  { url: 'https://www.autosport.com/rss/feed/f1', source: 'Autosport' },
  { url: 'https://www.motorsport.com/rss/f1/news/', source: 'Motorsport.com' },
  { url: 'https://www.racefans.net/feed/', source: 'RaceFans' },
  { url: 'https://www.planetf1.com/feed', source: 'PlanetF1' },
  { url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml', source: 'BBC Sport F1' },
];

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  published: string;
  image: string | null;
  summary: string;
}

interface RawBackendNews {
  title?: string;
  link?: string;
  source?: string;
  published?: string;
  image?: string | null;
  summary?: string;
}

interface Rss2JsonResponse {
  status: string;
  feed?: { title?: string };
  items?: Array<{
    title: string;
    link: string;
    pubDate: string;
    description: string;
    enclosure?: { link?: string };
    thumbnail?: string;
  }>;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchFromBackend(signal?: AbortSignal): Promise<NewsArticle[] | null> {
  if (!BACKEND) return null;
  try {
    const rows = await fetchJson<RawBackendNews[]>(`${BACKEND}/api/news`, {
      signal,
      ttl: 5 * 60_000,
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.map(a => ({
      title: a.title || 'Untitled',
      link: a.link || '#',
      source: a.source || 'F1',
      published: a.published || '',
      image: a.image ?? null,
      summary: a.summary ? stripHtml(a.summary).slice(0, 280) : '',
    }));
  } catch {
    return null;
  }
}

async function fetchFromRssGateway(signal?: AbortSignal): Promise<NewsArticle[]> {
  const collected: NewsArticle[] = [];
  await Promise.all(
    RSS_FEEDS.map(async feed => {
      try {
        const data = await fetchJson<Rss2JsonResponse>(
          `${RSS2JSON}?rss_url=${encodeURIComponent(feed.url)}`,
          { signal, ttl: 10 * 60_000 },
        );
        if (data.status !== 'ok' || !data.items) return;
        for (const item of data.items.slice(0, 10)) {
          collected.push({
            title: item.title,
            link: item.link,
            source: feed.source,
            published: item.pubDate,
            image: item.thumbnail || item.enclosure?.link || null,
            summary: item.description ? stripHtml(item.description).slice(0, 280) : '',
          });
        }
      } catch {
        /* swallow individual feed failures */
      }
    }),
  );
  return collected;
}

export async function fetchNews(signal?: AbortSignal): Promise<NewsArticle[]> {
  const fromBackend = await fetchFromBackend(signal);
  const articles = fromBackend ?? (await fetchFromRssGateway(signal));

  articles.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

  const seen = new Set<string>();
  return articles.filter(a => {
    const key = a.title.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
