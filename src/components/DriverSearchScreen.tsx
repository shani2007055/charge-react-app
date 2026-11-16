import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchStations, recommendStations } from '../store/stations/stationsThunks';
import {
  setDriverLocation,
  setSearchBattery,
  setSelectedVehicle,
} from '../store/stations/stationsSlice';
import PageHeader from './ui/PageHeader';
import { MapPin, ListFilter } from 'lucide-react';
import VehicleSelector from './ui/VehicleSelector';
import type { Vehicle } from '../types/Vehicle';

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

interface CleanSuggestion {
  id: number;
  label: string;
  lat: number;
  lng: number;
}

function formatCleanAddress(item: NominatimResult): string {
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

function getBatteryIndicator(val: number): {
  estimatedRange: string;
  statusText: string;
  color: string;
} {
  const safeVal = Number.isFinite(val) ? Math.min(100, Math.max(0, val)) : 0;
  const estimatedRange = `כ-${Math.round(safeVal * 3)} ק"מ`;

  if (safeVal <= 15) {
    return {
      estimatedRange,
      statusText: `מצב חירום — סוללה קריטית (${safeVal}%)`,
      color: 'var(--ev-danger)',
    };
  }
  if (safeVal <= 50) {
    return {
      estimatedRange,
      statusText: `סוללה במצב בינוני (${safeVal}%)`,
      color: 'var(--ev-warning)',
    };
  }
  return {
    estimatedRange,
    statusText: `סוללה תקינה (${safeVal}%)`,
    color: 'var(--ev-brand)',
  };
}

export default function DriverSearchScreen() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const {
    loading,
    selectedVehicleId,
    currentBatteryPercent,
    targetBatteryPercent,
  } = useAppSelector((state) => state.stations);

  const initialIndicator = getBatteryIndicator(currentBatteryPercent);

  const [batteryLevel, setBatteryLevel] = useState<number>(currentBatteryPercent);
  const [targetBattery, setTargetBattery] = useState<number>(targetBatteryPercent);
  const [estimatedRange, setEstimatedRange] = useState<string>(initialIndicator.estimatedRange);
  const [batteryStatusText, setBatteryStatusText] = useState<string>(initialIndicator.statusText);
  const [batteryColor, setBatteryColor] = useState<string>(initialIndicator.color);

  const [locationText, setLocationText] = useState<string>('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<CleanSuggestion[]>([]);
  const [hoveredSuggestionId, setHoveredSuggestionId] = useState<number | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [searchingLocation, setSearchingLocation] = useState<boolean>(false);

  const [availableTimeMinutes, setAvailableTimeMinutes] = useState<number>(60);
  const [chargerType, setChargerType] = useState<string>('');
  const [priority, setPriority] = useState<string>('balanced');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // מונע פתיחה חוזרת של רשימת ההצעות מיד אחרי בחירה או זיהוי GPS
  const skipNextAutocompleteRef = useRef<boolean>(false);

  const [selectedVehicle, setVehicle] = useState<Vehicle | null>(null);
  const isBusy = loading || searchingLocation;

  // חישוב אומדן טעינה ועלות מראש (צד לקוח בלבד)
  const neededPercent = Math.max(0, targetBattery - batteryLevel);
  const estimatedKwhNeeded =
    (neededPercent / 100) * (selectedVehicle?.batteryCapacityKwh ?? 60);
  const estimatedCostNis = estimatedKwhNeeded * 1.58;
  const estimatedMinutesFast =
    neededPercent === 0 ? 0 : Math.max(5, Math.round((estimatedKwhNeeded / 90) * 60));

  useEffect(() => {
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }

    const query = locationText.trim();
    if (query.length < 3 || gpsCoords !== null) {
      setSuggestions([]);
      setHoveredSuggestionId(null);
      return;
    }

    const controller = new AbortController();
    const timerId = window.setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=il&accept-language=he&limit=8&q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = (await res.json()) as NominatimResult[];
          const seen = new Set<string>();
          const cleaned: CleanSuggestion[] = [];

          for (const item of data) {
            const label = formatCleanAddress(item);
            if (!seen.has(label)) {
              seen.add(label);
              cleaned.push({
                id: item.place_id,
                label,
                lat: Number(item.lat),
                lng: Number(item.lon),
              });
            }
            if (cleaned.length >= 5) break;
          }

          setSuggestions(cleaned);
          setHoveredSuggestionId(null);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setSuggestions([]);
        setHoveredSuggestionId(null);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [locationText, gpsCoords]);

  const handleSelectSuggestion = (item: CleanSuggestion) => {
    skipNextAutocompleteRef.current = true;
    setLocationText(item.label);
    setGpsCoords({ lat: item.lat, lng: item.lng });
    setSuggestions([]);
    setHoveredSuggestionId(null);
    setErrorMessage('');
  };

  const applyBatteryUpdate = useCallback(
    (val: number, overrideTarget?: number) => {
      const meta = getBatteryIndicator(val);
      setBatteryLevel(val);
      setEstimatedRange(meta.estimatedRange);
      setBatteryStatusText(meta.statusText);
      setBatteryColor(meta.color);

      const nextTarget = overrideTarget ?? targetBattery;
      if (overrideTarget !== undefined) {
        setTargetBattery(overrideTarget);
      }
      if (Number.isFinite(val) && Number.isFinite(nextTarget)) {
        dispatch(
          setSearchBattery({
            currentBatteryPercent: val,
            targetBatteryPercent: nextTarget,
          })
        );
      }
    },
    [dispatch, targetBattery]
  );

  const handleBatteryChange = (e: ChangeEvent<HTMLInputElement>) => {
    applyBatteryUpdate(Number(e.target.value));
  };

  const handleTargetBatteryChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextTarget = Number(e.target.value);
    setTargetBattery(nextTarget);
    if (Number.isFinite(nextTarget) && Number.isFinite(batteryLevel)) {
      dispatch(
        setSearchBattery({
          currentBatteryPercent: batteryLevel,
          targetBatteryPercent: nextTarget,
        })
      );
    }
  };

  function handleVehicleSelect(vehicle: Vehicle | null) {
    setVehicle(vehicle);
    dispatch(setSelectedVehicle(vehicle?.id ?? null));

    if (vehicle) {
      const nextTarget = Math.min(100, Math.max(80, vehicle.currentBattery + 10));
      applyBatteryUpdate(vehicle.currentBattery, nextTarget);
      setChargerType(vehicle.supportedChargerType);
      setErrorMessage('');
    } else {
      setChargerType('');
    }
  }

  const handleVehiclesLoaded = useCallback(
    (loadedVehicles: Vehicle[]) => {
      if (loadedVehicles.length === 0) {
        setVehicle(null);
        if (selectedVehicleId !== null) {
          dispatch(setSelectedVehicle(null));
        }
        return;
      }

      const matched =
        selectedVehicleId !== null
          ? loadedVehicles.find((v) => v.id === selectedVehicleId) ?? null
          : null;

      if (matched) {
        setVehicle(matched);
        setChargerType((prev) => prev || matched.supportedChargerType);
        return;
      }

      const fallbackVehicle = loadedVehicles[0];
      const nextTarget = Math.min(100, Math.max(80, fallbackVehicle.currentBattery + 10));
      setVehicle(fallbackVehicle);
      dispatch(setSelectedVehicle(fallbackVehicle.id));
      applyBatteryUpdate(fallbackVehicle.currentBattery, nextTarget);
      setChargerType(fallbackVehicle.supportedChargerType);
    },
    [applyBatteryUpdate, dispatch, selectedVehicleId]
  );

  function handleDetectLocation() {
    setErrorMessage('');
    setSuggestions([]);
    setHoveredSuggestionId(null);
    if (!navigator.geolocation) {
      setErrorMessage('הדפדפן שלך אינו תומך בזיהוי מיקום.');
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        skipNextAutocompleteRef.current = true;
        setGpsCoords({ lat, lng });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he`
          );
          if (res.ok) {
            const data = (await res.json()) as {
              display_name?: string;
              address?: NominatimAddress;
            };
            const cityName =
              data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              data.address?.municipality ||
              '';
            const road = data.address?.road
              ? `${data.address.road}${data.address.house_number ? ' ' + data.address.house_number : ''}`
              : '';
            const shortAddress = [road, cityName].filter(Boolean).join(', ');
            setLocationText(shortAddress || data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          } else {
            setLocationText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch {
          setLocationText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        setErrorMessage('לא הצלחנו לזהות את המיקום. ודאי שאישרת גישה למיקום בדפדפן, או הקלידי עיר/כתובת.');
        setDetectingLocation(false);
      }
    );
  }

  async function resolveCoordinates(): Promise<{ lat: number; lng: number }> {
    if (gpsCoords) {
      return gpsCoords;
    }

    const trimmed = locationText.trim();
    if (!trimmed) {
      throw new Error('נא להזין מיקום, כתובת יעד, או ללחוץ על זיהוי מיקום אוטומטי.');
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&limit=1&q=${encodeURIComponent(trimmed)}`
    );
    if (!response.ok) {
      throw new Error('שגיאה בחיפוש הכתובת');
    }

    const results = (await response.json()) as NominatimResult[];
    if (results.length === 0) {
      throw new Error(`לא מצאנו את המיקום "${trimmed}". נסי שם עיר או כתובת ברורה יותר.`);
    }

    return {
      lat: Number(results[0].lat),
      lng: Number(results[0].lon),
    };
  }

  function getWeightsByPriority(selected: string) {
    if (selected === 'distance') {
      return { weightDistance: 0.7, weightRating: 0.1, weightPrice: 0.1, weightSpeed: 0.1 };
    }
    if (selected === 'rating') {
      return { weightDistance: 0.15, weightRating: 0.7, weightPrice: 0.1, weightSpeed: 0.05 };
    }
    if (selected === 'price') {
      return { weightDistance: 0.15, weightRating: 0.15, weightPrice: 0.6, weightSpeed: 0.1 };
    }
    if (selected === 'speed') {
      return { weightDistance: 0.2, weightRating: 0.15, weightPrice: 0.1, weightSpeed: 0.55 };
    }
    return { weightDistance: 0.25, weightRating: 0.3, weightPrice: 0.25, weightSpeed: 0.2 };
  }

  function getPriorityHint(selected: string): string {
    if (selected === 'distance') {
      return 'מתעדף את העמדות הקרובות ביותר למיקום שבחרת.';
    }
    if (selected === 'rating') {
      return 'מתעדף עמדות עם הציון והביקורות הטובות ביותר מנהגים.';
    }
    if (selected === 'price') {
      return 'מתעדף את המחיר הנמוך ביותר לקוט"ש.';
    }
    if (selected === 'speed') {
      return 'מתאים את הספק העמדה (kW) לזמן הפנוי שלך — מהיר לזמן קצר, רגיל וחסכוני לזמן ארוך.';
    }
    return 'משלב באופן מאוזן קרבה, דירוג גולשים, מחיר והתאמת מהירות.';
  }

  async function runRecommendation(overrideBattery?: number) {
    if (!selectedVehicle) {
      setErrorMessage('יש לבחור רכב לפני חיפוש מותאם.');
      return;
    }

    const requestedBattery = overrideBattery ?? batteryLevel;

    if (
      !Number.isFinite(requestedBattery) ||
      requestedBattery < 0 ||
      requestedBattery >= 100
    ) {
      setErrorMessage('יש להזין מצב סוללה תקין הנמוך מ-100%.');
      return;
    }

    if (targetBattery <= requestedBattery || targetBattery > 100) {
      setErrorMessage('יעד הטעינה חייב להיות גבוה ממצב הסוללה הנוכחי.');
      return;
    }

    setErrorMessage('');
    setSuggestions([]);
    const actualBattery = overrideBattery ?? batteryLevel;
    const safeTarget = targetBattery;
    dispatch(setSearchBattery({ currentBatteryPercent: actualBattery, targetBatteryPercent: safeTarget }));

    try {
      setSearchingLocation(true);
      const coords = await resolveCoordinates();
      dispatch(setDriverLocation(coords));
      const weights = getWeightsByPriority(priority);

      await dispatch(
        recommendStations({
          driverLatitude: coords.lat,
          driverLongitude: coords.lng,
          batteryPercentage: actualBattery,
          availableTimeMinutes,
          requiredChargerType: chargerType || null,
          minRating: null,
          ...weights,
        })
      ).unwrap();

      navigate('/results');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'שגיאה בחיפוש עמדות מול השרת');
    } finally {
      setSearchingLocation(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    runRecommendation();
  }

  async function handleShowAllStations() {
    setErrorMessage('');
    setSuggestions([]);
    const safeTarget = Math.max(targetBattery, Math.min(batteryLevel + 10, 100));
    dispatch(setSearchBattery({ currentBatteryPercent: batteryLevel, targetBatteryPercent: safeTarget }));
    dispatch(setDriverLocation(gpsCoords));

    try {
      await dispatch(fetchStations()).unwrap();
      navigate('/results');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'שגיאה בטעינת כל העמדות');
    }
  }

  return (
    <div className="dash-page" dir="rtl">
      <PageHeader
        title="לאן נוסעים היום?"
        description="מצאו את עמדת הטעינה שמתאימה בדיוק לצרכים שלכם"
        icon={MapPin}
        actions={
          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            disabled={isBusy}
            onClick={handleShowAllStations}
          >
            <ListFilter size={18} />
            הצגת כל העמדות
          </button>
        }
      />

      <div className="dash-search-grid">
        {/* פאנל החיפוש המרכזי */}
        <div className="screen-view" style={{ flex: '2 1 500px' }}>
          <div className="screen-header">
            <div>
              <div>חיפוש והתאמת עמדת טעינה</div>
              <p className="ev-subtitle">הזן מיקום ומצב סוללה לחישוב העמדה המדויקת ביותר עבורך</p>
            </div>
          </div>

          {errorMessage && <div className="ev-alert-error">{errorMessage}</div>}

          <form onSubmit={handleSubmit}>
            <VehicleSelector
              selectedId={selectedVehicle?.id ?? selectedVehicleId}
              onSelect={handleVehicleSelect}
              onVehiclesLoaded={handleVehiclesLoaded}
              disabled={isBusy}
            />

            <div className="form-group" style={{ position: 'relative' }}>
              <label>מיקום נוכחי או כתובת יעד</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="מיקום נוכחי או כתובת יעד..."
                  value={locationText}
                  onChange={(e) => {
                    setLocationText(e.target.value);
                    setGpsCoords(null);
                  }}
                />
                <button
                  type="button"
                  className="ev-btn ev-btn-secondary ev-btn-auto"
                  disabled={detectingLocation}
                  onClick={handleDetectLocation}
                >
                  {detectingLocation ? 'מאתר...' : 'זהה מיקום'}
                </button>
              </div>

              {loadingSuggestions && (
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--ev-ink-soft)',
                    marginTop: '6px',
                  }}
                >
                  מחפש הצעות כתובות...
                </div>
              )}

              {suggestions.length > 0 && (
                <ul
                  onMouseLeave={() => setHoveredSuggestionId(null)}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: 'var(--ev-surface-solid)',
                    border: '1px solid var(--ev-border)',
                    borderRadius: '10px',
                    listStyle: 'none',
                    margin: '6px 0 0 0',
                    padding: 0,
                    maxHeight: '220px',
                    overflowY: 'auto',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.1)',
                  }}
                >
                  {suggestions.map((item) => {
                    const isHovered = hoveredSuggestionId === item.id;
                    return (
                      <li
                        key={item.id}
                        onClick={() => handleSelectSuggestion(item)}
                        onMouseEnter={() => setHoveredSuggestionId(item.id)}
                        style={{
                          padding: '10px 14px',
                          fontSize: '0.88rem',
                          color: isHovered ? 'var(--ev-brand-hover)' : 'var(--ev-ink)',
                          background: isHovered ? 'var(--ev-brand-soft)' : 'transparent',
                          fontWeight: isHovered ? 600 : 400,
                          textAlign: 'right',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--ev-surface-subtle)',
                          transition: 'background-color 0.15s ease, color 0.15s ease',
                        }}
                      >
                        {item.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
              }}
            >
              <div className="form-group">
                <label>סוללה נוכחית (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="form-control tabular-nums"
                  value={batteryLevel}
                  onChange={handleBatteryChange}
                />
              </div>
              <div className="form-group">
                <label>יעד טעינה רצוי (%)</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  className="form-control tabular-nums"
                  value={targetBattery}
                  onChange={handleTargetBatteryChange}
                />
              </div>
            </div>

            {/* חיווי מצב סוללה נקי */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                background: 'var(--ev-bg)',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid var(--ev-border)',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  flex: '0 0 88px',
                  height: '10px',
                  background: '#e2e8f0',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(Math.max(batteryLevel, 0), 100)}%`,
                    background: batteryColor,
                    transition: 'width 0.3s ease, background 0.3s ease',
                  }}
                />
              </div>
              <span
                className="tabular-nums"
                style={{ fontSize: '0.84rem', color: 'var(--ev-ink)', fontWeight: 600 }}
              >
                {batteryStatusText} · {estimatedRange}
              </span>
            </div>

            {batteryLevel <= 20 && (
              <div
                style={{
                  background: 'var(--ev-danger-soft)',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  border: '1px solid var(--ev-danger-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.84rem', color: '#991b1b', fontWeight: 500 }}>
                  סוללה מתחת ל-20% — אפשר להפעיל איתור חירום לעמדה הקרובה ביותר
                </span>
                <button
                  type="button"
                  className="ev-btn ev-btn-auto"
                  disabled={isBusy}
                  style={{ background: 'var(--ev-danger)' }}
                  onClick={() => runRecommendation(Math.min(batteryLevel, 10))}
                >
                  מצא עמדה מיידית (חירום)
                </button>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
              }}
            >
              <div className="form-group">
                <label>זמן פנוי (דקות)</label>
                <input
                  type="number"
                  min={15}
                  max={360}
                  className="form-control tabular-nums"
                  value={availableTimeMinutes}
                  onChange={(e) => setAvailableTimeMinutes(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>סוג שקע</label>
                <select
                  className="form-control"
                  value={chargerType}
                  onChange={(e) => setChargerType(e.target.value)}
                >
                  <option value="">הכול (לא משנה)</option>
                  <option value="Type2">Type2</option>
                  <option value="CCS">CCS (מהיר)</option>
                </select>
              </div>
              <div className="form-group">
                <label>סדר עדיפויות</label>
                <select
                  className="form-control"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="balanced">איזון חכם</option>
                  <option value="distance">הכי קרובה (מרחק)</option>
                  <option value="rating">דירוג וביקורות גבוהות</option>
                  <option value="price">מחיר הזול ביותר</option>
                  <option value="speed">התאמת מהירות טעינה (kW)</option>
                </select>
              </div>
            </div>

            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--ev-ink-soft)',
                marginTop: '-6px',
                marginBottom: '12px',
              }}
            >
              {getPriorityHint(priority)}
            </div>

            <button type="submit" className="btn" disabled={isBusy} style={{ marginTop: '6px' }}>
              {isBusy ? 'מאתר ומחשב התאמה...' : 'חשב עמדה אופטימלית'}
            </button>
          </form>
        </div>

        {/* כרטיס אומדן טעינה ועלות מראש */}
        <aside className="ev-card" style={{ flex: '1 1 280px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ev-brand)' }}>
            אומדן לפני יציאה
          </div>
          <h3 style={{ margin: '4px 0 4px 0', fontSize: '1.05rem', fontWeight: 700 }}>
            תכנון טעינה משוער
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: 'var(--ev-ink-soft)' }}>
            מתעדכן אוטומטית לפי הסוללה הנוכחית והיעד שבחרת
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              paddingTop: '14px',
              borderTop: '1px solid var(--ev-surface-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--ev-ink-muted)' }}>תוספת אנרגיה נדרשת</span>
              <span className="font-mono-num" style={{ fontWeight: 600 }}>
                {estimatedKwhNeeded.toFixed(1)} kWh
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--ev-ink-muted)' }}>זמן משוער (טעינה מהירה)</span>
              <span className="font-mono-num" style={{ fontWeight: 600 }}>
                ~{estimatedMinutesFast} דק&apos;
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--ev-ink-muted)' }}>עלות משוערת ממוצעת</span>
              <span className="font-mono-num" style={{ fontWeight: 700, color: 'var(--ev-brand)' }}>
                ₪{estimatedCostNis.toFixed(1)}
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid var(--ev-surface-subtle)',
              fontSize: '0.76rem',
              color: 'var(--ev-ink-soft)',
              lineHeight: 1.55,
            }}
          >
            האומדן מחושב לפי{' '}
            {selectedVehicle
              ? `קיבולת הרכב הנבחר (${selectedVehicle.batteryCapacityKwh} kWh)`
              : 'סוללה ממוצעת (60 kWh)'}{' '}
            ותעריף שוק של ₪1.58 לקוט&quot;ש. המחיר הסופי נקבע לפי התחנה שתבחר.
          </div>
        </aside>
      </div>
    </div>
  );
}