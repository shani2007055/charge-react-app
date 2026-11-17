import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, isTokenExpired, triggerSessionExpired } from '../api/apiClient';
import { useDriverGps } from '../hooks/useDriverGps';
import { useAppSelector } from '../store/hooks';
import type { DriverCoords, Station } from '../store/stations/stationsState';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

interface RecommendedAction {
  id: number;
  name: string;
}

interface VehicleDto {
  id: number;
  model: string;
  supportedChargerType?: string;
  currentBattery?: number;
}

interface ArcGisCandidate {
  address?: string;
  location?: { x: number; y: number };
}

interface ArcGisFindResponse {
  candidates?: ArcGisCandidate[];
}

interface ArcGisReverseResponse {
  address?: {
    Match_addr?: string;
    ShortLabel?: string;
    Address?: string;
    City?: string;
  };
}

interface NominatimReverseResponse {
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
  display_name?: string;
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultListItem {
  readonly length: number;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultListItem>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5096/api';

const QUICK_PROMPTS = [
  'מצא לי עמדה מהירה קרובה לרוטשילד פתח תקווה',
  'יש לי 20% סוללה ואני ממהר, מה הכי קרוב?',
  'אני יושב לפגישה של שעתיים בתל אביב, מה מומלץ?',
];

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
  return r * c;
}

function estimateReservationWindowMinutes(distanceKm: number | null): number {
  const bufferMinutes = 5;
  const travelMinutes = distanceKm !== null ? Math.max(3, Math.round(distanceKm * 1.8)) : 10;
  return Math.min(30, Math.max(10, travelMinutes + bufferMinutes));
}

function getStationBookingBlockReason(station: Station): string | null {
  if (!station.isActive) {
    return `העמדה "${station.name}" אינה פעילה כרגע.`;
  }

  if (station.isClosedBySchedule) {
    const nextOpen =
      station.nextOpenHour !== null && station.nextOpenHour !== undefined
        ? ` ותיפתח בשעה ${String(station.nextOpenHour).padStart(2, '0')}:00`
        : '';
    return `העמדה "${station.name}" סגורה כעת לפי שעות הפעילות${nextOpen}.`;
  }

  const rawStatus = (station.currentStatus ?? '').trim();
  const normalized = rawStatus.toLowerCase();
  if (
    normalized === 'faulty' ||
    normalized.includes('תקול') ||
    normalized.includes('fault') ||
    normalized.includes('broken')
  ) {
    return `בעמדה "${station.name}" דווחה תקלה כרגע.`;
  }

  if (
    normalized === 'occupied' ||
    normalized === 'busy' ||
    normalized.includes('תפוס')
  ) {
    return `העמדה "${station.name}" תפוסה כרגע.`;
  }

  if (
    normalized === 'reserved' ||
    normalized.includes('משוריינ') ||
    normalized.includes('שמור')
  ) {
    return `העמדה "${station.name}" משוריינת כבר כרגע.`;
  }

  return null;
}

async function geocodeIsraelAddress(query: string): Promise<{ coords: DriverCoords; label: string } | null> {
  // ניסיון 1: ArcGIS (מדויק לכתובות ישראליות עם מספר בית)
  try {
    const arcRes = await fetch(
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(
        query
      )}&countryCode=ISR&langCode=he&outFields=Match_addr,StAddr,City&maxLocations=1&f=json`
    );
    if (arcRes.ok) {
      const arcData = (await arcRes.json()) as ArcGisFindResponse;
      const best = arcData.candidates?.[0];
      if (best?.location && Number.isFinite(best.location.y) && Number.isFinite(best.location.x)) {
        return {
          coords: { lat: best.location.y, lng: best.location.x },
          label: best.address?.trim() || query,
        };
      }
    }
  } catch {
    // ממשיכים לגיבוי Nominatim
  }

  // ניסיון 2: Nominatim כגיבוי
  const nomRes = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&accept-language=he&limit=1&q=${encodeURIComponent(
      query
    )}`
  );
  if (!nomRes.ok) {
    throw new Error('שגיאה באיתור הכתובת');
  }
  const results = (await nomRes.json()) as NominatimSearchResult[];
  if (results.length === 0) return null;

  const lat = Number(results[0].lat);
  const lng = Number(results[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    coords: { lat, lng },
    label: results[0].display_name || query,
  };
}

async function reverseGeocodeIsrael(lat: number, lng: number): Promise<string | null> {
  try {
    const arcRes = await fetch(
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lng},${lat}&langCode=he&f=json`
    );
    if (arcRes.ok) {
      const data = (await arcRes.json()) as ArcGisReverseResponse;
      const short =
        data.address?.ShortLabel ||
        [data.address?.Address, data.address?.City].filter(Boolean).join(', ') ||
        data.address?.Match_addr;
      if (short) return short;
    }
  } catch {
    // ממשיכים לגיבוי
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimReverseResponse;
    const cityName =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.municipality ||
      '';
    const road = data.address?.road
      ? `${data.address.road}${data.address.house_number ? ` ${data.address.house_number}` : ''}`
      : '';
    const shortAddress = [road, cityName].filter(Boolean).join(', ');
    return shortAddress || data.display_name || null;
  } catch {
    return null;
  }
}

function parseAgentMessage(raw: string): { cleanText: string; stations: RecommendedAction[] } {
  const stations: RecommendedAction[] = [];
  const seenIds = new Set<number>();
  const regex = /\[\[STATION:(\d+):([^\]]+)\]\]/g;

  let match: RegExpExecArray | null = regex.exec(raw);
  while (match !== null) {
    const id = Number(match[1]);
    const name = match[2].trim();
    if (!Number.isNaN(id) && !seenIds.has(id)) {
      seenIds.add(id);
      stations.push({ id, name });
    }
    match = regex.exec(raw);
  }

  const cleanText = raw
    .replace(/\[\[STATION:\d+:[^\]]+\]\]/g, '')
    .replace(/\*\*/g, '')
    .trim();

  return { cleanText, stations };
}

export default function VoiceAgentWidget() {
  const navigate = useNavigate();
  const { role, carModel } = useAppSelector((state) => state.user);
  const { currentBatteryPercent, targetBatteryPercent, selectedVehicleId } = useAppSelector(
    (state) => state.stations
  );

  const {
    driverLocation,
    detectingGps: locatingGps,
    gpsDenied: locationDenied,
    requestLocation,
    updateLocation,
    setGpsDenied: setLocationDenied,
  } = useDriverGps();

  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    function openAssistant() {
      setIsOpen(true);
    }
    window.addEventListener('smart-ev:open-assistant', openAssistant);
    return () => {
      window.removeEventListener('smart-ev:open-assistant', openAssistant);
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      text: 'היי! אני העוזר החכם שלך לטעינה. לחצי על המיקרופון, דברי חופשי, וכשאת מוכנה לחצי שלח — ותקבלי כפתור ישיר לשריון העמדה.',
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [reservingStationId, setReservingStationId] = useState<number | null>(null);
  const [hasActiveBookingError, setHasActiveBookingError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // שיתוף ובקרת מיקום GPS לסוכן
  const [shareLocation, setShareLocation] = useState<boolean>(true);
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  const [showManualLocation, setShowManualLocation] = useState<boolean>(false);
  const [manualAddressInput, setManualAddressInput] = useState<string>('');
  const [resolvingManual, setResolvingManual] = useState<boolean>(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const ignoreVoiceRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastUserQueryRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isStreaming]);

  useEffect(() => {
    return () => {
      ignoreVoiceRef.current = true;
      recognitionRef.current?.stop();
    };
  }, []);

  // תרגום הקואורדינטות לכתובת קריאה כדי שאפשר יהיה לוודא בעין שהמיקום נכון
  useEffect(() => {
    if (!driverLocation) {
      setDetectedAddress(null);
      return;
    }

    let cancelled = false;
    const fetchReverseAddress = async () => {
      const address = await reverseGeocodeIsrael(driverLocation.lat, driverLocation.lng);
      if (!cancelled && address) {
        setDetectedAddress(address);
      }
    };

    void fetchReverseAddress();
    return () => {
      cancelled = true;
    };
  }, [driverLocation]);

  // איתור מיקום ברקע ברגע שפותחים את הצ'אט אם עוד אין מיקום שמור
  useEffect(() => {
    if (isOpen && shareLocation && !driverLocation && !locationDenied && !locatingGps) {
      void requestLocation({ silent: true });
    }
  }, [isOpen, shareLocation, driverLocation, locationDenied, locatingGps, requestLocation]);

  const resolveCurrentCoords = async (): Promise<DriverCoords | null> => {
    if (!shareLocation) return null;
    if (driverLocation) return driverLocation;
    return requestLocation({ silent: true });
  };

  const handleToggleLocationShare = () => {
    if (shareLocation) {
      setShareLocation(false);
      setShowManualLocation(false);
      return;
    }
    setShareLocation(true);
    setLocationDenied(false);
    if (!driverLocation) {
      void requestLocation({ silent: true });
    }
  };

  const stopVoiceIfActive = () => {
    ignoreVoiceRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleReserveFromAgent = async (stationId: number) => {
    setErrorMessage(null);
    setHasActiveBookingError(false);
    setReservingStationId(stationId);

    try {
      const station = await apiFetch<Station>(`/ChargingStations/${stationId}`);
      const blockReason = getStationBookingBlockReason(station);
      if (blockReason) {
        setErrorMessage(blockReason);
        return;
      }

      let vehicles = await apiFetch<VehicleDto[]>('/UsersVehicles/my');

      if (vehicles.length === 0) {
        const created = await apiFetch<VehicleDto>('/UsersVehicles', {
          method: 'POST',
          body: JSON.stringify({
            model: carModel || 'Tesla Model 3',
            batteryCapacityKwh: 75,
            currentBattery: currentBatteryPercent,
            supportedChargerType: station.chargerType || 'Type2',
          }),
        });
        vehicles = [created];
      }

      const targetCharger = station.chargerType.trim().toLowerCase();
      const compatibleVehicles = vehicles.filter(
        (v) => (v.supportedChargerType ?? '').trim().toLowerCase() === targetCharger
      );

      if (compatibleVehicles.length === 0) {
        setErrorMessage(
          `לאף אחד מהרכבים שלך אין שקע תואם (${station.chargerType}) לעמדה "${station.name}". ניתן לעדכן רכב במסך הפרופיל.`
        );
        return;
      }

      const selectedVehicle =
        compatibleVehicles.find((v) => v.id === selectedVehicleId) ?? compatibleVehicles[0];

      const distanceKm = driverLocation
        ? calculateDistanceKm(
            driverLocation.lat,
            driverLocation.lng,
            station.latitude,
            station.longitude
          )
        : null;
      const holdMinutes = estimateReservationWindowMinutes(distanceKm);

      const safeCurrentBattery = Math.max(0, Math.min(Math.round(currentBatteryPercent), 95));
      const safeTargetBattery = Math.min(
        100,
        Math.max(Math.round(targetBatteryPercent), safeCurrentBattery + 1)
      );
      const arrivalTimeUtc = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();

      await apiFetch('/ChargeBooking', {
        method: 'POST',
        body: JSON.stringify({
          stationId: station.id,
          vehicleId: selectedVehicle.id,
          currentBatteryPercent: safeCurrentBattery,
          targetBatteryPercent: safeTargetBattery,
          estimatedArrivalTime: arrivalTimeUtc,
        }),
      });

      setIsOpen(false);
      navigate('/active');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה בשריון העמדה';
      if (msg.includes('הזמנה פעילה')) {
        setHasActiveBookingError(true);
      }
      setErrorMessage(
        msg.includes('403')
          ? 'שריון עמדה זמין רק במצב נהג (Driver).'
          : msg
      );
    } finally {
      setReservingStationId(null);
    }
  };

  const handleOpenStationDetails = (stationId: number) => {
    setIsOpen(false);
    navigate(`/stations/${stationId}`);
  };

  const sendMessageToAgent = async (
    rawText: string,
    overrideLocation?: { coords: DriverCoords; address?: string }
  ) => {
    const trimmed = rawText.trim();
    if (!trimmed || isStreaming) return;

    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
      triggerSessionExpired();
      return;
    }

    if (!overrideLocation) {
      lastUserQueryRef.current = trimmed;
    }

    stopVoiceIfActive();
    setErrorMessage(null);
    setHasActiveBookingError(false);
    setInputText('');

    const userMsg: ChatMessage = { role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg, { role: 'ai', text: '' }]);
    setIsStreaming(true);

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 90000);

    try {
      const coords = overrideLocation ? overrideLocation.coords : await resolveCurrentCoords();
      const addressLabel = overrideLocation ? overrideLocation.address : detectedAddress;
      const isRecheck = Boolean(overrideLocation);

      const promptWithLocationContext = coords
        ? `${trimmed}\n[נתוני מערכת: מיקום הנהג ${
            isRecheck ? 'עודכן כעת ל-' : 'הנוכחי הוא '
          }latitude=${coords.lat.toFixed(6)}, longitude=${coords.lng.toFixed(6)}${
            addressLabel ? ` (${addressLabel})` : ''
          }. ${
            isRecheck
              ? 'הנהג עדכן את מיקומו — התעלם מהמרחקים הקודמים והפעל מיד את FindBestStationsAsync עם הקואורדינטות החדשות האלו!'
              : 'אם לא צוינה כתובת אחרת בהודעה, השתמש מיד בקואורדינטות אלו ב-FindBestStationsAsync'
          } (אם הנהג מבקש "הכי קרוב" או ממהר, תן משקל weightDistance=0.85 וציין chargerType לפי הצורך).]`
        : trimmed;

      const historyForServer: ChatMessage[] = [
        ...messages.slice(1),
        { role: 'user' as const, text: promptWithLocationContext },
      ].map((m) => ({
        role: m.role,
        text: m.text.slice(0, 2000),
      }));

      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: historyForServer }),
        signal: abortController.signal,
      });

      if (response.status === 401) {
        triggerSessionExpired();
        return;
      }

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => '');
        let parsedMsg = errText;
        try {
          const jsonErr = JSON.parse(errText) as { detail?: string; title?: string; message?: string };
          parsedMsg = jsonErr.detail || jsonErr.title || jsonErr.message || errText;
        } catch {
          // נשאר טקסט רגיל
        }

        if (
          response.status === 429 ||
          response.status >= 500 ||
          parsedMsg.includes('An unexpected error occurred')
        ) {
          throw new Error(
            'שירות העוזר החכם אינו זמין כרגע (ייתכן שמכסת הבקשות היומית בשרת הסתיימה). אפשר להמשיך לחפש ולשריין עמדה דרך "חיפוש עמדות" או המפה.'
          );
        }
        throw new Error(parsedMsg || `שגיאת שרת (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let receivedAnyText = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          const lines = rawEvent.split(/\r?\n/);
          let eventType = 'message';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              if (!dataStr || dataStr === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(dataStr) as {
                  text?: string;
                  title?: string;
                  detail?: string;
                  message?: string;
                };
                if (eventType === 'error') {
                  throw new Error(
                    parsed.detail || parsed.message || parsed.title || 'התשובה נקטעה באמצע, נסי שוב.'
                  );
                }
                if (parsed.text) {
                  receivedAnyText = true;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIndex = updated.length - 1;
                    if (lastIndex >= 0 && updated[lastIndex].role === 'ai') {
                      updated[lastIndex] = {
                        ...updated[lastIndex],
                        text: updated[lastIndex].text + parsed.text,
                      };
                    }
                    return updated;
                  });
                }
              } catch (parseErr) {
                if (parseErr instanceof Error && eventType === 'error') {
                  throw parseErr;
                }
              }
            }
          }
        }
      }

      if (!receivedAnyText) {
        throw new Error('השרת לא החזיר תשובה. בדקי את הקונסול ב-Visual Studio.');
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'הסוכן התעכב יותר מדי (Timeout). בדקי את הקונסול של השרת.'
          : err instanceof Error
            ? err.message
            : 'שגיאה בחיבור לסוכן החכם';
      setErrorMessage(msg);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'ai' && !last.text) {
          updated.pop();
        }
        return updated;
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsStreaming(false);
    }
  };

  const handleSaveManualAddress = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = manualAddressInput.trim();
    if (!trimmed || resolvingManual) return;

    setResolvingManual(true);
    setErrorMessage(null);

    try {
      const resolved = await geocodeIsraelAddress(trimmed);
      if (!resolved) {
        setErrorMessage(`לא מצאנו את הכתובת "${trimmed}". נסי לכלול רחוב, מספר בית ועיר.`);
        return;
      }

      updateLocation(resolved.coords);
      setShareLocation(true);
      setDetectedAddress(resolved.label);
      setManualAddressInput('');
      setShowManualLocation(false);

      if (lastUserQueryRef.current && !isStreaming) {
        void sendMessageToAgent(
          `עדכנתי מיקום ל־"${resolved.label}", בדוק לי מחדש: ${lastUserQueryRef.current}`,
          { coords: resolved.coords, address: resolved.label }
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'שגיאה בעדכון המיקום');
    } finally {
      setResolvingManual(false);
    }
  };

  const handleRefreshGpsClick = async () => {
    const coords = await requestLocation({ silent: true });
    if (!coords || isStreaming) return;
    if (lastUserQueryRef.current) {
      void sendMessageToAgent(
        `ריעננתי מיקום GPS, בדוק לי מחדש: ${lastUserQueryRef.current}`,
        { coords }
      );
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessageToAgent(inputText);
  };

  const handleToggleVoice = () => {
    setErrorMessage(null);
    setIsOpen(true);

    if (isListening) {
      stopVoiceIfActive();
      return;
    }

    const w = window as WindowWithSpeech;
    const SpeechRec = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SpeechRec) {
      setErrorMessage('זיהוי דיבור נתמך בדפדפני Chrome / Edge. אפשר גם להקליד רגיל.');
      return;
    }

    ignoreVoiceRef.current = false;
    const recognition = new SpeechRec();
    recognition.lang = 'he-IL';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      if (ignoreVoiceRef.current) return;
      let transcriptAll = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const chunk = event.results[i]?.[0]?.transcript;
        if (chunk) {
          transcriptAll += `${chunk} `;
        }
      }
      setInputText(transcriptAll.trim());
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setErrorMessage('לא אושרה גישה למיקרופון בדפדפן.');
      } else if (event.error !== 'aborted') {
        setErrorMessage('לא הצלחתי לשמוע ברור, נסי שוב.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const locationStatusLabel = !shareLocation
    ? 'שיתוף מיקום כבוי'
    : locatingGps
      ? 'מאתר מיקום מדויק...'
      : driverLocation
        ? detectedAddress
          ? `מיקום: ${detectedAddress}`
          : `מיקום: ${driverLocation.lat.toFixed(4)}, ${driverLocation.lng.toFixed(4)}`
        : locationDenied
          ? 'אין הרשאת GPS — הזיני כתובת'
          : 'מוכן לאיתור מיקום';

  return (
    <div
      dir="rtl"
      className="ev-voice-widget"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      {/* אנימציות מובנות לחוויית חשיבה חלקה */}
      <style>{`
        @keyframes evAgentDotBounce {
          0%, 80%, 100% { transform: translateY(0) scale(0.85); opacity: 0.45; }
          40% { transform: translateY(-5px) scale(1.1); opacity: 1; }
        }
        @keyframes evAgentPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>

      {isOpen && (
        <div
          className="ev-voice-panel"
          style={{
            width: '385px',
            maxWidth: 'calc(100vw - 32px)',
            height: 'min(530px, calc(100dvh - 120px))',
            background: 'rgba(255, 255, 255, 0.98)',
            border: '1px solid var(--ev-border)',
            borderRadius: '18px',
            boxShadow: '0 22px 50px rgba(15, 23, 42, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: 'var(--ev-text)',
          }}
        >
          {/* כותרת חלונית הצ'אט */}
          <div
            style={{
              padding: '13px 16px',
              background: '#0F172A',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: '#EA580C',
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  animation: isStreaming ? 'evAgentPulse 1.1s infinite ease-in-out' : 'none',
                }}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                  העוזר החכם לטעינה
                </div>
                <div style={{ fontSize: '0.73rem', color: isStreaming ? '#FDBA74' : '#94A3B8', marginTop: '2px' }}>
                  {isStreaming
                    ? 'מחפש עמדות מתאימות בזמן אמת...'
                    : 'התאמת עמדות ושריון מהיר בקול או בהקלדה'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              title="סגור חלונית"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '8px',
                color: '#E2E8F0',
                width: '30px',
                height: '30px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              ✕
            </button>
          </div>

          {/* פס בקרת מיקום GPS + תיקון ידני לסוכן */}
          <div
            style={{
              padding: '8px 14px',
              background: '#FFFFFF',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
              fontSize: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#334155',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={
                  driverLocation
                    ? `${driverLocation.lat.toFixed(5)}, ${driverLocation.lng.toFixed(5)}`
                    : undefined
                }
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: !shareLocation
                      ? '#94A3B8'
                      : driverLocation
                        ? '#16A34A'
                        : locationDenied
                          ? '#DC2626'
                          : '#EA580C',
                    display: 'inline-block',
                  }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {locationStatusLabel}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                {shareLocation && (
                  <button
                    type="button"
                    onClick={() => setShowManualLocation((prev) => !prev)}
                    style={{
                      background: '#FFF7ED',
                      border: '1px solid #FED7AA',
                      color: '#C2410C',
                      borderRadius: '7px',
                      padding: '3px 7px',
                      fontSize: '0.71rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {showManualLocation ? 'סגור' : 'תקן כתובת'}
                  </button>
                )}

                {shareLocation && !locatingGps && (
                  <button
                    type="button"
                    onClick={() => void handleRefreshGpsClick()}
                    title="רענן זיהוי מיקום מהדפדפן ובדוק שוב"
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      color: '#334155',
                      borderRadius: '7px',
                      padding: '3px 7px',
                      fontSize: '0.71rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    רענן GPS
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleLocationShare}
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    borderRadius: '7px',
                    padding: '3px 7px',
                    fontSize: '0.71rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {shareLocation ? 'כבה' : 'הפעל'}
                </button>
              </div>
            </div>

            {showManualLocation && (
              <form
                onSubmit={(e) => void handleSaveManualAddress(e)}
                style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
              >
                <input
                  type="text"
                  value={manualAddressInput}
                  onChange={(e) => setManualAddressInput(e.target.value)}
                  placeholder="הקלידי רחוב, מספר בית ועיר (למשל רוטשילד 50 פתח תקווה)"
                  style={{
                    flex: 1,
                    padding: '6px 9px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    color: '#0F172A',
                    fontSize: '0.78rem',
                  }}
                />
                <button
                  type="submit"
                  disabled={resolvingManual || !manualAddressInput.trim()}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: resolvingManual ? 'wait' : 'pointer',
                  }}
                >
                  {resolvingManual ? 'מאתר...' : 'עדכן'}
                </button>
              </form>
            )}
          </div>

          {/* אזור ההודעות */}
          <div
            style={{
              flex: 1,
              padding: '14px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: '#F3F6FA',
            }}
          >
            {messages.map((msg, idx) => {
              if (msg.role === 'user') {
                return (
                  <div
                    key={idx}
                    style={{
                      alignSelf: 'flex-start',
                      maxWidth: '84%',
                      padding: '10px 13px',
                      borderRadius: '14px 14px 14px 4px',
                      fontSize: '0.88rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      textAlign: 'right',
                      background: '#0F172A',
                      color: '#FFFFFF',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
                    }}
                  >
                    {msg.text}
                  </div>
                );
              }

              const { cleanText, stations } = parseAgentMessage(msg.text);
              const isThinkingNow = isStreaming && idx === messages.length - 1 && !cleanText;

              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: 'flex-end',
                    maxWidth: '88%',
                    padding: '11px 13px',
                    borderRadius: '14px 14px 4px 14px',
                    fontSize: '0.88rem',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    textAlign: 'right',
                    background: '#FFFFFF',
                    border: isThinkingNow ? '1px solid #FED7AA' : '1px solid #E2E8F0',
                    color: '#0F172A',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
                  }}
                >
                  {isThinkingNow ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '2px 0',
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: '#EA580C',
                            display: 'inline-block',
                            animation: 'evAgentDotBounce 1.15s infinite ease-in-out',
                            animationDelay: '0s',
                          }}
                        />
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: '#EA580C',
                            display: 'inline-block',
                            animation: 'evAgentDotBounce 1.15s infinite ease-in-out',
                            animationDelay: '0.18s',
                          }}
                        />
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: '#EA580C',
                            display: 'inline-block',
                            animation: 'evAgentDotBounce 1.15s infinite ease-in-out',
                            animationDelay: '0.36s',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 500 }}>
                        מנתח בקשה ובודק עמדות זמינות...
                      </span>
                    </div>
                  ) : (
                    <div>{cleanText}</div>
                  )}

                  {stations.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '7px',
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid #F1F5F9',
                      }}
                    >
                      {stations.map((st) => (
                        <div key={st.id} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {role === 'Driver' && (
                            <button
                              type="button"
                              disabled={reservingStationId === st.id}
                              onClick={() => void handleReserveFromAgent(st.id)}
                              className="ev-btn ev-btn-accent"
                              style={{
                                flex: 1,
                                width: 'auto',
                                padding: '8px 10px',
                                fontSize: '0.8rem',
                              }}
                            >
                              {reservingStationId === st.id
                                ? 'משריין...'
                                : `שריין את "${st.name}"`}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenStationDetails(st.id)}
                            className="ev-btn ev-btn-secondary"
                            style={{
                              width: 'auto',
                              padding: '8px 11px',
                              fontSize: '0.78rem',
                            }}
                          >
                            לפרטי עמדה
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* הצעות מהירות לפתיחת שיחה */}
          {messages.length <= 1 && (
            <div
              style={{
                padding: '10px 12px',
                background: '#F3F6FA',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => void sendMessageToAgent(prompt)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    color: '#334155',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    padding: '6px 10px',
                    borderRadius: '10px',
                    cursor: isStreaming ? 'not-allowed' : 'pointer',
                    textAlign: 'right',
                    lineHeight: 1.35,
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* שגיאות והתראת הזמנה פעילה */}
          {errorMessage && (
            <div
              style={{
                background: '#FEF2F2',
                borderTop: '1px solid #FECACA',
                color: '#B91C1C',
                fontSize: '0.8rem',
                padding: '9px 12px',
                textAlign: 'center',
              }}
            >
              <div>{errorMessage}</div>
              {hasActiveBookingError && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/active');
                  }}
                  className="ev-btn ev-btn-primary"
                  style={{
                    width: 'auto',
                    marginTop: '7px',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                  }}
                >
                  עבור להזמנה הפעילה שלי ➔
                </button>
              )}
            </div>
          )}

          {/* שורת קלט והקלטה */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '10px 12px',
              background: '#FFFFFF',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              gap: '7px',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={handleToggleVoice}
              disabled={isStreaming}
              title={isListening ? 'עצור הקלטה' : 'הקלט בקול בעברית'}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                border: isListening ? '1px solid #DC2626' : '1px solid #FED7AA',
                background: isListening ? '#DC2626' : '#FFF7ED',
                color: isListening ? '#FFFFFF' : '#EA580C',
                cursor: isStreaming ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isListening ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? 'מדברת... המילים יופיעו כאן' : 'שאלי על עמדה קרובה...'}
              disabled={isStreaming}
              style={{
                flex: 1,
                padding: '9px 11px',
                borderRadius: '10px',
                border: isListening ? '1.5px solid #DC2626' : '1px solid #CBD5E1',
                background: '#F8FAFC',
                color: '#0F172A',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            />

            <button
              type="submit"
              disabled={isStreaming || !inputText.trim()}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: 'none',
                background: isStreaming || !inputText.trim() ? '#CBD5E1' : '#0F172A',
                color: '#FFFFFF',
                fontWeight: 700,
                cursor: isStreaming || !inputText.trim() ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                flexShrink: 0,
              }}
            >
              {isStreaming ? 'חושב...' : 'שלח'}
            </button>
          </form>
        </div>
      )}

      {/* כפתור צף לפתיחת העוזר החכם */}
      <div className="ev-voice-launchers" style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid #1E293B',
            background: '#0F172A',
            color: '#FFFFFF',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 22px rgba(15, 23, 42, 0.22)',
            fontSize: '0.88rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#EA580C"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: isStreaming ? 'evAgentPulse 1.1s infinite ease-in-out' : 'none' }}
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span>{isOpen ? 'סגור עוזר' : 'עוזר חכם'}</span>
        </button>
      </div>
    </div>
  );
}