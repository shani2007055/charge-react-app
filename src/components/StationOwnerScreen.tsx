import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '../api/apiClient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { Station } from '../store/stations/stationsState';
import { hasUserProfile } from '../store/user/userState';
import { switchUserRole } from '../store/user/userThunks';
import PageHeader from './ui/PageHeader';
import StatCard from './ui/StatCard';
import BlockedHoursBar from './ui/BlockedHoursBar';
import {
  LayoutDashboard,
  Zap,
  CircleCheck,
  TriangleAlert,
  CalendarDays,
  Star,
  Plus,
  Clock,
} from 'lucide-react';

interface UserClaim {
  type: string;
  value: string;
}

interface ReviewDto {
  id: number;
  stationName: string;
  driverName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface FaultReportDto {
  id: number;
  stationName: string;
  status: string;
  currentDriverName: string | null;
  updatedAt: string;
}

interface OwnerDashboard {
  ownerId: number;
  totalStationsCount: number;
  activeStationsCount: number;
  faultyStationsCount: number;
  totalBookings: number;
  averageRating: number | null;
  stations: Station[];
  recentReviews: ReviewDto[];
  recentFaultReports: FaultReportDto[];
}

interface ChargeBooking {
  id: number;
  stationName: string;
  vehicleModel: string;
  status: string;
  currentBatteryPercent: number;
  targetBatteryPercent: number;
  createdAt: string;
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
  class?: string;
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

type OwnerTab = 'stations' | 'bookings' | 'feedback';

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

function normalizeAddressQuery(raw: string): string {
  return raw
    .trim()
    .replace(/(^|\s)(רחוב|רח׳|רח'|מס'|מספר)\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveAddressCoords(rawAddress: string): Promise<{ lat: number; lng: number } | null> {
  const query = normalizeAddressQuery(rawAddress);
  if (!query) return null;

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=il&accept-language=he&limit=5&q=${encodeURIComponent(query)}`
  );
  if (!res.ok) {
    throw new Error('שגיאה באיתור הכתובת');
  }

  const results = (await res.json()) as NominatimResult[];
  if (results.length === 0) return null;

  // תעדוף תוצאה עם מספר בית מדויק על פני מרכז רחוב
  const best =
    results.find((r) => Boolean(r.address?.house_number || r.class === 'building')) ?? results[0];
  const lat = Number(best.lat);
  const lng = Number(best.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

function getBookingStatusStyle(status: string): { label: string; bg: string; color: string; border: string } {
  if (status === 'Completed') {
    return { label: 'הושלם', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' };
  }
  if (status === 'Charging') {
    return { label: 'בטעינה', bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' };
  }
  if (status === 'Confirmed' || status === 'Held') {
    return {
      label: status === 'Held' ? 'שמור (Held)' : 'אושרה הגעה',
      bg: '#F1F5F9',
      color: '#0F172A',
      border: '#CBD5E1',
    };
  }
  if (status === 'Cancelled' || status === 'Expired') {
    return {
      label: status === 'Cancelled' ? 'בוטל' : 'פג תוקף',
      bg: '#FEF2F2',
      color: '#B91C1C',
      border: '#FECACA',
    };
  }
  return { label: status, bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' };
}

export default function StationOwnerScreen() {
  const dispatch = useAppDispatch();
  const { token } = useAppSelector((state) => state.user);

  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [bookings, setBookings] = useState<ChargeBooking[]>([]);
  const [needsOwnerSetup, setNeedsOwnerSetup] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OwnerTab>('stations');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // שדות לטופס הוספת עמדה
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<CleanSuggestion[]>([]);
  const [hoveredSuggestionId, setHoveredSuggestionId] = useState<number | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [chargerType, setChargerType] = useState<'CCS' | 'Type2'>('Type2');
  const [maxKw, setMaxKw] = useState('50');
  const [pricePerKwh, setPricePerKwh] = useState('1.8');
  const [newBlockedHours, setNewBlockedHours] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // מונע פתיחה חוזרת של הצעות מיד אחרי בחירה או זיהוי GPS
  const skipNextAutocompleteRef = useRef<boolean>(false);

  // שדות לעריכת עמדה קיימת
  const [editingStationId, setEditingStationId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editMaxKw, setEditMaxKw] = useState('');
  const [editChargerType, setEditChargerType] = useState<'CCS' | 'Type2'>('Type2');
  const [savingEdit, setSavingEdit] = useState(false);

  // שדות לעריכת שעות השבתה אוטומטיות
  const [scheduleStationId, setScheduleStationId] = useState<number | null>(null);
  const [draftBlockedHours, setDraftBlockedHours] = useState<number[]>([]);
  const [savingHours, setSavingHours] = useState(false);

  const loadOwnerData = async () => {
    try {
      setLoading(true);
      setError(null);

      const claims = await apiFetch<UserClaim[]>('/users/me');
      const ownerIdClaim = claims.find((c) => c.type === 'ownerId')?.value;

      if (!ownerIdClaim) {
        setNeedsOwnerSetup(true);
        setDashboard(null);
        setBookings([]);
        setShowAddForm(true);
        return;
      }

      setNeedsOwnerSetup(false);
      const [dashboardData, bookingsData] = await Promise.all([
        apiFetch<OwnerDashboard>(`/Owner/${ownerIdClaim}/dashboard`),
        apiFetch<ChargeBooking[]>('/ChargeBooking/my-stations'),
      ]);

      setDashboard(dashboardData);
      setBookings(bookingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת נתוני בעל התחנה');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOwnerData();
  }, []);

  useEffect(() => {
    if (!showAddForm) {
      setSuggestions([]);
      setHoveredSuggestionId(null);
      return;
    }

    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }

    const query = address.trim();
    if (query.length < 3 || addressCoords !== null) {
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
  }, [showAddForm, address, addressCoords]);

  const handleSelectSuggestion = (item: CleanSuggestion) => {
    skipNextAutocompleteRef.current = true;
    setAddress(item.label);
    setAddressCoords({ lat: item.lat, lng: item.lng });
    setSuggestions([]);
    setHoveredSuggestionId(null);
    setError(null);
  };

  const handleDetectLocation = () => {
    setError(null);
    setSuggestions([]);
    setHoveredSuggestionId(null);

    if (!navigator.geolocation) {
      setError('הדפדפן שלך אינו תומך בזיהוי מיקום.');
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        skipNextAutocompleteRef.current = true;
        setAddressCoords({ lat, lng });

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
              ? `${data.address.road}${data.address.house_number ? ` ${data.address.house_number}` : ''}`
              : '';
            const shortAddress = [road, cityName].filter(Boolean).join(', ');
            setAddress(shortAddress || data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          } else {
            setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch {
          setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        setError('לא הצלחנו לזהות את המיקום. ודאי שאישרת גישה למיקום בדפדפן, או הקלידי כתובת.');
        setDetectingLocation(false);
      }
    );
  };

  const handleAddStation = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSuggestions([]);
    setHoveredSuggestionId(null);

    try {
      setSaving(true);
      const coords = addressCoords ?? (await resolveAddressCoords(address));
      if (!coords) {
        throw new Error(
          `לא הצלחנו לאתר את הכתובת "${address}". נסי לרשום רחוב, מספר בית ועיר (למשל: התשעים ושלוש 5, פתח תקווה).`
        );
      }

      if (needsOwnerSetup || !hasUserProfile(token, 'Owner')) {
        await dispatch(switchUserRole('Owner')).unwrap();
      }

      await apiFetch('/ChargingStations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          address: address.trim(),
          latitude: coords.lat,
          longitude: coords.lng,
          chargerType,
          maxKw: Number(maxKw),
          pricePerKwh: Number(pricePerKwh),
          isActive: true,
          blockedHours: newBlockedHours,
        }),
      });

      setName('');
      setAddress('');
      setAddressCoords(null);
      setChargerType('Type2');
      setNewBlockedHours([]);
      setNeedsOwnerSetup(false);
      setShowAddForm(false);
      setActiveTab('stations');
      setSuccessMessage('העמדה החדשה נוספה בהצלחה ומוצגת לנהגים במפה.');
      await loadOwnerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהוספת העמדה');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStationStatus = async (station: Station) => {
    try {
      setError(null);
      setSuccessMessage(null);
      await apiFetch(`/ChargingStations/${station.id}/status?isActive=${!station.isActive}`, {
        method: 'PATCH',
      });
      await loadOwnerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס העמדה');
    }
  };

  const startEditing = (station: Station) => {
    setScheduleStationId(null);
    setEditingStationId(station.id);
    setEditName(station.name);
    setEditAddress(station.address);
    setEditPrice(String(station.pricePerKwh));
    setEditMaxKw(String(station.maxKw));
    setEditChargerType(station.chargerType === 'CCS' ? 'CCS' : 'Type2');
  };

  const handleSaveEdit = async (station: Station) => {
    try {
      setError(null);
      setSuccessMessage(null);
      setSavingEdit(true);

      const trimmedAddress = editAddress.trim() || station.address;
      const resolved = await resolveAddressCoords(trimmedAddress);
      if (!resolved && trimmedAddress !== station.address.trim()) {
        throw new Error(
          `לא הצלחנו לאתר את הכתובת "${trimmedAddress}". נסי לרשום רחוב, מספר בית ועיר.`
        );
      }

      await apiFetch(`/ChargingStations/${station.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName,
          address: trimmedAddress,
          latitude: resolved ? resolved.lat : station.latitude,
          longitude: resolved ? resolved.lng : station.longitude,
          chargerType: editChargerType,
          maxKw: Number(editMaxKw),
          pricePerKwh: Number(editPrice),
          isActive: station.isActive,
          blockedHours: station.blockedHours ?? [],
        }),
      });

      setEditingStationId(null);
      setSuccessMessage(`פרטי העמדה "${editName}" עודכנו בהצלחה.`);
      await loadOwnerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון פרטי העמדה');
    } finally {
      setSavingEdit(false);
    }
  };

  const startScheduleEditing = (station: Station) => {
    setEditingStationId(null);
    setScheduleStationId(station.id);
    setDraftBlockedHours(station.blockedHours ?? []);
  };

  const handleSaveBlockedHours = async (station: Station) => {
    try {
      setError(null);
      setSuccessMessage(null);
      setSavingHours(true);

      await apiFetch(`/ChargingStations/${station.id}/blocked-hours`, {
        method: 'PATCH',
        body: JSON.stringify({ blockedHours: draftBlockedHours }),
      });

      setScheduleStationId(null);
      setSuccessMessage(`שעות הפעילות של "${station.name}" נשמרו בהצלחה.`);
      await loadOwnerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת שעות הפעילות');
    } finally {
      setSavingHours(false);
    }
  };

  const handleResolveFault = async (stationId: number) => {
    try {
      setError(null);
      setSuccessMessage(null);
      await apiFetch(`/StationStatusLogs/station/${stationId}/resolve`, {
        method: 'POST',
      });
      setSuccessMessage('התקלה סומנה כטופלה והעמדה חזרה לזמינות מלאה.');
      await loadOwnerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה באיפוס התקלה');
    }
  };

  if (loading) {
    return (
      <div className="container" dir="rtl">
        <div className="ev-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ margin: 0, color: 'var(--ev-ink-muted)', fontWeight: 500 }}>
            טוען את לוח הניהול של בעל התחנה...
          </p>
        </div>
      </div>
    );
  }

  const feedbackCount = dashboard
    ? dashboard.recentFaultReports.length + dashboard.recentReviews.length
    : 0;

  return (
    <div className="dash-page" dir="rtl">
      <PageHeader
        title="לוח ניהול תחנות"
        description="ניהול התחנות, ההזמנות, הביקורות והזמינות במקום אחד"
        icon={LayoutDashboard}
        actions={
          (dashboard || needsOwnerSetup) && (
            <button
              type="button"
              className={`ev-btn ev-btn-auto ${
                showAddForm
                  ? 'ev-btn-secondary'
                  : 'ev-btn-accent'
              }`}
              onClick={() => {
                setShowAddForm((prev) => !prev);
                setError(null);
              }}
            >
              <Plus size={19} />
              {showAddForm
                ? 'סגור טופס הוספה'
                : 'הוספת עמדה חדשה'}
            </button>
          )
        }
      />

      {error && (
        <div className="ev-alert-error" style={{ marginBottom: 0 }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          {successMessage}
        </div>
      )}

      {needsOwnerSetup && !dashboard && (
        <div
          className="ev-card"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.08rem', color: 'var(--ev-ink)' }}>
              רוצה להשכיר עמדת טעינה?
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'var(--ev-ink-muted)' }}>
              פרופיל בעל התחנה ייווצר רק לאחר הוספת העמדה הראשונה שלך — כך המערכת נשארת נקייה מעמודים ריקים.
            </p>
          </div>
          {!showAddForm && (
            <button
              type="button"
              className="ev-btn ev-btn-accent ev-btn-auto"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={18} />
              הוסף את העמדה הראשונה שלך
            </button>
          )}
        </div>
      )}

      {/* טופס הוספת עמדה — נפתח בלחיצה או למשתמש בהגשת עמדה ראשונה */}
      {(dashboard || needsOwnerSetup) && showAddForm && (
        <form
          onSubmit={handleAddStation}
          className="ev-card"
          style={{
            border: '1.5px solid var(--ev-brand-border)',
          }}
        >
          <div className="screen-header" style={{ marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>הוספת עמדת טעינה חדשה</div>
              <p className="ev-subtitle">הכתובת מאותרת אוטומטית מהצעות החיפוש או ממיקום נוכחי</p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
              gap: '12px',
            }}
          >
            <div className="form-group">
              <label>שם העמדה</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="עמדת תל אביב מרכז"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>סוג שקע</label>
              <select
                className="form-control"
                value={chargerType}
                onChange={(e) => setChargerType(e.target.value as 'CCS' | 'Type2')}
              >
                <option value="Type2">Type2</option>
                <option value="CCS">CCS (טעינה מהירה)</option>
              </select>
            </div>

            <div className="form-group">
              <label>הספק (kW)</label>
              <input
                type="number"
                className="form-control tabular-nums"
                required
                min={1}
                max={1000}
                value={maxKw}
                onChange={(e) => setMaxKw(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>מחיר לקוט&quot;ש (₪)</label>
              <input
                type="number"
                step="0.1"
                className="form-control tabular-nums"
                required
                min={0.1}
                value={pricePerKwh}
                onChange={(e) => setPricePerKwh(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
              <label>כתובת מלאה</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="הקלד כתובת מלאה או לחץ זהה מיקום..."
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setAddressCoords(null);
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
                gridColumn: '1 / -1',
                padding: '12px 14px',
                background: 'var(--ev-bg)',
                borderRadius: '10px',
                border: '1px solid var(--ev-border)',
              }}
            >
              <BlockedHoursBar value={newBlockedHours} onChange={setNewBlockedHours} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
            <button type="submit" className="ev-btn ev-btn-auto" disabled={saving}>
              {saving ? 'מאתר כתובת ושומר...' : 'שמור עמדה חדשה'}
            </button>
            <button
              type="button"
              className="ev-btn ev-btn-secondary ev-btn-auto"
              onClick={() => setShowAddForm(false)}
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      {dashboard && (
        <>
          {/* שורת מדדים קומפקטית */}
          <div className="dash-stats">
            <StatCard
              title="סה״כ עמדות"
              value={dashboard.totalStationsCount}
              icon={Zap}
              tone="orange"
            />
            <StatCard
              title="עמדות פעילות"
              value={dashboard.activeStationsCount}
              icon={CircleCheck}
              tone="green"
            />
            <StatCard
              title="עמדות תקולות"
              value={dashboard.faultyStationsCount}
              icon={TriangleAlert}
              tone="red"
            />
            <StatCard
              title="סה״כ הזמנות"
              value={dashboard.totalBookings}
              icon={CalendarDays}
              tone="blue"
            />
            <StatCard
              title="דירוג ממוצע"
              value={dashboard.averageRating?.toFixed(1) ?? '—'}
              icon={Star}
              tone="orange"
            />
          </div>

          {/* סרגל טאבים */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.88)',
              padding: '8px',
              borderRadius: '14px',
              border: '1px solid var(--ev-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('stations')}
              style={{
                flex: '1 1 150px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'stations' ? '#0F172A' : 'transparent',
                color: activeTab === 'stations' ? '#FFFFFF' : 'var(--ev-ink-muted)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>העמדות שלי</span>
              <span
                className="font-mono-num"
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: activeTab === 'stations' ? 'rgba(255,255,255,0.16)' : '#F1F5F9',
                  color: activeTab === 'stations' ? '#FFFFFF' : 'var(--ev-ink)',
                }}
              >
                {dashboard.stations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              style={{
                flex: '1 1 150px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'bookings' ? '#0F172A' : 'transparent',
                color: activeTab === 'bookings' ? '#FFFFFF' : 'var(--ev-ink-muted)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>הזמנות וטעינות</span>
              <span
                className="font-mono-num"
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: activeTab === 'bookings' ? 'rgba(255,255,255,0.16)' : '#F1F5F9',
                  color: activeTab === 'bookings' ? '#FFFFFF' : 'var(--ev-ink)',
                }}
              >
                {bookings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('feedback')}
              style={{
                flex: '1 1 150px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'feedback' ? '#0F172A' : 'transparent',
                color: activeTab === 'feedback' ? '#FFFFFF' : 'var(--ev-ink-muted)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>תקלות וביקורות</span>
              <span
                className="font-mono-num"
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background:
                    dashboard.faultyStationsCount > 0
                      ? '#DC2626'
                      : activeTab === 'feedback'
                        ? 'rgba(255,255,255,0.16)'
                        : '#F1F5F9',
                  color:
                    dashboard.faultyStationsCount > 0 || activeTab === 'feedback'
                      ? '#FFFFFF'
                      : 'var(--ev-ink)',
                }}
              >
                {dashboard.faultyStationsCount > 0 ? `${dashboard.faultyStationsCount} תקלות` : feedbackCount}
              </span>
            </button>
          </div>

          {/* טאב 1: ניהול העמדות שלי */}
          {activeTab === 'stations' && (
            <div className="ev-card">
              <div className="screen-header">
                <div>
                  <div>העמדות שלי</div>
                  <p className="ev-subtitle">עדכון תעריף, הספק, כתובת, שעות השבתה אוטומטיות וטיפול בתקלות</p>
                </div>
              </div>

              {dashboard.stations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                  <p style={{ color: 'var(--ev-ink-soft)', margin: '0 0 12px 0' }}>
                    עדיין לא הוספת עמדות טעינה.
                  </p>
                  <button
                    type="button"
                    className="ev-btn ev-btn-accent ev-btn-auto"
                    onClick={() => setShowAddForm(true)}
                  >
                    + הוסף את העמדה הראשונה שלך
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {dashboard.stations.map((station) => {
                    const blockedCount = station.blockedHours?.length ?? 0;
                    const isScheduleOpen = scheduleStationId === station.id;

                    return (
                      <div
                        key={station.id}
                        style={{
                          background: 'var(--ev-bg)',
                          padding: '16px 18px',
                          borderRadius: '11px',
                          border:
                            station.currentStatus === 'Faulty'
                              ? '1px solid var(--ev-danger-border)'
                              : '1px solid var(--ev-border)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px',
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: '1rem',
                                color: 'var(--ev-ink)',
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '8px',
                              }}
                            >
                              <span>{station.name}</span>
                              {station.isClosedBySchedule && (
                                <span
                                  style={{
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: '#FEF2F2',
                                    color: '#B91C1C',
                                    border: '1px solid #FECACA',
                                  }}
                                >
                                  {station.nextOpenHour != null
                                    ? `סגורה לפי לו״ז · תיפתח ב-${String(station.nextOpenHour).padStart(2, '0')}:00`
                                    : 'סגורה לפי לו״ז'}
                                </span>
                              )}
                            </div>
                            <div
                              className="tabular-nums"
                              style={{ fontSize: '0.83rem', color: 'var(--ev-ink-muted)', marginTop: '4px' }}
                            >
                              {station.address} · {station.chargerType} · {station.maxKw} kW · ₪
                              {station.pricePerKwh}/kWh ·{' '}
                              <span
                                style={{
                                  fontWeight: 600,
                                  color:
                                    station.currentStatus === 'Faulty'
                                      ? 'var(--ev-danger)'
                                      : station.isActive
                                        ? 'var(--ev-brand)'
                                        : 'var(--ev-ink-soft)',
                                }}
                              >
                                {station.currentStatus === 'Faulty'
                                  ? 'תקלה (דווח ע"י נהג)'
                                  : station.isActive
                                    ? 'פעילה ותקינה'
                                    : 'מושבתת'}
                              </span>
                              {blockedCount > 0 && ` · ${blockedCount} שעות חסומות`}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {station.currentStatus === 'Faulty' && (
                              <button
                                type="button"
                                className="ev-btn ev-btn-accent ev-btn-auto"
                                onClick={() => void handleResolveFault(station.id)}
                              >
                                סמן כטופלה (זמינה)
                              </button>
                            )}
                            <button
                              type="button"
                              className="ev-btn ev-btn-secondary ev-btn-auto"
                              onClick={() =>
                                isScheduleOpen ? setScheduleStationId(null) : startScheduleEditing(station)
                              }
                            >
                              <Clock size={15} />
                              {isScheduleOpen ? 'סגור שעות' : 'שעות פעילות'}
                            </button>
                            <button
                              type="button"
                              className="ev-btn ev-btn-secondary ev-btn-auto"
                              onClick={() =>
                                editingStationId === station.id
                                  ? setEditingStationId(null)
                                  : startEditing(station)
                              }
                            >
                              {editingStationId === station.id ? 'ביטול עריכה' : 'ערוך פרטים'}
                            </button>
                            <button
                              type="button"
                              className={`ev-btn ev-btn-auto ${
                                station.isActive ? 'ev-btn-danger' : ''
                              }`}
                              onClick={() => void handleToggleStationStatus(station)}
                            >
                              {station.isActive ? 'השבת עמדה' : 'הפעל עמדה'}
                            </button>
                          </div>
                        </div>

                        {isScheduleOpen && (
                          <div
                            style={{
                              width: '100%',
                              marginTop: '14px',
                              paddingTop: '14px',
                              borderTop: '1px solid var(--ev-border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                            }}
                          >
                            <BlockedHoursBar
                              value={draftBlockedHours}
                              onChange={setDraftBlockedHours}
                              disabled={savingHours}
                            />
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="ev-btn ev-btn-auto"
                                disabled={savingHours}
                                onClick={() => void handleSaveBlockedHours(station)}
                              >
                                {savingHours ? 'שומר שעות...' : 'שמור שעות פעילות'}
                              </button>
                              <button
                                type="button"
                                className="ev-btn ev-btn-secondary ev-btn-auto"
                                disabled={savingHours}
                                onClick={() => setScheduleStationId(null)}
                              >
                                ביטול
                              </button>
                            </div>
                          </div>
                        )}

                        {editingStationId === station.id && (
                          <div
                            style={{
                              width: '100%',
                              marginTop: '14px',
                              paddingTop: '14px',
                              borderTop: '1px solid var(--ev-border)',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                              gap: '10px',
                              alignItems: 'end',
                            }}
                          >
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>שם</label>
                              <input
                                type="text"
                                className="form-control"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>כתובת</label>
                              <input
                                type="text"
                                className="form-control"
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>מחיר (₪/kWh)</label>
                              <input
                                type="number"
                                step="0.1"
                                className="form-control tabular-nums"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>הספק (kW)</label>
                              <input
                                type="number"
                                className="form-control tabular-nums"
                                value={editMaxKw}
                                onChange={(e) => setEditMaxKw(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>סוג שקע</label>
                              <select
                                className="form-control"
                                value={editChargerType}
                                onChange={(e) => setEditChargerType(e.target.value as 'CCS' | 'Type2')}
                              >
                                <option value="Type2">Type2</option>
                                <option value="CCS">CCS</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              className="ev-btn"
                              disabled={savingEdit}
                              onClick={() => void handleSaveEdit(station)}
                            >
                              {savingEdit ? 'מעדכן...' : 'שמור שינויים'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* טאב 2: היסטוריית הזמנות */}
          {activeTab === 'bookings' && (
            <div className="ev-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--ev-border)' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--ev-ink)' }}>
                  היסטוריית הזמנות בעמדות שלי
                </h3>
              </div>

              {bookings.length === 0 ? (
                <p style={{ color: 'var(--ev-ink-soft)', padding: '24px', margin: 0 }}>
                  אין עדיין הזמנות בעמדות שלך.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      textAlign: 'right',
                      fontSize: '0.88rem',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: 'var(--ev-bg)',
                          color: 'var(--ev-ink-soft)',
                          borderBottom: '1px solid var(--ev-border)',
                        }}
                      >
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>מזהה</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>תחנה</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>רכב</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>סוללה</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>סטטוס</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>תאריך</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => {
                        const badge = getBookingStatusStyle(b.status);
                        return (
                          <tr key={b.id} style={{ borderBottom: '1px solid var(--ev-surface-subtle)' }}>
                            <td className="font-mono-num" style={{ padding: '12px 16px', color: 'var(--ev-ink-soft)' }}>
                              #{b.id}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--ev-ink)', fontWeight: 600 }}>
                              {b.stationName}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--ev-ink-muted)' }}>
                              {b.vehicleModel || '—'}
                            </td>
                            <td className="font-mono-num" style={{ padding: '12px 16px', color: 'var(--ev-ink-muted)' }}>
                              {b.currentBatteryPercent}% ← {b.targetBatteryPercent}%
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 9px',
                                  borderRadius: '7px',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  background: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border}`,
                                }}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="font-mono-num" style={{ padding: '12px 16px', color: 'var(--ev-ink-soft)' }}>
                              {new Date(b.createdAt).toLocaleDateString('he-IL')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* טאב 3: תקלות וביקורות */}
          {activeTab === 'feedback' && (
            <>
              {dashboard.recentFaultReports.length === 0 && dashboard.recentReviews.length === 0 ? (
                <div className="ev-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
                  <p style={{ margin: 0, color: 'var(--ev-ink-muted)' }}>
                    אין כרגע דיווחי תקלות או ביקורות מנהגים בעמדות שלך.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                    gap: '18px',
                  }}
                >
                  <div className="ev-card">
                    <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', color: 'var(--ev-danger)' }}>
                      דיווחי תקלות אחרונים
                    </h3>
                    {dashboard.recentFaultReports.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ev-ink-soft)' }}>
                        כל העמדות תקינות — אין דיווחי תקלה.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {dashboard.recentFaultReports.map((fault) => (
                          <div
                            key={fault.id}
                            style={{
                              background: 'var(--ev-danger-soft)',
                              border: '1px solid var(--ev-danger-border)',
                              padding: '12px 14px',
                              borderRadius: '10px',
                              fontSize: '0.86rem',
                              color: '#991b1b',
                            }}
                          >
                            <strong>{fault.stationName}</strong> · סטטוס: {fault.status}
                            {fault.currentDriverName && ` (דווח ע"י ${fault.currentDriverName})`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="ev-card">
                    <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', color: 'var(--ev-ink)' }}>
                      ביקורות אחרונות מנהגים
                    </h3>
                    {dashboard.recentReviews.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ev-ink-soft)' }}>
                        עדיין לא התקבלו ביקורות מנהגים.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {dashboard.recentReviews.map((rev) => (
                          <div
                            key={rev.id}
                            style={{
                              paddingBottom: '12px',
                              borderBottom: '1px solid var(--ev-surface-subtle)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.86rem',
                              }}
                            >
                              <strong style={{ color: 'var(--ev-ink)' }}>{rev.stationName}</strong>
                              <span
                                className="font-mono-num"
                                style={{ color: 'var(--ev-brand)', fontWeight: 700 }}
                              >
                                {rev.rating}/5
                              </span>
                            </div>
                            <p
                              style={{
                                margin: '4px 0 0 0',
                                fontSize: '0.84rem',
                                color: 'var(--ev-ink-muted)',
                              }}
                            >
                              {rev.comment}
                            </p>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--ev-ink-soft)',
                                marginTop: '4px',
                              }}
                            >
                              {rev.driverName}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}