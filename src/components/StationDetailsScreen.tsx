import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import { apiFetch } from '../api/apiClient';
import { useDriverGps } from '../hooks/useDriverGps';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setSearchBattery,
  setSelectedVehicle,
} from '../store/stations/stationsSlice';
import type { Station } from '../store/stations/stationsState';
import type { Vehicle } from '../types/Vehicle';
import StationsMap, { type MapStationItem } from './StationsMap';
import PageHeader from './ui/PageHeader';
import StationMetrics from './ui/StationMetrics';
import StationNavigation from './ui/StationNavigation';
import StatusBadge from './ui/StatusBadge';
import './ui/DriverDashboard.css';

interface ReviewItem {
  id: number;
  chargeBookingId: number;
  stationId: number;
  stationName: string;
  driverId: number;
  driverName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface StationStatusLogItem {
  id: number;
  stationId: number;
  stationName: string;
  status: string;
  currentDriverId: number | null;
  currentDriverName: string | null;
  updatedAt: string;
}

interface BookingStatusOnly {
  status: string;
}

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

function formatHebrewDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function StationDetailsScreen() {
  const { id } = useParams<{ id: string }>();
  const stationId = Number(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const {
    selectedVehicleId,
    currentBatteryPercent,
    targetBatteryPercent,
  } = useAppSelector((state) => state.stations);

  const {
    driverLocation,
    detectingGps,
    gpsError: gpsHint,
    requestLocation,
  } = useDriverGps();

  const [station, setStation] = useState<Station | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [statusLogs, setStatusLogs] = useState<StationStatusLogItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hasActiveBooking, setHasActiveBooking] = useState<boolean>(false);

  const [chosenVehicleId, setChosenVehicleId] = useState<number | null>(selectedVehicleId);
  const [currentBattery, setCurrentBattery] = useState<number>(currentBatteryPercent);
  const [targetBattery, setTargetBattery] = useState<number>(targetBatteryPercent);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reserving, setReserving] = useState<boolean>(false);
  const [reserveError, setReserveError] = useState<string | null>(null);

  useEffect(() => {
    if (!driverLocation) {
      void requestLocation({ silent: true, timeoutMs: 8000, maximumAgeMs: 60000 });
    }
  }, [driverLocation, requestLocation]);

  useEffect(() => {
    if (!Number.isInteger(stationId) || stationId <= 0) {
      setLoadError('מזהה תחנה לא תקין.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadStationDetails() {
      setLoading(true);
      setLoadError(null);

      try {
        const [stationRes, reviewsRes, logsRes, vehiclesRes, bookingsRes] =
          await Promise.allSettled([
            apiFetch<Station>(`/ChargingStations/${stationId}`),
            apiFetch<ReviewItem[]>(`/ReviewsToCharge/station/${stationId}`),
            apiFetch<StationStatusLogItem[]>(`/StationStatusLogs/station/${stationId}`),
            apiFetch<Vehicle[]>('/UsersVehicles/my'),
            apiFetch<BookingStatusOnly[]>('/ChargeBooking/my'),
          ]);

        if (cancelled) return;

        if (stationRes.status === 'rejected') {
          const msg =
            stationRes.reason instanceof Error
              ? stationRes.reason.message
              : 'לא ניתן לטעון את פרטי התחנה.';
          setLoadError(msg);
          setLoading(false);
          return;
        }

        const loadedStation = stationRes.value;
        setStation(loadedStation);

        if (reviewsRes.status === 'fulfilled') {
          const sortedReviews = [...reviewsRes.value].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setReviews(sortedReviews);
        } else {
          setReviews([]);
        }

        if (logsRes.status === 'fulfilled') {
          const sortedLogs = [...logsRes.value]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5);
          setStatusLogs(sortedLogs);
        } else {
          setStatusLogs([]);
        }

        if (vehiclesRes.status === 'fulfilled') {
          const loadedVehicles = vehiclesRes.value;
          setVehicles(loadedVehicles);

          const fromStore = loadedVehicles.find((v) => v.id === selectedVehicleId);
          const compatible = loadedVehicles.find(
            (v) =>
              v.supportedChargerType.trim().toLowerCase() ===
              loadedStation.chargerType.trim().toLowerCase()
          );
          const defaultVehicle = fromStore ?? compatible ?? loadedVehicles[0] ?? null;

          if (defaultVehicle) {
            setChosenVehicleId(defaultVehicle.id);
            if (!fromStore && Number.isFinite(defaultVehicle.currentBattery)) {
              const safeCurrent = Math.min(95, Math.max(5, Math.round(defaultVehicle.currentBattery)));
              setCurrentBattery(safeCurrent);
              setTargetBattery(Math.min(100, Math.max(safeCurrent + 10, 80)));
            }
          }
        } else {
          setVehicles([]);
        }

        if (bookingsRes.status === 'fulfilled') {
          setHasActiveBooking(
            bookingsRes.value.some((b) => ACTIVE_STATUSES.includes(b.status))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'שגיאה בטעינת פרטי התחנה');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStationDetails();

    return () => {
      cancelled = true;
    };
  }, [stationId, selectedVehicleId]);

  const distanceKm = useMemo(() => {
    if (!station || !driverLocation) return null;
    return calculateDistanceKm(
      driverLocation.lat,
      driverLocation.lng,
      station.latitude,
      station.longitude
    );
  }, [station, driverLocation]);

  const eta = useMemo(() => estimateReservationWindow(distanceKm), [distanceKm]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === chosenVehicleId) ?? null,
    [vehicles, chosenVehicleId]
  );

  const isConnectorCompatible = useMemo(() => {
    if (!station || !selectedVehicle) return false;
    return (
      selectedVehicle.supportedChargerType.trim().toLowerCase() ===
      station.chargerType.trim().toLowerCase()
    );
  }, [station, selectedVehicle]);

  const chargingEstimate = useMemo(() => {
    if (!station) return null;
    const neededPercent = Math.max(0, targetBattery - currentBattery);
    const capacityKwh = selectedVehicle?.batteryCapacityKwh ?? 60;
    const kwhNeeded = (neededPercent / 100) * capacityKwh;
    const estimatedMinutes =
      station.maxKw > 0 ? Math.max(1, Math.round((kwhNeeded / station.maxKw) * 60)) : 0;
    const estimatedCost = kwhNeeded * station.pricePerKwh;
    return {
      neededPercent,
      kwhNeeded: Math.round(kwhNeeded * 10) / 10,
      estimatedMinutes,
      estimatedCost: estimatedCost.toFixed(2),
    };
  }, [station, selectedVehicle, currentBattery, targetBattery]);

  const mapStations = useMemo<MapStationItem[]>(() => {
    if (!station) return [];
    return [
      {
        station,
        distanceKm: distanceKm ?? undefined,
        etaMinutes: distanceKm !== null ? eta.totalMinutes : undefined,
      },
    ];
  }, [station, distanceKm, eta.totalMinutes]);

  const submitReservation = useCallback(async () => {
    if (!station) return;
    setReserveError(null);
    setReserving(true);

    try {
      if (!selectedVehicle) {
        throw new Error('יש לבחור רכב רשום (או להוסיף רכב בפרופיל האישי) לפני השריון.');
      }

      if (!station.isActive || station.currentStatus === 'Faulty') {
        throw new Error('העמדה אינה זמינה לשריון כרגע.');
      }

      if (station.isClosedBySchedule) {
        throw new Error(
          station.nextOpenHour != null
            ? `העמדה סגורה כעת ותיפתח בשעה ${String(station.nextOpenHour).padStart(2, '0')}:00.`
            : 'העמדה סגורה כעת לפי שעות הפעילות שקבע הבעלים.'
        );
      }

      if (!isConnectorCompatible) {
        throw new Error(
          `סוג המחבר ברכב (${selectedVehicle.supportedChargerType}) אינו תואם לעמדה (${station.chargerType}).`
        );
      }

      if (
        !Number.isFinite(currentBattery) ||
        !Number.isFinite(targetBattery) ||
        currentBattery < 0 ||
        currentBattery >= 100 ||
        targetBattery <= currentBattery ||
        targetBattery > 100
      ) {
        throw new Error('יש להזין אחוז סוללה נוכחי (0–99%) ויעד טעינה הגבוה ממנו (עד 100%).');
      }

      dispatch(setSelectedVehicle(selectedVehicle.id));
      dispatch(
        setSearchBattery({
          currentBatteryPercent: currentBattery,
          targetBatteryPercent: targetBattery,
        })
      );

      const arrivalTime = toLocalIsoString(new Date(Date.now() + eta.totalMinutes * 60 * 1000));

      await apiFetch('/ChargeBooking', {
        method: 'POST',
        body: JSON.stringify({
          stationId: station.id,
          vehicleId: selectedVehicle.id,
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
      setReserveError(
        msg.includes('403')
          ? 'כדי לשריין עמדה צריך להתחבר בתפקיד נהג (Driver).'
          : msg
      );
    } finally {
      setReserving(false);
    }
  }, [
    station,
    selectedVehicle,
    isConnectorCompatible,
    currentBattery,
    targetBattery,
    eta.totalMinutes,
    dispatch,
    navigate,
  ]);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitReservation();
  };

  if (loading) {
    return (
      <div className="dash-page" dir="rtl">
        <div className="ev-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ margin: 0, color: 'var(--ev-ink-muted)', fontWeight: 500 }}>
            טוען פרטי תחנת טעינה...
          </p>
        </div>
      </div>
    );
  }

  if (loadError || !station) {
    return (
      <div className="dash-page" dir="rtl">
        <div className="ev-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="ev-alert-error" style={{ marginBottom: '16px' }}>
            {loadError ?? 'התחנה לא נמצאה.'}
          </div>
          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            onClick={() => navigate('/results')}
          >
            חזרה לרשימת העמדות
          </button>
        </div>
      </div>
    );
  }

  const isClosedBySchedule = Boolean(station.isClosedBySchedule);
  const nextOpenLabel =
    station.nextOpenHour != null ? `${String(station.nextOpenHour).padStart(2, '0')}:00` : null;

  const isStationUnavailable =
    !station.isActive ||
    isClosedBySchedule ||
    station.currentStatus === 'Faulty' ||
    station.currentStatus === 'Occupied' ||
    station.currentStatus === 'Busy';

  return (
    <div className="dash-page" dir="rtl">
      <PageHeader
        title={station.name}
        description={
          distanceKm !== null
            ? `${station.address} · ${distanceKm} ק"מ ממך (הגעה משוערת ~${eta.travelMinutes} דק׳)`
            : station.address
        }
        icon={MapPin}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <StatusBadge
              status={station.currentStatus ?? (station.isActive ? 'available' : 'inactive')}
              isActive={station.isActive}
            />
            <button
              type="button"
              className="ev-btn ev-btn-secondary ev-btn-auto"
              onClick={() => navigate('/results')}
            >
              חזרה לתוצאות
            </button>
          </div>
        }
      />

      {isClosedBySchedule && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock size={17} />
          <span>
            {nextOpenLabel
              ? `העמדה סגורה כעת לפי שעות הפעילות של הבעלים · תיפתח בשעה ${nextOpenLabel}`
              : 'העמדה סגורה כעת לפי שעות הפעילות של הבעלים.'}
          </span>
        </div>
      )}

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
            קיימת עבורך הזמנה פעילה במערכת. לא ניתן לשריין עמדה נוספת במקביל.
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

      {/* פריסה דו-עמודתית: פרטי תחנה + פאנל שריון ומפה */}
      <div className="results-grid has-map">
        {/* עמודה ראשית: מפרט, פאנל השלמת שריון, ביקורות ולוג סטטוסים */}
        <div className="results-list">
          {/* כרטיס מפרט וניווט */}
          <section className="ev-card" style={{ padding: 'clamp(16px, 3vw, 22px)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
                מפרט טכני וניווט
              </h2>
              <span className="tabular-nums" style={{ fontSize: '0.82rem', color: 'var(--ev-ink-soft)' }}>
                עמדה #{station.id}
              </span>
            </div>

            <StationMetrics station={station} />
            <StationNavigation latitude={station.latitude} longitude={station.longitude} />
          </section>

          {/* כרטיס השלמת תהליך שריון */}
          <section className="ev-card" style={{ padding: 'clamp(16px, 3vw, 22px)' }}>
            <h2
              style={{
                margin: '0 0 6px 0',
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--ev-ink)',
              }}
            >
              השלמת שריון עמדה
            </h2>
            <p style={{ margin: '0 0 18px 0', fontSize: '0.86rem', color: 'var(--ev-ink-muted)' }}>
              בחרו רכב ואחוזי סוללה כדי לחשב זמן טעינה, עלות משוערת וחלון הגעה אוטומטי לפי מרחק.
            </p>

            {reserveError && (
              <div className="ev-alert-error" style={{ marginBottom: '16px' }}>
                {reserveError}
              </div>
            )}

            {vehicles.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#F8FAFC',
                  border: '1px solid var(--ev-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <span style={{ fontSize: '0.88rem', color: 'var(--ev-ink-muted)' }}>
                  לא נמצאו רכבים רשומים בחשבונך. הוסיפו רכב בפרופיל כדי לשריין עמדה.
                </span>
                <button
                  type="button"
                  className="ev-btn ev-btn-secondary ev-btn-auto"
                  onClick={() => navigate('/profile')}
                >
                  מעבר לפרופיל להוספת רכב
                </button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ minWidth: 0 }}>
                  <label className="ev-label" htmlFor="details-vehicle-select">
                    בחירת רכב לשריון
                  </label>
                  <select
                    id="details-vehicle-select"
                    className="ev-input"
                    style={{ maxWidth: '100%' }}
                    value={chosenVehicleId ?? ''}
                    onChange={(e) => {
                      const nextId = Number(e.target.value);
                      setChosenVehicleId(Number.isFinite(nextId) ? nextId : null);
                    }}
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.model} · מחבר {v.supportedChargerType} · {v.batteryCapacityKwh} kWh
                      </option>
                    ))}
                  </select>
                  {selectedVehicle && !isConnectorCompatible && (
                    <div
                      style={{
                        marginTop: '8px',
                        fontSize: '0.82rem',
                        color: 'var(--ev-danger)',
                        fontWeight: 600,
                      }}
                    >
                      שימו לב: מחבר הרכב ({selectedVehicle.supportedChargerType}) אינו תואם למחבר העמדה (
                      {station.chargerType}).
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <div>
                    <label className="ev-label" htmlFor="details-current-battery">
                      סוללה נוכחית (%)
                    </label>
                    <input
                      id="details-current-battery"
                      type="number"
                      min={0}
                      max={99}
                      className="ev-input tabular-nums"
                      value={currentBattery}
                      onChange={(e) => setCurrentBattery(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="ev-label" htmlFor="details-target-battery">
                      יעד טעינה (%)
                    </label>
                    <input
                      id="details-target-battery"
                      type="number"
                      min={1}
                      max={100}
                      className="ev-input tabular-nums"
                      value={targetBattery}
                      onChange={(e) => setTargetBattery(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* סיכום אומדנים */}
                {chargingEstimate && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                      gap: '10px',
                      padding: '14px',
                      borderRadius: '12px',
                      background: '#F8FAFC',
                      border: '1px solid var(--ev-border)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ev-ink-soft)' }}>
                        חלון שמירת עמדה
                      </div>
                      {distanceKm !== null ? (
                        <>
                          <strong className="tabular-nums" style={{ fontSize: '0.96rem', color: 'var(--ev-ink)' }}>
                            {eta.totalMinutes} דק׳
                          </strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--ev-ink-muted)' }}>
                            אוטומטי ({distanceKm} ק&quot;מ: ~{eta.travelMinutes} + {eta.bufferMinutes} מרווח)
                          </div>
                        </>
                      ) : (
                        <>
                          <strong style={{ fontSize: '0.92rem', color: 'var(--ev-ink)' }}>
                            אוטומטי (10–30 דק׳)
                          </strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--ev-ink-muted)' }}>
                            מחושב לפי מרחק ה-GPS שלך מהתחנה
                          </div>
                          <button
                            type="button"
                            className="ev-btn ev-btn-secondary ev-btn-auto"
                            style={{ marginTop: '6px', padding: '4px 9px', fontSize: '0.74rem' }}
                            disabled={detectingGps}
                            onClick={() => void requestLocation()}
                          >
                            {detectingGps ? 'מאתר מיקום...' : 'חשב לפי GPS'}
                          </button>
                        </>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ev-ink-soft)' }}>
                        אנרגיה נדרשת
                      </div>
                      <strong className="tabular-nums" style={{ fontSize: '0.96rem', color: 'var(--ev-ink)' }}>
                        {chargingEstimate.kwhNeeded} kWh
                      </strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ev-ink-muted)' }}>
                        +{chargingEstimate.neededPercent}% סוללה
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ev-ink-soft)' }}>
                        זמן טעינה משוער
                      </div>
                      <strong className="tabular-nums" style={{ fontSize: '0.96rem', color: 'var(--ev-ink)' }}>
                        ~{chargingEstimate.estimatedMinutes} דק׳
                      </strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ev-ink-muted)' }}>
                        בהספק {station.maxKw} kW
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ev-ink-soft)' }}>
                        עלות משוערת
                      </div>
                      <strong className="tabular-nums" style={{ fontSize: '0.96rem', color: 'var(--ev-brand)' }}>
                        ₪{chargingEstimate.estimatedCost}
                      </strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ev-ink-muted)' }}>
                        ₪{station.pricePerKwh.toFixed(2)} לקוט&quot;ש
                      </div>
                    </div>
                  </div>
                )}

                {gpsHint && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--ev-ink-muted)' }}>
                    {gpsHint}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    className="ev-btn ev-btn-secondary ev-btn-auto"
                    style={{ flex: '1 1 150px' }}
                    onClick={() => navigate('/search')}
                  >
                    עדכון נתוני חיפוש
                  </button>
                  <button
                    type="submit"
                    className="ev-btn ev-btn-auto"
                    style={{ flex: '2 1 220px' }}
                    disabled={
                      reserving ||
                      hasActiveBooking ||
                      isStationUnavailable ||
                      !isConnectorCompatible
                    }
                  >
                    {reserving
                      ? 'משריין עמדה...'
                      : hasActiveBooking
                        ? 'קיימת הזמנה פעילה'
                        : isClosedBySchedule
                          ? nextOpenLabel
                            ? `סגורה כעת · תיפתח ב-${nextOpenLabel}`
                            : 'העמדה סגורה כעת לפי לו״ז'
                          : isStationUnavailable
                            ? 'העמדה אינה פנויה לשריון'
                            : distanceKm !== null
                              ? `שריין עמדה עכשיו (שמירה ל-${eta.totalMinutes} דק׳)`
                              : 'שריין עמדה עכשיו (שמירה אוטומטית)'}
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* ביקורות נהגים */}
          <section className="ev-card" style={{ padding: 'clamp(16px, 3vw, 22px)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '14px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
                ביקורות נהגים ({reviews.length})
              </h2>
              <span className="tabular-nums" style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ev-brand)' }}>
                {station.averageRating !== null
                  ? `ממוצע ${station.averageRating.toFixed(1)} / 5`
                  : 'טרם דורגה'}
              </span>
            </div>

            {reviews.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ev-ink-muted)' }}>
                עדיין לא נכתבו ביקורות לתחנה זו. לאחר סיום טעינה תוכלו להיות הראשונים לדרג!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reviews.map((rev) => (
                  <article
                    key={rev.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: '#F8FAFC',
                      border: '1px solid var(--ev-border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <strong style={{ fontSize: '0.9rem', color: 'var(--ev-ink)' }}>
                        {rev.driverName || 'נהג במערכת'}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          className="tabular-nums"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: 'var(--ev-brand)',
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          {rev.rating.toFixed(1)}
                        </span>
                        <span className="tabular-nums" style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>
                          {formatHebrewDateTime(rev.createdAt)}
                        </span>
                      </div>
                    </div>
                    {rev.comment && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.86rem', color: 'var(--ev-ink-muted)' }}>
                        {rev.comment}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* היסטוריית סטטוסים ודיווחי תקלות */}
          <section className="ev-card" style={{ padding: 'clamp(16px, 3vw, 22px)' }}>
            <h2
              style={{
                margin: '0 0 12px 0',
                fontSize: '1.08rem',
                fontWeight: 700,
                color: 'var(--ev-ink)',
              }}
            >
              עדכוני סטטוס אחרונים
            </h2>

            {statusLogs.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ev-ink-muted)' }}>
                אין היסטוריית שינויי סטטוס מתועדת לתחנה זו.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {statusLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: '#F8FAFC',
                      border: '1px solid var(--ev-border)',
                    }}
                  >
                    <StatusBadge status={log.status} />
                    <span className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)' }}>
                      {formatHebrewDateTime(log.updatedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* עמודה צדדית: מפה ממוקדת של התחנה */}
        <aside className="ev-card results-map-panel">
          <StationsMap
            stations={mapStations}
            driverLocation={driverLocation}
            hasActiveBooking={hasActiveBooking}
            reservingId={reserving ? station.id : null}
            selectedStationId={station.id}
            onReserve={() => void submitReservation()}
          />
        </aside>
      </div>
    </div>
  );
}