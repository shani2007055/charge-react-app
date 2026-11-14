import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchStations } from '../store/stations/stationsThunks';
import { apiFetch } from '../api/apiClient';
import type { Station } from '../store/stations/stationsState';

interface VehicleDto {
  id: number;
  model: string;
  currentBattery: number;
}

interface BookingStatusOnly {
  status: string;
}

const ACTIVE_STATUSES = ['Held', 'Confirmed', 'Charging'];

export default function StationResultsScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, recommendations, hasSearched, currentBatteryPercent, targetBatteryPercent, loading, error } =
    useAppSelector((state) => state.stations);
  const { carModel } = useAppSelector((state) => state.user);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [hasActiveBooking, setHasActiveBooking] = useState<boolean>(false);
  const [reservingId, setReservingId] = useState<number | null>(null);

  useEffect(() => {
    if (!hasSearched) {
      dispatch(fetchStations());
    }

    async function checkActiveBooking() {
      try {
        const myBookings = await apiFetch<BookingStatusOnly[]>('/ChargeBooking/my');
        setHasActiveBooking(myBookings.some((b) => ACTIVE_STATUSES.includes(b.status)));
      } catch {
        // המשתמש אינו נהג
      }
    }

    checkActiveBooking();
  }, [dispatch, hasSearched]);

  async function handleReserveStation(station: Station) {
    setBookingError(null);
    setReservingId(station.id);

    try {
      let vehicles = await apiFetch<VehicleDto[]>('/UsersVehicles/my');
      if (vehicles.length === 0) {
        const createdVehicle = await apiFetch<VehicleDto>('/UsersVehicles', {
          method: 'POST',
          body: JSON.stringify({
            model: carModel || 'Tesla Model 3',
            batteryCapacityKwh: 75,
            currentBattery: currentBatteryPercent,
            supportedChargerType: station.chargerType || 'CCS',
          }),
        });
        vehicles = [createdVehicle];
      }

      const vehicle = vehicles[0];
      const currentBattery = Math.min(currentBatteryPercent, 95);
      const targetBattery = Math.max(targetBatteryPercent, currentBattery + 1);
      const arrivalTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await apiFetch('/ChargeBooking', {
        method: 'POST',
        body: JSON.stringify({
          stationId: station.id,
          vehicleId: vehicle.id,
          currentBatteryPercent: currentBattery,
          targetBatteryPercent: targetBattery,
          estimatedArrivalTime: arrivalTime,
        }),
      });

      navigate('/active');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה בשריון העמדה';
      if (msg.includes('הזמנה פעילה')) {
        setHasActiveBooking(true);
      }
      setBookingError(
        msg.includes('403')
          ? 'כדי לשריין עמדה צריך להתחבר ממסך הכניסה בתפקיד נהג (Driver).'
          : msg
      );
    } finally {
      setReservingId(null);
    }
  }

  if (loading) {
    return (
      <div className="container" dir="rtl">
        <div className="screen-view" style={{ textAlign: 'center', padding: '40px', color: 'white' }}>
          <p>⏳ טוען עמדות טעינה מהשרת...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" dir="rtl">
        <div className="screen-view" style={{ textAlign: 'center', padding: '40px', color: '#ff4d4d' }}>
          <p>❌ שגיאה בטעינת העמדות: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        <div className="screen-header">
          <span>
            {hasSearched ? '🎯 המלצות מותאמות אישית (מהאלגוריתם)' : '⚡ כל עמדות הטעינה במערכת'}
          </span>
        </div>

        <div style={{ maxWidth: '650px', margin: '0 auto', color: 'white' }}>
          <div style={{ marginBottom: '15px' }}>
            <button
              type="button"
              className="btn"
              style={{ width: 'auto', padding: '6px 14px', fontSize: '0.85rem', background: '#1e293b', cursor: 'pointer' }}
              onClick={() => navigate('/search')}
            >
              ← חזרה לחיפוש
            </button>
          </div>

          {hasActiveBooking && (
            <div style={{ background: '#1e3a8a', border: '1px solid #3b82f6', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span>⚡ יש לך כבר הזמנה פתוחה במערכת! לא ניתן לשריין עמדה נוספת במקביל.</span>
              <button
                type="button"
                className="btn"
                style={{ width: 'auto', padding: '6px 14px', fontSize: '0.85rem', background: 'var(--primary)', color: 'black', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={() => navigate('/active')}
              >
                ⏱️ עבור להזמנה הפעילה שלי ➔
              </button>
            </div>
          )}

          {bookingError && (
            <div style={{ background: '#ff4d4d', color: 'white', padding: '12px', borderRadius: '6px', marginBottom: '15px', textAlign: 'center' }}>
              <div>{bookingError}</div>
              {hasActiveBooking && (
                <button
                  type="button"
                  className="btn"
                  style={{ width: 'auto', marginTop: '10px', padding: '6px 14px', fontSize: '0.85rem', background: '#111827', cursor: 'pointer' }}
                  onClick={() => navigate('/active')}
                >
                  ⏱️ צפה בהזמנה הפעילה / בטל שריון ➔
                </button>
              )}
            </div>
          )}

          {hasSearched && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ color: '#aaa' }}>נמצאו {recommendations.length} עמדות מתאימות:</span>
              <button
                type="button"
                className="btn"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
                onClick={() => dispatch(fetchStations())}
              >
                הצג את כל העמדות
              </button>
            </div>
          )}

          {hasSearched ? (
            recommendations.length === 0 ? (
              <p style={{ color: '#aaa' }}>לא נמצאו עמדות מתאימות לטווח ולסינונים שבחרת.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {recommendations.map((rec) => (
                  <li
                    key={rec.station.id}
                    style={{
                      background: rec.isEmergencyMode ? '#2b0909' : '#121212',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      border: rec.isEmergencyMode ? '1.5px solid var(--danger)' : '1px solid #333',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>{rec.station.name}</h3>
                      <span style={{ background: '#064e3b', color: 'var(--primary)', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {rec.matchPercentage}% התאמה
                      </span>
                    </div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#aaa' }}>
                      📍 {rec.station.address} ({rec.distanceKm} ק"מ ממך)
                    </p>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#85e02c' }}>
                      💡 {rec.matchReason}
                    </p>
                    <button
                      type="button"
                      className="btn"
                      disabled={reservingId === rec.station.id || hasActiveBooking}
                      onClick={() => handleReserveStation(rec.station)}
                      style={{ cursor: hasActiveBooking ? 'not-allowed' : 'pointer', opacity: hasActiveBooking ? 0.5 : 1 }}
                    >
                      {reservingId === rec.station.id ? 'משריין עמדה...' : '⚡ שריין עמדה זו (15 דקות)'}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : items.length === 0 ? (
            <p style={{ color: '#aaa' }}>אין עדיין עמדות רשומות במסד הנתונים.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {items.map((station) => (
                <li
                  key={station.id}
                  style={{
                    background: '#121212',
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    border: '1px solid #333',
                  }}
                >
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'white' }}>
                    {station.name}
                  </h3>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#aaa' }}>
                    📍 {station.address}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.85rem', color: '#ccc', marginBottom: '10px' }}>
                    <span>🔌 {station.chargerType} ({station.maxKw} kW)</span>
                    <span>💰 ₪{station.pricePerKwh} לקוט"ש</span>
                    <span>⭐ {station.averageRating !== null ? station.averageRating.toFixed(1) : 'ללא דירוג'} ({station.reviewsCount})</span>
                    <span>📌 {station.currentStatus ?? (station.isActive ? 'זמינה' : 'לא פעילה')}</span>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={!station.isActive || reservingId === station.id || hasActiveBooking}
                    onClick={() => handleReserveStation(station)}
                    style={{ cursor: hasActiveBooking ? 'not-allowed' : 'pointer', opacity: hasActiveBooking ? 0.5 : 1 }}
                  >
                    {reservingId === station.id ? 'משריין עמדה...' : '⚡ שריין עמדה זו (15 דקות)'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}