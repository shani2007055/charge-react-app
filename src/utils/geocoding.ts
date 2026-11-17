// שירות חיפוש ואימות כתובות בישראל מבוסס ArcGIS World Geocoding (מדויק ברמת רחוב ומספר בית, ללא מפתח API)
// קובץ משותף: כל מסך שצריך השלמה או אימות כתובת משתמש בו.

export interface AddressSuggestion {
  id: number;
  label: string;
  lat: number;
  lng: number;
  hasHouseNumber?: boolean;
}

export interface AutocompleteOption {
  id: string;
  label: string;
  magicKey: string;
  hasHouseNumber: boolean;
}

interface ArcGisSuggestResponse {
  suggestions?: Array<{
    text: string;
    magicKey: string;
    isCollection?: boolean;
  }>;
}

interface ArcGisCandidateAttributes {
  Addr_type?: string;
  StName?: string;
  AddNum?: string;
  City?: string;
  Match_addr?: string;
}

interface ArcGisCandidate {
  address: string;
  score: number;
  location: { x: number; y: number };
  attributes?: ArcGisCandidateAttributes;
}

interface ArcGisFindResponse {
  candidates?: ArcGisCandidate[];
}

interface ArcGisReverseResponse {
  address?: {
    Match_addr?: string;
    ShortLabel?: string;
    Address?: string;
    Addr_type?: string;
    AddNum?: string;
    City?: string;
  };
}

const ARCGIS_BASE =
  'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';

// סוגי התוצאות של ArcGIS שמייצגים כתובת מדויקת עם מספר בית (ולא עיר/שכונה/רחוב כללי)
const EXACT_ADDR_TYPES = new Set([
  'PointAddress',
  'StreetAddress',
  'StreetAddressExt',
  'Subaddress',
]);

function hasExactHouseCandidate(attrs?: ArcGisCandidateAttributes): boolean {
  if (!attrs?.Addr_type || !EXACT_ADDR_TYPES.has(attrs.Addr_type)) {
    return false;
  }
  return Boolean(attrs.StName?.trim() && attrs.AddNum?.trim() && attrs.City?.trim());
}

/**
 * השלמה אוטומטית (Autocomplete) מהירה מ-ArcGIS.
 * exactOnly = true מסנן לכתובות בלבד (category=Address) ומונע הצעת ערים כמו "צפת".
 */
export async function suggestAddresses(
  query: string,
  signal?: AbortSignal,
  exactOnly = false,
  maxResults = 8
): Promise<AutocompleteOption[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    text: trimmed,
    countryCode: 'ISR',
    maxSuggestions: String(maxResults),
    f: 'json',
  });
  if (exactOnly) {
    params.set('category', 'Address');
  }

  const res = await fetch(`${ARCGIS_BASE}/suggest?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error('שגיאה בחיפוש הצעות כתובת');
  }

  const data = (await res.json()) as ArcGisSuggestResponse;
  const seen = new Set<string>();
  const options: AutocompleteOption[] = [];

  for (const item of data.suggestions ?? []) {
    if (item.isCollection) continue;
    const label = item.text.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);

    const streetPart = label.split(',')[0] ?? label;
    options.push({
      id: `${item.magicKey}-${options.length}`,
      label,
      magicKey: item.magicKey,
      hasHouseNumber: /\d/.test(streetPart),
    });
  }

  return options;
}

/**
 * מתרגם הצעה שנבחרה מהרשימה (עם magicKey) לקואורדינטות מדויקות ולבדיקת מספר בית.
 */
export async function resolveSuggestedAddress(
  option: AutocompleteOption
): Promise<AddressSuggestion> {
  const params = new URLSearchParams({
    SingleLine: option.label,
    magicKey: option.magicKey,
    countryCode: 'ISR',
    langCode: 'HE',
    outFields: 'Addr_type,StName,AddNum,City,Match_addr',
    maxLocations: '1',
    f: 'json',
  });

  const res = await fetch(`${ARCGIS_BASE}/findAddressCandidates?${params.toString()}`);
  if (!res.ok) {
    throw new Error('שגיאה באימות הכתובת שנבחרה');
  }

  const data = (await res.json()) as ArcGisFindResponse;
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error(`לא הצלחנו לאתר קואורדינטות עבור "${option.label}".`);
  }

  const attrs = candidate.attributes;
  const label = attrs?.Match_addr?.trim() || candidate.address || option.label;
  const hasHouseNumber = hasExactHouseCandidate(attrs);

  return {
    id: Math.floor(Math.random() * 1_000_000_000),
    label,
    lat: candidate.location.y,
    lng: candidate.location.x,
    hasHouseNumber,
  };
}

/**
 * חיפוש כתובות כללי בישראל עם קואורדינטות (עבור חיפוש נהג / יעד — מאפשר גם ערים).
 */
export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
  maxResults = 5
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    SingleLine: trimmed,
    countryCode: 'ISR',
    langCode: 'HE',
    outFields: 'Match_addr',
    maxLocations: String(maxResults),
    f: 'json',
  });

  const res = await fetch(`${ARCGIS_BASE}/findAddressCandidates?${params.toString()}`, {
    signal,
  });
  if (!res.ok) {
    throw new Error('שגיאה בחיפוש הכתובת');
  }

  const data = (await res.json()) as ArcGisFindResponse;
  const seen = new Set<string>();
  const results: AddressSuggestion[] = [];

  for (const c of data.candidates ?? []) {
    const label = (c.attributes?.Match_addr || c.address || '').trim();
    const lat = c.location?.y;
    const lng = c.location?.x;
    if (!label || seen.has(label) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    seen.add(label);
    results.push({
      id: results.length + 1,
      label,
      lat,
      lng,
    });
  }

  return results;
}

/**
 * אימות כתובת מדויקת לעמדת טעינה (כאשר המשתמשת הקלידה ידנית ולא לחצה על הצעה):
 * דורש רחוב + מספר בית + עיר תקינים מ-ArcGIS. חוסם ערים בלבד ("צפת") ורחוב בלי מספר.
 */
export async function resolveExactAddress(
  rawAddress: string
): Promise<{ lat: number; lng: number; normalizedAddress: string }> {
  const query = rawAddress.trim();
  if (!query) {
    throw new Error('יש להזין כתובת מדויקת הכוללת רחוב, מספר בית ועיר.');
  }

  const params = new URLSearchParams({
    SingleLine: query,
    countryCode: 'ISR',
    langCode: 'HE',
    outFields: 'Addr_type,StName,AddNum,City,Match_addr',
    maxLocations: '5',
    f: 'json',
  });

  const res = await fetch(`${ARCGIS_BASE}/findAddressCandidates?${params.toString()}`);
  if (!res.ok) {
    throw new Error('שגיאה באיתור הכתובת');
  }

  const data = (await res.json()) as ArcGisFindResponse;
  const candidates = data.candidates ?? [];

  if (candidates.length === 0) {
    throw new Error(
      `לא הצלחנו לאתר כתובת חד-משמעית עבור "${rawAddress}". יש לציין רחוב, מספר בית ועיר (למשל: טרומפלדור 12, תל אביב) או לבחור מרשימת ההצעות.`
    );
  }

  const exact = candidates.find(
    (c) => c.score >= 70 && hasExactHouseCandidate(c.attributes)
  );

  if (exact) {
    const lat = exact.location?.y;
    const lng = exact.location?.x;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error(`לא הצלחנו לאתר קואורדינטות תקינות עבור "${rawAddress}".`);
    }
    return {
      lat,
      lng,
      normalizedAddress: exact.attributes?.Match_addr?.trim() || exact.address,
    };
  }

  const topAttrs = candidates[0].attributes;
  if (topAttrs?.Addr_type === 'StreetName' && topAttrs.StName?.trim()) {
    const cityExample = topAttrs.City?.trim() || 'ירושלים';
    throw new Error(
      `הכתובת "${rawAddress}" חסרה מספר בית — יש להזין רחוב, מספר בית ועיר (למשל: ${topAttrs.StName} 10, ${cityExample}).`
    );
  }

  throw new Error(
    `לא ניתן לשמור שם עיר או אזור בלבד ("${rawAddress}"). יש להזין כתובת מדויקת הכוללת רחוב, מספר בית ועיר (למשל: הרב גולדקנופף 3, ירושלים).`
  );
}

/**
 * המרת קואורדינטות GPS לכתובת רחוב מדויקת עבור בעל תחנה.
 */
export async function reverseGeocodeExactAddress(
  lat: number,
  lng: number
): Promise<{ address: string; hasHouseNumber: boolean }> {
  const params = new URLSearchParams({
    location: `${lng},${lat}`,
    langCode: 'HE',
    f: 'json',
  });

  const res = await fetch(`${ARCGIS_BASE}/reverseGeocode?${params.toString()}`);
  if (!res.ok) {
    throw new Error('לא הצלחנו לאמת כתובת רחוב מהמיקום. יש להזין רחוב, מספר בית ועיר ידנית.');
  }

  const data = (await res.json()) as ArcGisReverseResponse;
  const addr = data.address;
  const addrType = addr?.Addr_type || '';
  const city = (addr?.City || '').trim();
  const streetOrAddr = (addr?.Address || addr?.ShortLabel || '').trim();
  const addNum = (addr?.AddNum || '').trim();

  if (!city || !streetOrAddr || addrType === 'Locality' || addrType === 'POI') {
    throw new Error(
      `מיקום ה-GPS זוהה${city ? ` באזור ${city}` : ''}, אך לא אותר רחוב מדויק. יש להזין רחוב, מספר בית ועיר ידנית.`
    );
  }

  const cleanAddress = addr?.Match_addr?.trim() || `${streetOrAddr}, ${city}`;
  return {
    address: cleanAddress,
    hasHouseNumber: Boolean(addNum),
  };
}