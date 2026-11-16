export interface PublicStation {
  id: number;
  name: string;
  address: string;
  operator: string | null;
  latitude: number;
  longitude: number;
  chargerLabel: string;
  maxKw: number | null;
  capacity: number | null;
  feeLabel: string | null;
  openingHours: string | null;
  distanceKm: number;
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
}

interface NominatimItem {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
  extratags?: Record<string, string> | null;
}

const publicCache = new Map<string, PublicStation[]>();

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(r * c * 10) / 10;
}

function parseChargerLabel(tags: Record<string, string>): string {
  const found: string[] = [];

  const hasTag = (key: string) => {
    const val = tags[key]?.trim().toLowerCase();
    return Boolean(val && val !== 'no' && val !== '0');
  };

  if (hasTag('socket:type2') || hasTag('socket:type2_cable')) {
    found.push('Type2');
  }
  if (hasTag('socket:type2_combo') || hasTag('socket:ccs')) {
    found.push('CCS');
  }
  if (hasTag('socket:chademo')) {
    found.push('CHAdeMO');
  }
  if (hasTag('socket:schuko')) {
    found.push('שקע רגיל');
  }

  return found.length > 0 ? found.join(' · ') : 'שקע ציבורי';
}

function parseMaxKw(tags: Record<string, string>): number | null {
  let maxKw: number | null = null;

  Object.entries(tags).forEach(([key, value]) => {
    if (
      key.endsWith(':output') ||
      key === 'maxpower' ||
      key === 'power' ||
      key === 'output'
    ) {
      const match = value.match(/(\d+(?:\.\d+)?)/);
      if (!match) return;
      const num = Number.parseFloat(match[1]);
      if (Number.isFinite(num) && num >= 1 && num <= 500) {
        maxKw = maxKw === null ? num : Math.max(maxKw, num);
      }
    }
  });

  return maxKw !== null ? Math.round(maxKw) : null;
}

function parseCapacity(tags: Record<string, string>): number | null {
  const raw = tags.capacity?.trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : null;
}

function buildAddress(item: NominatimItem, operator: string | null): string {
  const addr = item.address;
  if (addr) {
    const street = [addr.road, addr.house_number]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
    const city = (
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.suburb ||
      ''
    ).trim();
    const combined = [street, city].filter(Boolean).join(', ');
    if (combined) return combined;
  }

  if (item.display_name?.trim()) {
    return item.display_name.split(',').slice(0, 3).join(',').trim();
  }

  return operator ? `עמדה ציבורית · ${operator}` : 'עמדה ציבורית (OpenStreetMap)';
}

function mapItemToPublicStation(
  item: NominatimItem,
  centerLat: number,
  centerLng: number
): PublicStation | null {
  const lat = Number.parseFloat(item.lat);
  const lng = Number.parseFloat(item.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const tags = item.extratags ?? {};
  const access = tags.access?.trim().toLowerCase();
  if (access === 'private' || access === 'no') {
    return null;
  }

  const operator = (tags.operator || tags.network || tags.brand || '').trim() || null;
  if (operator?.toLowerCase().includes('better place')) {
    return null;
  }

  const address = buildAddress(item, operator);
  const streetHint = item.address?.road?.trim() || '';
  const rawName = item.name?.trim() || '';
  const name =
    rawName ||
    (operator
      ? `טעינה ציבורית — ${operator}`
      : streetHint
        ? `עמדה ציבורית — ${streetHint}`
        : 'עמדת טעינה ציבורית');

  const feeLabel =
    tags.fee === 'no' ? 'חינם' : tags.fee === 'yes' ? 'בתשלום' : null;

  const baseId = item.osm_id || item.place_id;
  const uniqueId = -(item.osm_type === 'way' ? 1_000_000_000_000 + baseId : baseId);

  return {
    id: uniqueId,
    name,
    address,
    operator,
    latitude: lat,
    longitude: lng,
    chargerLabel: parseChargerLabel(tags),
    maxKw: parseMaxKw(tags),
    capacity: parseCapacity(tags),
    feeLabel,
    openingHours: tags.opening_hours?.trim() || null,
    distanceKm: calculateDistanceKm(centerLat, centerLng, lat, lng),
  };
}

async function queryNominatimBox(
  lat: number,
  lng: number,
  radiusKm: number,
  externalSignal?: AbortSignal
): Promise<PublicStation[]> {
  const dLat = radiusKm / 111.32;
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
  const dLng = radiusKm / (111.32 * cosLat);

  const viewbox = [
    (lng - dLng).toFixed(5),
    (lat + dLat).toFixed(5),
    (lng + dLng).toFixed(5),
    (lat - dLat).toFixed(5),
  ].join(',');

  const params = new URLSearchParams({
    amenity: 'charging_station',
    format: 'jsonv2',
    viewbox,
    bounded: '1',
    limit: '50',
    addressdetails: '1',
    extratags: '1',
    'accept-language': 'he,en',
  });

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 9000);
  const onExternalAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    const raw = (await response.json()) as NominatimItem[];
    const seenCoords = new Set<string>();

    return raw
      .map((item) => mapItemToPublicStation(item, lat, lng))
      .filter((station): station is PublicStation => station !== null)
      .filter((station) => {
        const coordKey = `${station.latitude.toFixed(4)}:${station.longitude.toFixed(4)}`;
        if (seenCoords.has(coordKey)) return false;
        seenCoords.add(coordKey);
        return true;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 25);
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function fetchNearbyPublicStations(
  lat: number,
  lng: number,
  radiusMeters = 15000,
  signal?: AbortSignal
): Promise<PublicStation[]> {
  const cacheKey = `${lat.toFixed(2)}:${lng.toFixed(2)}:${radiusMeters}`;
  const cached = publicCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const initialKm = Math.min(8, Math.max(4, radiusMeters / 2000));
  let results = await queryNominatimBox(lat, lng, initialKm, signal);

  if (results.length < 8) {
    const widerKm = Math.max(20, radiusMeters / 1000);
    results = await queryNominatimBox(lat, lng, widerKm, signal);
  }

  publicCache.set(cacheKey, results);
  return results;
}