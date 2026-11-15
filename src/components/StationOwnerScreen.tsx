import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../api/apiClient';
import type { Station } from '../store/stations/stationsState';

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

interface NominatimResult {
  lat: string;
  lon: string;
}

type OwnerTab = 'stations' | 'bookings' | 'feedback';

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
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [bookings, setBookings] = useState<ChargeBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ניווט וניקיון תצוגה
  const [activeTab, setActiveTab] = useState<OwnerTab>('stations');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // שדות לטופס הוספת עמדה
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [chargerType, setChargerType] = useState<'CCS' | 'Type2'>('CCS');
  const [maxKw, setMaxKw] = useState('50');
  const [pricePerKwh, setPricePerKwh] = useState('1.8');
  const [saving, setSaving] = useState(false);

  // שדות לעריכת עמדה קיימת
  const [editingStationId, setEditingStationId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editMaxKw, setEditMaxKw] = useState('');
  const [editChargerType, setEditChargerType] = useState<'CCS' | 'Type2'>('CCS');

  const loadOwnerData = async () => {
    try {
      setLoading(true);
      setError(null);

      const claims = await apiFetch<UserClaim[]>('/users/me');
      const ownerIdClaim = claims.find((c) => c.type === 'ownerId')?.value;

      if (!ownerIdClaim) {
        setError('המשתמש הנוכחי אינו רשום כבעל תחנה. היכנסי ממסך הכניסה בתפקיד "בעל עמדת טעינה".');
        return;
      }

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

  const handleAddStation = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      setSaving(true);

      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&limit=1&q=${encodeURIComponent(address.trim())}`
      );
      if (!geoRes.ok) {
        throw new Error('שגיאה באיתור הכתובת');
      }
      const geoData = (await geoRes.json()) as NominatimResult[];
      if (geoData.length === 0) {
        throw new Error(
          `לא הצלחנו לאתר את הכתובת "${address}". נסי לרשום רחוב, מספר ועיר (למשל: רוטשילד 50 תל אביב).`
        );
      }

      await apiFetch('/ChargingStations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          address,
          latitude: Number(geoData[0].lat),
          longitude: Number(geoData[0].lon),
          chargerType,
          maxKw: Number(maxKw),
          pricePerKwh: Number(pricePerKwh),
          isActive: true,
        }),
      });

      setName('');
      setAddress('');
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
    setEditingStationId(station.id);
    setEditName(station.name);
    setEditPrice(String(station.pricePerKwh));
    setEditMaxKw(String(station.maxKw));
    setEditChargerType(station.chargerType === 'Type2' ? 'Type2' : 'CCS');
  };

  const handleSaveEdit = async (station: Station) => {
    try {
      setError(null);
      setSuccessMessage(null);
      await apiFetch(`/ChargingStations/${station.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName,
          address: station.address,
          latitude: station.latitude,
          longitude: station.longitude,
          chargerType: editChargerType,
          maxKw: Number(editMaxKw),
          pricePerKwh: Number(editPrice),
          isActive: station.isActive,
        }),
      });
      setEditingStationId(null);
      setSuccessMessage(`פרטי העמדה "${editName}" עודכנו בהצלחה.`);
      await loadOwnerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון פרטי העמדה');
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
    <div className="container" dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* כותרת לוח ניהול + כפתור הוספה קומפקטי */}
      <div
        className="ev-card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
            לוח ניהול עמדות טעינה
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: 'var(--ev-ink-soft)' }}>
            ניהול זמינות, תעריפים, הזמנות נכנסות ודיווחי תקינות במקום אחד
          </p>
        </div>

        {dashboard && (
          <button
            type="button"
            className={`ev-btn ev-btn-auto ${showAddForm ? 'ev-btn-secondary' : 'ev-btn-accent'}`}
            onClick={() => {
              setShowAddForm((prev) => !prev);
              setError(null);
            }}
          >
            {showAddForm ? 'סגור טופס הוספה' : '+ הוסף עמדה חדשה'}
          </button>
        )}
      </div>

      {error && (
        <div className="ev-alert-error" style={{ marginBottom: 0 }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="ev-alert-success" style={{ marginBottom: 0 }}>
          {successMessage}
        </div>
      )}

      {dashboard && (
        <>
          {/* טופס הוספת עמדה — נפתח רק בלחיצה */}
          {showAddForm && (
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
                  <p className="ev-subtitle">הכתובת מאותרת אוטומטית ומוצגת לנהגים במפה</p>
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
                  <label>כתובת מלאה</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="רוטשילד 50, תל אביב"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>סוג שקע</label>
                  <select
                    className="form-control"
                    value={chargerType}
                    onChange={(e) => setChargerType(e.target.value as 'CCS' | 'Type2')}
                  >
                    <option value="CCS">CCS (טעינה מהירה)</option>
                    <option value="Type2">Type2</option>
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
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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

          {/* שורת מדדים קומפקטית */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
            }}
          >
            <div className="ev-card" style={{ padding: '15px 18px' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>סה&quot;כ עמדות</div>
              <div className="font-mono-num" style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '3px' }}>
                {dashboard.totalStationsCount}
              </div>
            </div>
            <div className="ev-card" style={{ padding: '15px 18px' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>עמדות פעילות</div>
              <div
                className="font-mono-num"
                style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ev-brand)', marginTop: '3px' }}
              >
                {dashboard.activeStationsCount}
              </div>
            </div>
            <div className="ev-card" style={{ padding: '15px 18px' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>עמדות תקולות</div>
              <div
                className="font-mono-num"
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: dashboard.faultyStationsCount > 0 ? 'var(--ev-danger)' : 'var(--ev-ink)',
                  marginTop: '3px',
                }}
              >
                {dashboard.faultyStationsCount}
              </div>
            </div>
            <div className="ev-card" style={{ padding: '15px 18px' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>סה&quot;כ הזמנות</div>
              <div className="font-mono-num" style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '3px' }}>
                {dashboard.totalBookings}
              </div>
            </div>
            <div className="ev-card" style={{ padding: '15px 18px' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>דירוג ממוצע</div>
              <div className="font-mono-num" style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '3px' }}>
                {dashboard.averageRating !== null ? dashboard.averageRating.toFixed(1) : '—'}
              </div>
            </div>
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
                  <p className="ev-subtitle">עדכון תעריף, הספק, הפעלה/השבתה וטיפול בתקלות</p>
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
                  {dashboard.stations.map((station) => (
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
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ev-ink)' }}>
                            {station.name}
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
                                ? 'דווחה תקלה'
                                : station.isActive
                                  ? 'פעילה ותקינה'
                                  : 'מושבתת'}
                            </span>
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
                              <option value="CCS">CCS</option>
                              <option value="Type2">Type2</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            className="ev-btn"
                            onClick={() => void handleSaveEdit(station)}
                          >
                            שמור שינויים
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
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
                      fontSize: '0.86rem',
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