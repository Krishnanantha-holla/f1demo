/**
 * Browser-side HTTP helpers shared by every data adapter.
 *
 * - In-flight cache keyed by URL + AbortSignal so concurrent screens never
 *   stampede the same OpenF1/Jolpica endpoint.
 * - TTL response cache (sessionStorage) so route-switching feels instant.
 * - Soft-fail for OpenF1's `{ "detail": "No results found." }` envelope, which
 *   their API returns with HTTP 200 instead of 404.
 */

const inflight = new Map<string, Promise<unknown>>();

const CACHE_PREFIX = 'apex:cache:';

interface CachedEntry<T> {
  expiresAt: number;
  body: T;
}

function readCache<T>(url: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return undefined;
    const parsed: CachedEntry<T> = JSON.parse(raw);
    if (parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(CACHE_PREFIX + url);
      return undefined;
    }
    return parsed.body;
  } catch {
    return undefined;
  }
}

function writeCache<T>(url: string, body: T, ttlMs: number) {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + url,
      JSON.stringify({ expiresAt: Date.now() + ttlMs, body } satisfies CachedEntry<T>),
    );
  } catch {
    /* quota exceeded, ignore */
  }
}

export interface FetchOptions {
  signal?: AbortSignal;
  /** Cache TTL in ms. 0 disables caching entirely. */
  ttl?: number;
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { signal, ttl = 0 } = opts;

  if (ttl > 0) {
    const cached = readCache<T>(url);
    if (cached !== undefined) return cached;
  }

  const inflightKey = url;
  if (inflight.has(inflightKey)) {
    return inflight.get(inflightKey) as Promise<T>;
  }

  const promise = fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  }).then(async res => {
    if (!res.ok) {
      throw new Error(`${url} → HTTP ${res.status}`);
    }
    const body = (await res.json()) as T;
    if (ttl > 0) writeCache(url, body, ttl);
    return body;
  });

  inflight.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(inflightKey);
  }
}

/**
 * OpenF1 returns `{ "detail": "No results found." }` (HTTP 200) when a query
 * has no results. This helper coerces that envelope to an empty array and
 * never throws, so the UI can render gracefully.
 */
export async function fetchOpenF1Array<T>(url: string, opts: FetchOptions = {}): Promise<T[]> {
  try {
    const body = await fetchJson<unknown>(url, opts);
    return Array.isArray(body) ? (body as T[]) : [];
  } catch {
    return [];
  }
}

export function clearHttpCache() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
