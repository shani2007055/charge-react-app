// חיפוש כתובות דרך Nominatim (OpenStreetMap) – כתובת טקסט → קואורדינטות
// קובץ משותף: כל מסך שצריך השלמת כתובת משתמש בו, במקום להעתיק את הלוגיקה.

export interface AddressSuggestion {
  id: number;
  label: string;   // כתובת מקוצרת וקריאה, למשל "הרצל 10, רמלה"
  lat: number;
  lng: number;
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

interface NominatimResult {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

/** בונה כתובת קצרה: שם מקום, רחוב ומספר, עיר */
export function formatCleanAddress(item: NominatimResult): string {
  const addr = item.address;
  const street = addr?.road
    ? `${addr.road}${addr.house_number ? ` ${addr.house_number}` : ''}`
    : '';
  const city = addr?.city || addr?.town || addr?.village || addr?.municipality || '';
  const placeName =
    item.name && item.name !== addr?.road && item.name !== city ? item.name : '';

  const parts = [placeName, street, city].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(', ');
  }

  return item.display_name
    .split(',')
    .slice(0, 2)
    .map((p) => p.trim())
    .join(', ');
}

/**
 * מחפש כתובות בישראל ומחזיר עד maxResults הצעות ייחודיות.
 * signal – מאפשר לבטל בקשה ישנה כשהמשתמש ממשיך להקליד.
 */
export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
  maxResults = 5
): Promise<AddressSuggestion[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=il&accept-language=he&limit=8&q=${encodeURIComponent(query)}`,
    { signal }
  );
  if (!res.ok) {
    throw new Error('שגיאה בחיפוש הכתובת');
  }

  const data = (await res.json()) as NominatimResult[];
  const seen = new Set<string>();
  const cleaned: AddressSuggestion[] = [];

  for (const item of data) {
    const label = formatCleanAddress(item);
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    if (!seen.has(label) && Number.isFinite(lat) && Number.isFinite(lng)) {
      seen.add(label);
      cleaned.push({ id: item.place_id, label, lat, lng });
    }
    if (cleaned.length >= maxResults) break;
  }

  return cleaned;
}