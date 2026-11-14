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

export default function StationOwnerScreen() {
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [bookings, setBookings] = useState<ChargeBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
        setError('המשתמש הנוכחי אינו רשום כבעל תחנה. היכנסי ממסך הכניסה בתפקיד "משתמש תחנה (Owner)".');
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
    loadOwnerData();
  }, []);

  const handleAddStation = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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
        throw new Error(`לא הצלחנו לאתר את הכתובת "${address}". נסי לרשום רחוב, מספר ועיר (למשל: רוטשילד 50 תל אביב).`);
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
      await loadOwnerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון פרטי העמדה');
    }
  };

  const handleResolveFault = async (stationId: number) => {
    try {
      setError(null);
      await apiFetch(`/StationStatusLogs/station/${stationId}/resolve`, {
        method: 'POST',
      });
      await loadOwnerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה באיפוס התקלה');
    }
  };

  if (loading) {
    return (
      <div className="container" dir="rtl">
        <div className="screen-view" style={{ textAlign: 'center', padding: '40px', color: 'white' }}>
          <p>⏳ טוען את פאנל בעל התחנה...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        <div className="screen-header">
          <span>פנאל ניהול בעל תחנה</span>
        </div>

        {error && (
          <div style={{ background: '#ff4d4d', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {dashboard && (
          <>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', color: 'white' }}>
              <div style={{ background: '#121212', padding: '12px 18px', borderRadius: '8px', border: '1px solid #333' }}>
                ⚡ סה"כ עמדות: <strong>{dashboard.totalStationsCount}</strong>
              </div>
              <div style={{ background: '#121212', padding: '12px 18px', borderRadius: '8px', border: '1px solid #333' }}>
                ✅ פעילות: <strong style={{ color: 'var(--primary)' }}>{dashboard.activeStationsCount}</strong>
              </div>
              <div style={{ background: '#121212', padding: '12px 18px', borderRadius: '8px', border: '1px solid #333' }}>
                ⚠️ תקולות: <strong style={{ color: '#f87171' }}>{dashboard.faultyStationsCount}</strong>
              </div>
              <div style={{ background: '#121212', padding: '12px 18px', borderRadius: '8px', border: '1px solid #333' }}>
                📅 סה"כ הזמנות: <strong>{dashboard.totalBookings}</strong>
              </div>
              <div style={{ background: '#121212', padding: '12px 18px', borderRadius: '8px', border: '1px solid #333' }}>
                ⭐ דירוג ממוצע: <strong>{dashboard.averageRating !== null ? dashboard.averageRating.toFixed(1) : 'אין עדיין'}</strong>
              </div>
            </div>

            <form onSubmit={handleAddStation} style={{ background: '#121212', padding: '20px', borderRadius: '10px', border: '1px solid #333', marginBottom: '25px' }}>
              <h3 style={{ marginTop: 0, color: 'white', marginBottom: '15px' }}>➕ הוספת עמדת טעינה חדשה</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div className="form-group">
                  <label>שם העמדה:</label>
                  <input type="text" className="form-control" required placeholder="עמדת תל אביב מרכז" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>כתובת מלאה (מאותרת אוטומטית במפה):</label>
                  <input type="text" className="form-control" required placeholder="רוטשילד 50, תל אביב" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>סוג שקע:</label>
                  <select className="form-control" value={chargerType} onChange={(e) => setChargerType(e.target.value as 'CCS' | 'Type2')}>
                    <option value="CCS">CCS (טעינה מהירה)</option>
                    <option value="Type2">Type2</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>הספק (kW):</label>
                  <input type="number" className="form-control" required min={1} max={1000} value={maxKw} onChange={(e) => setMaxKw(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>מחיר לקוט"ש (₪):</label>
                  <input type="number" step="0.1" className="form-control" required min={0.1} value={pricePerKwh} onChange={(e) => setPricePerKwh(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn" disabled={saving} style={{ marginTop: '10px', cursor: 'pointer' }}>
                {saving ? 'מאתר כתובת ושומר...' : 'שמור עמדה חדשה ➔'}
              </button>
            </form>

            <h3 style={{ color: 'white', marginBottom: '10px' }}>🔌 העמדות שלי</h3>
            {dashboard.stations.length === 0 ? (
              <p style={{ color: '#aaa', marginBottom: '25px' }}>עדיין לא הוספת עמדות.</p>
            ) : (
              <div style={{ display: 'grid', gap: '10px', marginBottom: '25px' }}>
                {dashboard.stations.map((station) => (
                  <div key={station.id} style={{ background: '#121212', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ color: 'white' }}>
                        <strong>{station.name}</strong> — <span style={{ color: '#aaa' }}>{station.address}</span>
                        <div style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '4px' }}>
                          {station.chargerType} | {station.maxKw} kW | ₪{station.pricePerKwh}/kWh
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: station.isActive ? '#064e3b' : '#7f1d1d',
                          color: station.isActive ? 'var(--primary)' : '#fca5a5',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                        }}>
                          {station.isActive ? 'פעילה ותקינה' : 'לא פעילה'}
                        </span>

                        {station.currentStatus === 'Faulty' && (
                          <>
                            <span style={{ background: '#7f1d1d', color: '#fca5a5', padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                              ⚠️ סומנה כתקולה!
                            </span>
                            <button
                              type="button"
                              className="btn"
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem', background: '#0369a1', cursor: 'pointer' }}
                              onClick={() => handleResolveFault(station.id)}
                            >
                              🔧 סמן כטופלה (זמינה)
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          className="btn"
                          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem', background: '#334155', cursor: 'pointer' }}
                          onClick={() => (editingStationId === station.id ? setEditingStationId(null) : startEditing(station))}
                        >
                          {editingStationId === station.id ? 'ביטול עריכה' : '✏️ ערוך פרטים'}
                        </button>

                        <button
                          type="button"
                          className="btn"
                          style={{ width: 'auto', padding: '6px 14px', fontSize: '0.85rem', background: station.isActive ? '#7f1d1d' : '#064e3b', cursor: 'pointer' }}
                          onClick={() => handleToggleStationStatus(station)}
                        >
                          {station.isActive ? 'השבת עמדה' : 'הפעל עמדה'}
                        </button>
                      </div>
                    </div>

                    {editingStationId === station.id && (
                      <div style={{ width: '100%', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #333', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', alignItems: 'end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>שם:</label>
                          <input type="text" className="form-control" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>מחיר (₪/kWh):</label>
                          <input type="number" step="0.1" className="form-control" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>הספק (kW):</label>
                          <input type="number" className="form-control" value={editMaxKw} onChange={(e) => setEditMaxKw(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>סוג שקע:</label>
                          <select className="form-control" value={editChargerType} onChange={(e) => setEditChargerType(e.target.value as 'CCS' | 'Type2')}>
                            <option value="CCS">CCS</option>
                            <option value="Type2">Type2</option>
                          </select>
                        </div>
                        <button type="button" className="btn" style={{ cursor: 'pointer' }} onClick={() => handleSaveEdit(station)}>
                          💾 שמור שינויים
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {dashboard.recentFaultReports.length > 0 && (
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ color: '#f87171', marginBottom: '10px' }}>🚨 דיווחי תקלות אחרונים</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {dashboard.recentFaultReports.map((fault) => (
                    <div key={fault.id} style={{ background: '#2b0909', border: '1px solid var(--danger)', padding: '12px', borderRadius: '8px', color: 'white' }}>
                      <strong>{fault.stationName}</strong> — סטטוס: {fault.status}
                      {fault.currentDriverName && ` (דווח ע"י ${fault.currentDriverName})`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dashboard.recentReviews.length > 0 && (
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ color: 'white', marginBottom: '10px' }}>💬 ביקורות אחרונות מנהגים</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {dashboard.recentReviews.map((rev) => (
                    <div key={rev.id} style={{ background: '#121212', border: '1px solid #333', padding: '12px', borderRadius: '8px', color: 'white' }}>
                      <strong>{rev.stationName}</strong> | ⭐ {rev.rating}/5 — <span style={{ color: '#aaa' }}>{rev.driverName}</span>
                      <p style={{ margin: '4px 0 0 0', color: '#cbd5e1', fontSize: '0.9rem' }}>{rev.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 style={{ color: 'white', marginBottom: '10px' }}>📋 היסטוריית הזמנות בעמדות שלי</h3>
            {bookings.length === 0 ? (
              <p style={{ color: '#aaa' }}>אין עדיין הזמנות בעמדות שלך.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#121212', color: '#aaa', borderBottom: '1px solid #333' }}>
                      <th style={{ padding: '10px' }}>מזהה</th>
                      <th style={{ padding: '10px' }}>תחנה</th>
                      <th style={{ padding: '10px' }}>רכב</th>
                      <th style={{ padding: '10px' }}>סוללה</th>
                      <th style={{ padding: '10px' }}>סטטוס</th>
                      <th style={{ padding: '10px' }}>תאריך</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #262626' }}>
                        <td style={{ padding: '12px 10px', color: '#aaa' }}>#{b.id}</td>
                        <td style={{ padding: '12px 10px', color: 'white', fontWeight: 'bold' }}>{b.stationName}</td>
                        <td style={{ padding: '12px 10px', color: 'white' }}>{b.vehicleModel}</td>
                        <td style={{ padding: '12px 10px', color: '#ccc' }}>{b.currentBatteryPercent}% → {b.targetBatteryPercent}%</td>
                        <td style={{ padding: '12px 10px', color: 'var(--primary)', fontWeight: 'bold' }}>{b.status}</td>
                        <td style={{ padding: '12px 10px', color: '#aaa' }}>{new Date(b.createdAt).toLocaleDateString('he-IL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}