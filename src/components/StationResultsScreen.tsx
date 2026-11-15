import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { apiFetch } from '../api/apiClient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSelectedVehicle } from '../store/stations/stationsSlice';
import type { Station } from '../store/stations/stationsState';
import { fetchStations } from '../store/stations/stationsThunks';
import type { Vehicle } from '../types/Vehicle';
import StationsMap, { type MapStationItem } from './StationsMap';
import PageHeader from './ui/PageHeader';
import StationMetrics from './ui/StationMetrics';
import StationNavigation from './ui/StationNavigation';
import './ui/DriverDashboard.css';

interface BookingStatusOnly {
  status: string;
}

type QuickFilter = 'all' | 'available' | 'fast' | 'cheap';

const ACTIVE_STATUSES = ['Held', 'Confirmed', 'Charging'];

function toLocalIsoString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

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
  return Math.round(r * c * 10) / 10;
}

function estimateReservationWindow(distanceKm: number | null): {
  travelMinutes: number;
  bufferMinutes: number;
  totalMinutes: number;
} {
  const bufferMinutes = 5;
  const travelMinutes = distanceKm !== null ? Math.max(3, Math.round(distanceKm * 1.8)) : 10;
  const totalMinutes = Math.min(30, Math.max(10, travelMinutes + bufferMinutes));
  return { travelMinutes, bufferMinutes, totalMinutes };
}

export default function StationResultsScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    items,
    recommendations,
    hasSearched,
    currentBatteryPercent,
    targetBatteryPercent,
    driverLocation,
    selectedVehicleId,
    loading,
    error,
  } = useAppSelector((state) => state.stations);

  const [bookingError, setBookingError] = useState<string | null>(null);
  const [hasActiveBooking, setHasActiveBooking] = useState<boolean>(false);
  const [reservingId, setReservingId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  useEffect(() => {
    if (!hasSearched) {
      void dispatch(fetchStations());
    }

    async function checkActiveBooking() {
      try {
        const myBookings = await apiFetch<BookingStatusOnly[]>('/ChargeBooking/my');
        setHasActiveBooking(myBookings.some((b) => ACTIVE_STATUSES.includes(b.status)));
      } catch {
        // המשתמש אינו נהג
      }
    }
    void checkActiveBooking();
  }, [dispatch, hasSearched]);

  const handleReserveStation = useCallback(
    async (station: Station, explicitDistanceKm?: number) => {
      setBookingError(null);
      setReservingId(station.id);

      try {
        const vehicles = await apiFetch<Vehicle[]>('/UsersVehicles/my');
        let vehicle = vehicles.find((v) => v.id === selectedVehicleId);

        if (!vehicle && selectedVehicleId === null) {
          const compatible = vehicles.filter(
            (v) =>
              v.supportedChargerType.trim().toLowerCase() ===
              station.chargerType.trim().toLowerCase()
          );
          if (compatible.length === 1) {
            vehicle = compatible[0];
            dispatch(setSelectedVehicle(vehicle.id));
          } else if (vehicles.length === 1) {
            vehicle = vehicles[0];
            dispatch(setSelectedVehicle(vehicle.id));
          }
        }

        if (!vehicle) {
          throw new Error(
            vehicles.length === 0
              ? 'לא נמצא רכב רשום. יש להוסיף רכב בפרופיל האישי לפני השריון.'
              : 'יש לבחור רכב במסך החיפוש או במסך פרטי התחנה לפני השריון.'
          );
        }

        if (!station.isActive) {
          throw new Error('העמדה אינה פעילה כרגע.');
        }

        if (
          vehicle.supportedChargerType.trim().toLowerCase() !==
          station.chargerType.trim().toLowerCase()
        ) {
          throw new Error('סוג מחבר העמדה אינו תואם למחבר הרכב הנבחר.');
        }

        const currentBattery = currentBatteryPercent;
        const targetBattery = targetBatteryPercent;

        if (
          !Number.isFinite(currentBattery) ||
          !Number.isFinite(targetBattery) ||
          currentBattery < 0 ||
          currentBattery >= 100 ||
          targetBattery <= currentBattery ||
          targetBattery > 100
        ) {
          throw new Error('נתוני הסוללה אינם תקינים.');
        }

        const distanceKm =
          typeof explicitDistanceKm === 'number'
            ? explicitDistanceKm
            : driverLocation
              ? calculateDistanceKm(
                  driverLocation.lat,
                  driverLocation.lng,
                  station.latitude,
                  station.longitude
                )
              : null;

        const { totalMinutes } = estimateReservationWindow(distanceKm);
        const arrivalTime = toLocalIsoString(new Date(Date.now() + totalMinutes * 60 * 1000));

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
    },
    [
      selectedVehicleId,
      currentBatteryPercent,
      targetBatteryPercent,
      driverLocation,
      dispatch,
      navigate,
    ]
  );

  const matchesQuickFilter = useCallback(
    (station: Station) => {
      if (quickFilter === 'available') {
        return station.isActive && station.currentStatus !== 'Faulty' && station.currentStatus !== 'Busy';
      }
      if (quickFilter === 'fast') {
        return station.maxKw >= 50;
      }
      if (quickFilter === 'cheap') {
        return station.pricePerKwh <= 1.6;
      }
      return true;
    },
    [quickFilter]
  );

  const filteredRecommendations = useMemo(
    () => recommendations.filter((rec) => matchesQuickFilter(rec.station)),
    [recommendations, matchesQuickFilter]
  );

  const filteredItems = useMemo(
    () => items.filter((station) => matchesQuickFilter(station)),
    [items, matchesQuickFilter]
  );

  const mapStations = useMemo<MapStationItem[]>(() => {
    if (hasSearched) {
      return filteredRecommendations.map((rec) => ({
        station: rec.station,
        distanceKm: rec.distanceKm,
        matchPercentage: rec.matchPercentage,
        etaMinutes: estimateReservationWindow(rec.distanceKm).totalMinutes,
      }));
    }
    return filteredItems.map((station) => {
      const distanceKm = driverLocation
        ? calculateDistanceKm(
            driverLocation.lat,
            driverLocation.lng,
            station.latitude,
            station.longitude
          )
        : undefined;
      return {
        station,
        distanceKm,
        etaMinutes:
          distanceKm !== undefined
            ? estimateReservationWindow(distanceKm).totalMinutes
            : undefined,
      };
    });
  }, [hasSearched, filteredRecommendations, filteredItems, driverLocation]);

  const handleFocusOnMap = (stationId: number) => {
    setShowMap(true);
    setSelectedStationId(stationId);
  };

  if (loading) {
    return (
      <div className="container" dir="rtl">
        <div className="ev-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ margin: 0, color: 'var(--ev-ink-muted)', fontWeight: 500 }}>
            טוען עמדות טעינה מהשרת...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" dir="rtl">
        <div className="ev-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="ev-alert-error" style={{ marginBottom: 0 }}>
            שגיאה בטעינת העמדות: {error}
          </div>
        </div>
      </div>
    );
  }

  const displayedCount = hasSearched ? filteredRecommendations.length : filteredItems.length;
  const canRenderMap = showMap && (mapStations.length > 0 || driverLocation !== null);

  return (
    <div className="dash-page" dir="rtl">
      <PageHeader
        title="עמדות טעינה"
        description={
          hasSearched
            ? 'עמדות טעינה המותאמות לנתוני החיפוש שלך'
            : 'גלו את עמדות הטעינה הזמינות במערכת'
        }
        icon={MapPin}
      />

      {/* סרגל פעולות ופילטרים מהירים */}
      <div
        className="ev-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            onClick={() => navigate('/search')}
          >
            חזרה לחיפוש
          </button>

          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
              {hasSearched ? 'המלצות מותאמות אישית' : 'כל עמדות הטעינה במערכת'}
            </div>
            <div className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)' }}>
              מציג {displayedCount} עמדות
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="auth-toggle" style={{ marginBottom: 0 }}>
            {(
              [
                { id: 'all', label: 'הכול' },
                { id: 'available', label: 'פנויות' },
                { id: 'fast', label: 'מהירות 50kW+' },
                { id: 'cheap', label: 'עד ₪1.6' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`auth-toggle-btn ${quickFilter === tab.id ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => setQuickFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {hasSearched && (
            <button
              type="button"
              className="ev-btn ev-btn-secondary ev-btn-auto"
              onClick={() => {
                setQuickFilter('all');
                setSelectedStationId(null);
                void dispatch(fetchStations());
              }}
            >
              כל העמדות
            </button>
          )}

          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            onClick={() => setShowMap((prev) => !prev)}
          >
            {showMap ? 'הסתר מפה' : 'הצג מפה'}
          </button>
        </div>
      </div>

      {hasActiveBooking && (
        <div
          className="ev-alert-brand"
          style={{
            marginBottom: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span style={{ fontWeight: 500 }}>
            קיימת עבורך הזמנה פתוחה במערכת. לא ניתן לשריין עמדה נוספת במקביל.
          </span>
          <button
            type="button"
            className="ev-btn ev-btn-accent ev-btn-auto"
            onClick={() => navigate('/active')}
          >
            עבור להזמנה הפעילה שלי
          </button>
        </div>
      )}

      {bookingError && (
        <div className="ev-alert-error" style={{ marginBottom: 0 }}>
          <div>{bookingError}</div>
          {hasActiveBooking && (
            <button
              type="button"
              className="ev-btn ev-btn-auto"
              style={{ marginTop: '10px' }}
              onClick={() => navigate('/active')}
            >
              צפה בהזמנה הפעילה / בטל שריון
            </button>
          )}
        </div>
      )}

      {/* פריסת Split-View: רשימת עמדות + מפה בהירה */}
      <div className={`results-grid ${canRenderMap ? 'has-map' : ''}`}>
        {/* רשימת עמדות */}
        <div className="results-list">
          {hasSearched ? (
            filteredRecommendations.length === 0 ? (
              <div className="ev-card" style={{ textAlign: 'center', padding: '32px' }}>
                <p style={{ margin: '0 0 12px 0', color: 'var(--ev-ink-muted)', fontSize: '0.9rem' }}>
                  לא נמצאו עמדות מתאימות לטווח ולסינונים שבחרת.
                </p>
                {quickFilter !== 'all' && (
                  <button
                    type="button"
                    className="ev-btn ev-btn-secondary ev-btn-auto"
                    onClick={() => setQuickFilter('all')}
                  >
                    נקה פילטר מהיר
                  </button>
                )}
              </div>
            ) : (
              filteredRecommendations.map((rec) => {
                const eta = estimateReservationWindow(rec.distanceKm);
                const isSelected = selectedStationId === rec.station.id;
                return (
                  <div
                    key={rec.station.id}
                    className="ev-card station-result-card"
                    style={{
                      padding: '18px 20px',
                      borderColor: isSelected
                        ? 'var(--ev-brand)'
                        : rec.isEmergencyMode
                          ? 'var(--ev-danger-border)'
                          : undefined,
                      background: rec.isEmergencyMode ? 'var(--ev-danger-soft)' : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '1.05rem',
                            fontWeight: 700,
                            color: 'var(--ev-ink)',
                          }}
                        >
                          {rec.station.name}
                        </h3>
                        <div
                          className="tabular-nums"
                          style={{ fontSize: '0.82rem', color: 'var(--ev-ink-muted)', marginTop: '4px' }}
                        >
                          {rec.station.address} · {rec.distanceKm} ק&quot;מ ממך · הגעה משוערת ~
                          {eta.travelMinutes} דק&apos; (+{eta.bufferMinutes} דק&apos; מרווח)
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'var(--ev-brand-soft)',
                          border: '1px solid var(--ev-brand-border)',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          textAlign: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          className="font-mono-num"
                          style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ev-brand)' }}
                        >
                          {rec.matchPercentage}%
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--ev-ink-soft)' }}>התאמה</div>
                      </div>
                    </div>

                    <p
                      style={{
                        margin: '10px 0 0 0',
                        fontSize: '0.84rem',
                        color: 'var(--ev-brand-hover)',
                        fontWeight: 500,
                      }}
                    >
                      {rec.matchReason}
                    </p>

                    <StationMetrics station={rec.station} />
                    <StationNavigation
                      latitude={rec.station.latitude}
                      longitude={rec.station.longitude}
                    />

                    <div
                      style={{
                        marginTop: '14px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--ev-surface-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <span
                        className="tabular-nums"
                        style={{ fontSize: '0.82rem', color: 'var(--ev-ink-muted)', fontWeight: 500 }}
                      >
                        {rec.station.chargerType} · {rec.station.maxKw} kW · ₪
                        {rec.station.pricePerKwh} לקוט&quot;ש
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="ev-btn ev-btn-secondary ev-btn-auto"
                          onClick={() => navigate(`/stations/${rec.station.id}`)}
                        >
                          פרטי תחנה
                        </button>
                        <button
                          type="button"
                          className="ev-btn ev-btn-secondary ev-btn-auto"
                          onClick={() => handleFocusOnMap(rec.station.id)}
                        >
                          הצג במפה
                        </button>
                        <button
                          type="button"
                          className="ev-btn ev-btn-auto"
                          disabled={reservingId === rec.station.id || hasActiveBooking}
                          onClick={() => void handleReserveStation(rec.station, rec.distanceKm)}
                        >
                          {reservingId === rec.station.id
                            ? 'משריין עמדה...'
                            : `שריין עמדה (הגעה ~${eta.totalMinutes} דק׳)`}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : filteredItems.length === 0 ? (
            <div className="ev-card" style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ margin: '0 0 12px 0', color: 'var(--ev-ink-muted)', fontSize: '0.9rem' }}>
                {items.length === 0
                  ? 'אין עדיין עמדות רשומות במסד הנתונים.'
                  : 'אין עמדות התואמות לסינון הנוכחי.'}
              </p>
              {quickFilter !== 'all' && (
                <button
                  type="button"
                  className="ev-btn ev-btn-secondary ev-btn-auto"
                  onClick={() => setQuickFilter('all')}
                >
                  נקה פילטר מהיר
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((station) => {
              const isFaulty = !station.isActive || station.currentStatus === 'Faulty';
              const isSelected = selectedStationId === station.id;
              const distKm = driverLocation
                ? calculateDistanceKm(
                    driverLocation.lat,
                    driverLocation.lng,
                    station.latitude,
                    station.longitude
                  )
                : null;
              const eta = estimateReservationWindow(distKm);

              return (
                <div
                  key={station.id}
                  className="ev-card station-result-card"
                  style={{
                    borderColor: isSelected ? 'var(--ev-brand)' : undefined,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: 'var(--ev-ink)',
                        }}
                      >
                        {station.name}
                      </h3>
                      <div
                        className="tabular-nums"
                        style={{ fontSize: '0.82rem', color: 'var(--ev-ink-muted)', marginTop: '4px' }}
                      >
                        {station.address}
                        {distKm !== null && ` · ${distKm} ק"מ ממך (הגעה ~${eta.travelMinutes} דק')`}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: isFaulty ? 'var(--ev-danger)' : 'var(--ev-brand)',
                      }}
                    >
                      {station.currentStatus ?? (station.isActive ? 'זמינה' : 'לא פעילה')}
                    </span>
                  </div>

                  <StationMetrics station={station} />
                  <StationNavigation
                    latitude={station.latitude}
                    longitude={station.longitude}
                  />

                  <div
                    style={{
                      marginTop: '14px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--ev-surface-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <span
                      className="tabular-nums"
                      style={{ fontSize: '0.82rem', color: 'var(--ev-ink-muted)', fontWeight: 500 }}
                    >
                      {station.chargerType} ({station.maxKw} kW) · ₪{station.pricePerKwh} לקוט&quot;ש ·
                      דירוג {station.averageRating !== null ? station.averageRating.toFixed(1) : 'חדשה'} (
                      {station.reviewsCount})
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="ev-btn ev-btn-secondary ev-btn-auto"
                        onClick={() => navigate(`/stations/${station.id}`)}
                      >
                        פרטי תחנה
                      </button>
                      <button
                        type="button"
                        className="ev-btn ev-btn-secondary ev-btn-auto"
                        onClick={() => handleFocusOnMap(station.id)}
                      >
                        הצג במפה
                      </button>
                      <button
                        type="button"
                        className="ev-btn ev-btn-auto"
                        disabled={!station.isActive || reservingId === station.id || hasActiveBooking}
                        onClick={() => void handleReserveStation(station, distKm ?? undefined)}
                      >
                        {reservingId === station.id
                          ? 'משריין עמדה...'
                          : distKm !== null
                            ? `שריין עמדה (הגעה ~${eta.totalMinutes} דק׳)`
                            : 'שריין עמדה'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* מפה בהירה */}
        {canRenderMap && (
          <div className="ev-card results-map-panel">
            <StationsMap
              stations={mapStations}
              driverLocation={driverLocation}
              hasActiveBooking={hasActiveBooking}
              reservingId={reservingId}
              selectedStationId={selectedStationId}
              onReserve={(station, distanceKm) => void handleReserveStation(station, distanceKm)}
              onOpenDetails={(station) => navigate(`/stations/${station.id}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}