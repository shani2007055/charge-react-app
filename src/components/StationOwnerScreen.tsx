import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../api/apiClient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { Station } from '../store/stations/stationsState';
import { hasUserProfile } from '../store/user/userState';
import { switchUserRole } from '../store/user/userThunks';
import {
  resolveExactAddress,
  reverseGeocodeExactAddress,
  type AddressSuggestion,
} from '../utils/geocoding';
import AddressAutocomplete from './ui/AddressAutocomplete';
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

const MIN_PRICE_PER_KWH = 0.1;
const MAX_PRICE_PER_KWH = 100;
const MIN_KW = 1;
const MAX_KW = 1000;

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

type OwnerTab = 'stations' | 'bookings' | 'feedback';

function validateStationNumbers(priceValue: string, kwValue: string): string | null {
  const kw = Number(kwValue);
  if (!kwValue.trim() || !Number.isFinite(kw) || kw < MIN_KW || kw > MAX_KW) {
    return `הספק הטעינה חייב להיות בין ${MIN_KW} ל-${MAX_KW} kW.`;
  }

  const price = Number(priceValue);
  if (
    !priceValue.trim() ||
    !Number.isFinite(price) ||
    price < MIN_PRICE_PER_KWH ||
    price > MAX_PRICE_PER_KWH
  ) {
    return `המחיר לקוט"ש חייב להיות בין ${MIN_PRICE_PER_KWH} ₪ ל-${MAX_PRICE_PER_KWH} ₪.`;
  }

  return null;
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

function getApprovalBadge(status?: string): {
  label: string;
  bg: string;
  color: string;
  border: string;
} {
  if (status === 'Pending') {
    return {
      label: 'ממתינה לאישור מנהל',
      bg: '#FFFBEB',
      color: '#B45309',
      border: '#FDE68A',
    };
  }
  if (status === 'Rejected') {
    return {
      label: 'נדחתה ע״י מנהל',
      bg: '#FEF2F2',
      color: '#B91C1C',
      border: '#FECACA',
    };
  }
  return {
    label: 'מאושרת במפה',
    bg: '#ECFDF5',
    color: '#047857',
    border: '#A7F3D0',
  };
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
  const [addressHint, setAddressHint] = useState<string | null>(null);
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [chargerType, setChargerType] = useState<'CCS' | 'Type2'>('Type2');
  const [maxKw, setMaxKw] = useState('50');
  const [pricePerKwh, setPricePerKwh] = useState('1.8');
  const [newBlockedHours, setNewBlockedHours] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // שדות לעריכת עמדה קיימת
  const [editingStationId, setEditingStationId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editAddressCoords, setEditAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editAddressHint, setEditAddressHint] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editMaxKw, setEditMaxKw] = useState('');
  const [editChargerType, setEditChargerType] = useState<'CCS' | 'Type2'>('Type2');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // שדות לעריכת שעות השבתה אוטומטיות
  const [scheduleStationId, setScheduleStationId] = useState<number | null>(null);
  const [draftBlockedHours, setDraftBlockedHours] = useState<number[]>([]);
  const [savingHours, setSavingHours] = useState(false);

  const parsedAddPrice = Number(pricePerKwh);
  const addPriceInvalid =
    pricePerKwh.trim() !== '' &&
    (!Number.isFinite(parsedAddPrice) ||
      parsedAddPrice < MIN_PRICE_PER_KWH ||
      parsedAddPrice > MAX_PRICE_PER_KWH);

  const parsedAddKw = Number(maxKw);
  const addKwInvalid =
    maxKw.trim() !== '' &&
    (!Number.isFinite(parsedAddKw) || parsedAddKw < MIN_KW || parsedAddKw > MAX_KW);

  const parsedEditPrice = Number(editPrice);
  const editPriceInvalid =
    editPrice.trim() !== '' &&
    (!Number.isFinite(parsedEditPrice) ||
      parsedEditPrice < MIN_PRICE_PER_KWH ||
      parsedEditPrice > MAX_PRICE_PER_KWH);

  const parsedEditKw = Number(editMaxKw);
  const editKwInvalid =
    editMaxKw.trim() !== '' &&
    (!Number.isFinite(parsedEditKw) || parsedEditKw < MIN_KW || parsedEditKw > MAX_KW);

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

  const handleSelectAddSuggestion = (item: AddressSuggestion) => {
    setAddress(item.label);
    setAddressCoords(null);
    setError(null);

    if (item.hasHouseNumber) {
      setAddressCoords({ lat: item.lat, lng: item.lng });
      setAddressHint(null);
    } else {
      setAddressHint('נבחר רחוב — יש להוסיף מספר בית ולבחור מהרשימה (או להשלים ידנית).');
    }
  };

  const handleSelectEditSuggestion = (item: AddressSuggestion) => {
    setEditAddress(item.label);
    setEditAddressCoords(null);
    setEditError(null);

    if (item.hasHouseNumber) {
      setEditAddressCoords({ lat: item.lat, lng: item.lng });
      setEditAddressHint(null);
    } else {
      setEditAddressHint('נבחר רחוב — יש להוסיף מספר בית לפני השמירה.');
    }
  };

  const handleDetectLocation = () => {
    setError(null);
    setAddressHint(null);

    if (!navigator.geolocation) {
      setError('הדפדפן שלך אינו תומך בזיהוי מיקום.');
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const detected = await reverseGeocodeExactAddress(lat, lng);
          setAddress(detected.address);
          setAddressCoords({ lat, lng });
          if (!detected.hasHouseNumber) {
            setAddressHint('הרחוב זוהה לפי GPS — מומלץ להשלים מספר בית מדויק.');
          }
        } catch (err) {
          setAddressCoords(null);
          setError(
            err instanceof Error
              ? err.message
              : 'לא הצלחנו לתרגם את המיקום לכתובת רחוב מדויקת. יש להזין רחוב, מספר בית ועיר ידנית.'
          );
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

    try {
      const validationError = validateStationNumbers(pricePerKwh, maxKw);
      if (validationError) {
        throw new Error(validationError);
      }

      if (!address.trim()) {
        throw new Error('יש להזין כתובת מדויקת הכוללת רחוב, מספר בית ועיר.');
      }

      setSaving(true);

      let finalLat: number;
      let finalLng: number;
      let finalAddress = address.trim();

      if (addressCoords) {
        finalLat = addressCoords.lat;
        finalLng = addressCoords.lng;
      } else {
        const resolved = await resolveExactAddress(address);
        finalLat = resolved.lat;
        finalLng = resolved.lng;
        finalAddress = resolved.normalizedAddress;
      }

      if (needsOwnerSetup || !hasUserProfile(token, 'Owner')) {
        await dispatch(switchUserRole('Owner')).unwrap();
      }

      await apiFetch('/ChargingStations', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          address: finalAddress,
          latitude: finalLat,
          longitude: finalLng,
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
      setAddressHint(null);
      setChargerType('Type2');
      setMaxKw('50');
      setPricePerKwh('1.8');
      setNewBlockedHours([]);
      setNeedsOwnerSetup(false);
      setShowAddForm(false);
      setActiveTab('stations');
      setSuccessMessage('העמדה החדשה נשלחה לאישור מנהל המערכת ותופיע לנהגים במפה לאחר האישור.');
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
    setEditError(null);
    setEditAddressHint(null);
    setEditingStationId(station.id);
    setEditName(station.name);
    setEditAddress(station.address);
    setEditAddressCoords({ lat: station.latitude, lng: station.longitude });
    setEditPrice(String(station.pricePerKwh));
    setEditMaxKw(String(station.maxKw));
    setEditChargerType(station.chargerType === 'CCS' ? 'CCS' : 'Type2');
  };

  const handleSaveEdit = async (station: Station) => {
    try {
      setError(null);
      setEditError(null);
      setSuccessMessage(null);

      const validationError = validateStationNumbers(editPrice, editMaxKw);
      if (validationError) {
        throw new Error(validationError);
      }

      const trimmedAddress = editAddress.trim();
      if (!trimmedAddress) {
        throw new Error('יש להזין כתובת מדויקת הכוללת רחוב, מספר בית ועיר.');
      }

      setSavingEdit(true);

      const addressChanged = trimmedAddress !== station.address.trim();
      const willResetToPending = station.approvalStatus === 'Rejected' || addressChanged;

      let nextAddress = trimmedAddress;
      let nextLat = station.latitude;
      let nextLng = station.longitude;

      if (addressChanged) {
        if (editAddressCoords) {
          nextLat = editAddressCoords.lat;
          nextLng = editAddressCoords.lng;
        } else {
          const resolved = await resolveExactAddress(trimmedAddress);
          nextAddress = resolved.normalizedAddress;
          nextLat = resolved.lat;
          nextLng = resolved.lng;
        }
      }

      await apiFetch(`/ChargingStations/${station.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          address: nextAddress,
          latitude: nextLat,
          longitude: nextLng,
          chargerType: editChargerType,
          maxKw: Number(editMaxKw),
          pricePerKwh: Number(editPrice),
          isActive: station.isActive,
          blockedHours: station.blockedHours ?? [],
        }),
      });

      setEditingStationId(null);
      setEditError(null);
      setEditAddressHint(null);
      setSuccessMessage(
        willResetToPending
          ? `פרטי העמדה "${editName}" עודכנו והעמדה נשלחה מחדש לאישור מנהל המערכת.`
          : `פרטי העמדה "${editName}" עודכנו בהצלחה.`
      );
      await loadOwnerData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה בעדכון פרטי העמדה';
      setEditError(msg);
      setError(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const startScheduleEditing = (station: Station) => {
    setEditingStationId(null);
    setEditError(null);
    setEditAddressHint(null);
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
              <p className="ev-subtitle">יש להזין ולבחור כתובת מדויקת (רחוב, מספר בית ועיר) או לזהות מיקום נוכחי</p>
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
                min={MIN_KW}
                max={MAX_KW}
                value={maxKw}
                onChange={(e) => setMaxKw(e.target.value)}
              />
              {addKwInvalid && (
                <div style={{ fontSize: '0.76rem', color: 'var(--ev-danger)', marginTop: '4px' }}>
                  הספק חייב להיות בין {MIN_KW} ל-{MAX_KW} kW
                </div>
              )}
            </div>

            <div className="form-group">
              <label>מחיר לקוט&quot;ש (₪)</label>
              <input
                type="number"
                step="0.1"
                className="form-control tabular-nums"
                required
                min={MIN_PRICE_PER_KWH}
                max={MAX_PRICE_PER_KWH}
                value={pricePerKwh}
                onChange={(e) => setPricePerKwh(e.target.value)}
              />
              {addPriceInvalid && (
                <div style={{ fontSize: '0.76rem', color: 'var(--ev-danger)', marginTop: '4px' }}>
                  מחיר מותר: {MIN_PRICE_PER_KWH}–{MAX_PRICE_PER_KWH} ₪ לקוט&quot;ש
                </div>
              )}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <AddressAutocomplete
                exactOnly
                label="כתובת מדויקת (רחוב, מספר בית ועיר)"
                placeholder="למשל: טרומפלדור 12, תל אביב (בחרי מההצעות או הקלידי רחוב, מספר ועיר)"
                value={address}
                isSelected={addressCoords !== null}
                disabled={saving}
                hint={addressHint}
                onChange={(text) => {
                  setAddress(text);
                  setAddressCoords(null);
                  setAddressHint(null);
                }}
                onSelect={handleSelectAddSuggestion}
                onClear={() => {
                  setAddress('');
                  setAddressCoords(null);
                  setAddressHint(null);
                }}
                rightAction={
                  <button
                    type="button"
                    className="ev-btn ev-btn-secondary ev-btn-auto"
                    disabled={detectingLocation || saving}
                    onClick={handleDetectLocation}
                  >
                    {detectingLocation ? 'מאתר...' : 'זהה מיקום'}
                  </button>
                }
              />
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
            <button
              type="submit"
              className="ev-btn ev-btn-auto"
              disabled={saving || addPriceInvalid || addKwInvalid}
            >
              {saving ? 'מאמת כתובת ושומר...' : 'שמור עמדה חדשה'}
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
                    const approvalBadge = getApprovalBadge(station.approvalStatus);

                    return (
                      <div
                        key={station.id}
                        style={{
                          background: 'var(--ev-bg)',
                          padding: '16px 18px',
                          borderRadius: '11px',
                          border:
                            station.currentStatus === 'Faulty' || station.approvalStatus === 'Rejected'
                              ? '1px solid var(--ev-danger-border)'
                              : station.approvalStatus === 'Pending'
                                ? '1px solid #FDE68A'
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
                          <div style={{ flex: '1 1 280px' }}>
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
                              <span
                                style={{
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: approvalBadge.bg,
                                  color: approvalBadge.color,
                                  border: `1px solid ${approvalBadge.border}`,
                                }}
                              >
                                {approvalBadge.label}
                              </span>
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

                            {station.approvalStatus === 'Rejected' && (
                              <div
                                style={{
                                  marginTop: '8px',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: '#FEF2F2',
                                  border: '1px solid #FECACA',
                                  color: '#991B1B',
                                  fontSize: '0.82rem',
                                }}
                              >
                                <strong>סיבת הדחייה:</strong>{' '}
                                {station.rejectionReason?.trim() || 'לא צוינה סיבה.'}{' '}
                                <span style={{ color: '#B91C1C' }}>
                                  (ניתן לערוך את פרטי העמדה ולשמור כדי לשלוח לאישור חוזר)
                                </span>
                              </div>
                            )}
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
                              onClick={() => {
                                if (editingStationId === station.id) {
                                  setEditingStationId(null);
                                  setEditError(null);
                                  setEditAddressHint(null);
                                } else {
                                  startEditing(station);
                                }
                              }}
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
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                            }}
                          >
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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
                                <label>מחיר (₪/kWh)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min={MIN_PRICE_PER_KWH}
                                  max={MAX_PRICE_PER_KWH}
                                  className="form-control tabular-nums"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>הספק (kW)</label>
                                <input
                                  type="number"
                                  min={MIN_KW}
                                  max={MAX_KW}
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

                              <div style={{ gridColumn: '1 / -1' }}>
                                <AddressAutocomplete
                                  exactOnly
                                  label="כתובת מדויקת (רחוב, מספר בית ועיר)"
                                  placeholder="למשל: טרומפלדור 12, תל אביב"
                                  value={editAddress}
                                  isSelected={editAddressCoords !== null}
                                  disabled={savingEdit}
                                  hint={editAddressHint}
                                  onChange={(text) => {
                                    setEditAddress(text);
                                    setEditAddressCoords(null);
                                    setEditAddressHint(null);
                                    setEditError(null);
                                  }}
                                  onSelect={handleSelectEditSuggestion}
                                  onClear={() => {
                                    setEditAddress('');
                                    setEditAddressCoords(null);
                                    setEditAddressHint(null);
                                    setEditError(null);
                                  }}
                                />
                              </div>
                            </div>

                            {editPriceInvalid && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--ev-danger)' }}>
                                המחיר לקוט&quot;ש חייב להיות בין {MIN_PRICE_PER_KWH} ₪ ל-{MAX_PRICE_PER_KWH} ₪.
                              </div>
                            )}
                            {editKwInvalid && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--ev-danger)' }}>
                                ההספק חייב להיות בין {MIN_KW} ל-{MAX_KW} kW.
                              </div>
                            )}
                            {editError && (
                              <div className="ev-alert-error" style={{ marginBottom: 0 }}>
                                {editError}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="ev-btn ev-btn-auto"
                                disabled={savingEdit || editPriceInvalid || editKwInvalid}
                                onClick={() => void handleSaveEdit(station)}
                              >
                                {savingEdit ? 'מעדכן...' : 'שמור שינויים'}
                              </button>
                            </div>
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