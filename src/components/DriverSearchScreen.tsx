import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchStations, recommendStations } from '../store/stations/stationsThunks';
import { setSearchBattery } from '../store/stations/stationsSlice';

interface NominatimResult {
  lat: string;
  lon: string;
}

export default function DriverSearchScreen() {
  const [batteryLevel, setBatteryLevel] = useState<number>(50);
  const [targetBattery, setTargetBattery] = useState<number>(80);
  const [estimatedRange, setEstimatedRange] = useState<string>('כ-150 ק"מ');
  const [batteryStatusText, setBatteryStatusText] = useState<string>('סוללה במצב בינוני (50%)');
  const [batteryColor, setBatteryColor] = useState<string>('var(--yellow)');

  const [locationText, setLocationText] = useState<string>('תל אביב');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [searchingLocation, setSearchingLocation] = useState<boolean>(false);

  const [availableTimeMinutes, setAvailableTimeMinutes] = useState<number>(60);
  const [chargerType, setChargerType] = useState<string>('');
  const [priority, setPriority] = useState<string>('balanced');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.stations);

  const isBusy = loading || searchingLocation;

  const handleBatteryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setBatteryLevel(val);
    setEstimatedRange(`כ-${Math.round(val * 3)} ק"מ`);

    if (val <= 10) {
      setBatteryStatusText(`מצב חירום! סוללה קריטית (${val}%)`);
      setBatteryColor('var(--danger)');
    } else if (val <= 50) {
      setBatteryStatusText(`סוללה במצב בינוני (${val}%)`);
      setBatteryColor('var(--yellow)');
    } else {
      setBatteryStatusText(`סוללה מלאה/תקינה (${val}%)`);
      setBatteryColor('var(--primary)');
    }
  };

  function handleDetectLocation() {
    setErrorMessage('');
    if (!navigator.geolocation) {
      setErrorMessage('הדפדפן שלך אינו תומך בזיהוי מיקום.');
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setGpsCoords({ lat, lng });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he`
          );
          if (res.ok) {
            const data = (await res.json()) as {
              display_name?: string;
              address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string };
            };
            const cityName = data.address?.city || data.address?.town || data.address?.village || '';
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
    if (selected === 'speed') {
      return { weightDistance: 0.2, weightRating: 0.2, weightPrice: 0.1, weightSpeed: 0.5 };
    }
    if (selected === 'price') {
      return { weightDistance: 0.2, weightRating: 0.2, weightPrice: 0.5, weightSpeed: 0.1 };
    }
    return { weightDistance: 0.25, weightRating: 0.3, weightPrice: 0.25, weightSpeed: 0.2 };
  }

  async function runRecommendation(overrideBattery?: number) {
    setErrorMessage('');
    const actualBattery = overrideBattery ?? batteryLevel;
    const safeTarget = Math.max(targetBattery, Math.min(actualBattery + 10, 100));
    dispatch(setSearchBattery({ currentBatteryPercent: actualBattery, targetBatteryPercent: safeTarget }));

    try {
      setSearchingLocation(true);
      const coords = await resolveCoordinates();
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    runRecommendation();
  }

  async function handleShowAllStations() {
    setErrorMessage('');
    const safeTarget = Math.max(targetBattery, Math.min(batteryLevel + 10, 100));
    dispatch(setSearchBattery({ currentBatteryPercent: batteryLevel, targetBatteryPercent: safeTarget }));

    try {
      await dispatch(fetchStations()).unwrap();
      navigate('/results');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'שגיאה בטעינת כל העמדות');
    }
  }

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        <div className="screen-header">
          <span>🔍 חיפוש מהיר והעדפות טעינה</span>
        </div>

        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          {errorMessage && (
            <div style={{ background: '#ff4d4d', color: 'white', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>📍 מיקום נוכחי או כתובת יעד לתכנון טעינה:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="לדוגמה: תל אביב / רוטשילד 50 תל אביב"
                  value={locationText}
                  onChange={(e) => {
                    setLocationText(e.target.value);
                    setGpsCoords(null);
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={detectingLocation}
                  onClick={handleDetectLocation}
                  style={{ width: 'auto', whiteSpace: 'nowrap', padding: '0 14px', fontSize: '0.85rem', background: 'var(--accent-blue)', cursor: 'pointer' }}
                >
                  {detectingLocation ? 'מאתר...' : '🎯 זהה מיקום'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>🔋 סוללה נוכחית (%):</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="form-control"
                  value={batteryLevel}
                  onChange={handleBatteryChange}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>🎯 יעד טעינה רצוי (%):</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  className="form-control"
                  value={targetBattery}
                  onChange={(e) => setTargetBattery(Number(e.target.value))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#121212', padding: '12px', borderRadius: '10px', border: '1px solid #333', marginBottom: '15px' }}>
              <div style={{ width: '50px', height: '24px', border: '2px solid #333', borderRadius: '5px', padding: '2px' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(Math.max(batteryLevel, 0), 100)}%`,
                  background: batteryColor,
                  borderRadius: '2px',
                  transition: 'width 0.4s ease, background 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: '0.85rem', color: batteryColor, fontWeight: 'bold' }}>
                {batteryStatusText} ({estimatedRange})
              </span>
            </div>

            {batteryLevel <= 20 && (
              <div style={{ background: '#450a0a', padding: '10px', borderRadius: '8px', marginBottom: '15px', border: '1px solid var(--danger)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#fca5a5' }}>סוללה קריטית? </span>
                <button
                  type="button"
                  className="btn"
                  disabled={isBusy}
                  style={{ background: 'var(--danger)', padding: '6px 12px', fontSize: '0.8rem', width: 'auto', display: 'inline-block', marginRight: '8px', cursor: 'pointer' }}
                  onClick={() => runRecommendation(Math.min(batteryLevel, 10))}
                >
                  🚨 מצא עמדה קרובה מיידית (מצב חירום)
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>⏱️ זמן פנוי (דקות):</label>
                <input
                  type="number"
                  min={15}
                  max={360}
                  className="form-control"
                  value={availableTimeMinutes}
                  onChange={(e) => setAvailableTimeMinutes(Number(e.target.value))}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>🔌 סוג שקע:</label>
                <select className="form-control" value={chargerType} onChange={(e) => setChargerType(e.target.value)}>
                  <option value="">הכול (לא משנה)</option>
                  <option value="CCS">CCS (מהיר)</option>
                  <option value="Type2">Type2</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>⭐ סדר עדיפויות באלגוריתם:</label>
              <select className="form-control" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="balanced">איזון חכם (קרבה + דירוג + מחיר + מהירות)</option>
                <option value="distance">מרחק פיזי קצר ביותר</option>
                <option value="speed">טעינה מהירה וחיסכון בזמן</option>
                <option value="price">מחיר הזול ביותר לקוט"ש</option>
              </select>
            </div>

            <button type="submit" className="btn" disabled={isBusy} style={{ marginTop: '10px', cursor: 'pointer' }}>
              {isBusy ? 'מאתר ומחשב התאמה...' : 'חשב עמדה אופטימלית ➔'}
            </button>

            <button
              type="button"
              className="btn"
              disabled={isBusy}
              onClick={handleShowAllStations}
              style={{ marginTop: '10px', background: '#1e293b', border: '1px solid #334155', cursor: 'pointer' }}
            >
              🗺️ תכנון כללי: הצג את כל העמדות בארץ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}