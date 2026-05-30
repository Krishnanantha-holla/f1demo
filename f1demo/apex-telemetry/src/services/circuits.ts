/**
 * Circuit geometry service.
 *
 * Pulls real-world circuit polylines from bacinger/f1-circuits on GitHub
 * (https://github.com/bacinger/f1-circuits) — the de-facto F1 circuit GeoJSON
 * dataset, MIT licensed, used by f1-dash and several FOSS dashboards.
 *
 * We resolve the right circuit for a given OpenF1 session by:
 *   country_name → ISO-2 country code → bacinger circuit ID.
 *
 * The track is then projected to the SVG viewport so every circuit fits the
 * same canvas dimensions regardless of latitude.
 */

import { fetchJson } from './http';

const RAW_BASE = 'https://raw.githubusercontent.com/bacinger/f1-circuits/master';
const LOCATIONS_URL = `${RAW_BASE}/f1-locations.json`;

export interface CircuitSummary {
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  zoom: number;
}

export interface CircuitGeometry {
  /** bacinger circuit id, e.g. `mc-1929` */
  id: string;
  /** Country name as supplied by OpenF1 / Jolpica. */
  country: string;
  /** Display name. */
  name: string;
  /** Stated track length in metres, when present in the geojson properties. */
  lengthMeters?: number;
  /** Polyline projected to a 1000×1000 viewport with a small padding. */
  points: Array<{ x: number; y: number }>;
  /** Approximate normalised position of the start/finish line on the path. */
  startProgress: number;
}

const COUNTRY_TO_CC: Record<string, string> = {
  Bahrain: 'bh',
  'Saudi Arabia': 'sa',
  Australia: 'au',
  Japan: 'jp',
  China: 'cn',
  'United States': 'us',
  USA: 'us',
  'United States of America': 'us',
  Italy: 'it',
  Monaco: 'mc',
  Spain: 'es',
  Canada: 'ca',
  Austria: 'at',
  'United Kingdom': 'gb',
  UK: 'gb',
  'Great Britain': 'gb',
  Hungary: 'hu',
  Belgium: 'be',
  Netherlands: 'nl',
  Azerbaijan: 'az',
  Singapore: 'sg',
  Mexico: 'mx',
  Brazil: 'br',
  Qatar: 'qa',
  'United Arab Emirates': 'ae',
  UAE: 'ae',
  France: 'fr',
  Germany: 'de',
  Argentina: 'ar',
  Portugal: 'pt',
  Turkey: 'tr',
  Russia: 'ru',
  Korea: 'kr',
  India: 'in',
  Malaysia: 'my',
};

let locationsCache: CircuitSummary[] | null = null;

async function loadLocations(signal?: AbortSignal): Promise<CircuitSummary[]> {
  if (locationsCache) return locationsCache;
  const rows = await fetchJson<CircuitSummary[]>(LOCATIONS_URL, { signal, ttl: 24 * 60 * 60_000 });
  locationsCache = rows;
  return rows;
}

interface FeatureCollection {
  features: Array<{
    properties: { Name?: string; Location?: string; length?: number; opened?: number };
    geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
  }>;
}

function projectCoords(
  coords: Array<[number, number]>,
  size = 1000,
  padding = 80,
): Array<{ x: number; y: number }> {
  if (coords.length === 0) return [];
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const span = Math.max(maxLon - minLon, maxLat - minLat) || 1;
  const usable = size - padding * 2;
  const offsetX = padding + (usable - ((maxLon - minLon) / span) * usable) / 2;
  const offsetY = padding + (usable - ((maxLat - minLat) / span) * usable) / 2;
  return coords.map(([lon, lat]) => ({
    x: offsetX + ((lon - minLon) / span) * usable,
    // SVG y grows downwards; latitude grows upwards.
    y: size - offsetY - ((lat - minLat) / span) * usable,
  }));
}

/**
 * Pick the best circuit ID for a given country/location pair. We prefer the
 * most recent layout when more than one is registered for the same country.
 */
function pickCircuitId(
  rows: CircuitSummary[],
  country: string,
  location?: string,
): string | null {
  const cc = COUNTRY_TO_CC[country];
  if (!cc) return null;
  const matching = rows.filter(r => r.id.startsWith(`${cc}-`));
  if (matching.length === 0) return null;
  if (matching.length === 1) return matching[0].id;

  if (location) {
    const lower = location.toLowerCase();
    const exact = matching.find(m => m.location.toLowerCase() === lower);
    if (exact) return exact.id;
    const partial = matching.find(m => lower.includes(m.location.toLowerCase()));
    if (partial) return partial.id;
  }

  // Fall back to the layout with the highest year suffix (most recent).
  return matching
    .slice()
    .sort((a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]))
    .at(-1)!.id;
}

export async function fetchCircuitGeometry(
  country: string,
  location?: string,
  signal?: AbortSignal,
): Promise<CircuitGeometry | null> {
  try {
    const rows = await loadLocations(signal);
    const id = pickCircuitId(rows, country, location);
    if (!id) return null;
    const geo = await fetchJson<FeatureCollection>(`${RAW_BASE}/circuits/${id}.geojson`, {
      signal,
      ttl: 24 * 60 * 60_000,
    });
    const feature = geo.features?.[0];
    if (!feature) return null;
    const points = projectCoords(feature.geometry.coordinates);
    return {
      id,
      country,
      name: feature.properties.Name ?? id,
      lengthMeters: feature.properties.length,
      points,
      startProgress: 0,
    };
  } catch {
    return null;
  }
}
