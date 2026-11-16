import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BatteryCharging } from 'lucide-react';
import { apiFetch } from '../api/apiClient';
import type { Station } from '../store/stations/stationsState';
import type { Vehicle } from '../types/Vehicle';
import PageHeader from './ui/PageHeader';
import StatusBadge from './ui/StatusBadge';
import StationNavigation from './ui/StationNavigation';
import './ui/DriverDashboard.css';

interface ChargeBooking {
  id: number;
  stationId: number;
  stationName: string;
  stationAddress: string;
  vehicleId: number;
  vehicleModel: string;
  status: 'Held' | 'Confirmed' | 'Charging' | 'Completed' | 'Cancelled' | 'Expired';
  currentBatteryPercent: number;
  targetBatteryPercent: number;
  estimatedArrivalTime?: string;
  holdExpiresAt?: string;
  createdAt: string;
  hasReview?: boolean;
}

type HistoryFilter = 'all' | 'completed' | 'inactive';

const ACTIVE_STATUSES = ['Held', 'Confirmed', 'Charging'];

const BOOKING_STEPS = [
  { id: 'Held', label: 'העמדה שמורה' },
  { id: 'Confirmed', label: 'הגעה אושרה' },
  { id: 'Charging', label: 'טעינה פעילה' },
  { id: 'Completed', label: 'סיום ודירוג' },
] as const;

function parseSafeArrivalDate(estimatedArrivalTime: string, createdAt: string): Date {
  const etaMs = new Date(estimatedArrivalTime).getTime();
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(etaMs)) return new Date();

  // תיקון אוטומטי להזמנות ישנות שנשמרו ב-UTC בזמן ש-createdAt נשמר בשעון מקומי
  if (!Number.isNaN(createdMs) && etaMs < createdMs - 30 * 60 * 1000) {
    return new Date(etaMs - new Date().getTimezoneOffset() * 60 * 1000);
  }
  return new Date(etaMs);
}

function getHoldExpirationMs(item: ChargeBooking): number {
  if (item.holdExpiresAt) {
    const parsed = new Date(item.holdExpiresAt).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  const createdMs = new Date(item.createdAt).getTime();
  return (Number.isNaN(createdMs) ? Date.now() : createdMs) + 15 * 60 * 1000;
}

function formatHebrewDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function ActiveSessionScreen() {
  const [booking, setBooking] = useState<ChargeBooking | null>(null);
  const [historyBookings, setHistoryBookings] = useState<ChargeBooking[]>([]);
  const [stationsById, setStationsById] = useState<Record<number, Station>>({});
  const [vehiclesById, setVehiclesById] = useState<Record<number, Vehicle>>({});
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadBookingsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [bookingsRes, stationsRes, vehiclesRes] = await Promise.allSettled([
        apiFetch<ChargeBooking[]>('/ChargeBooking/my'),
        apiFetch<Station[]>('/ChargingStations'),
        apiFetch<Vehicle[]>('/UsersVehicles/my'),
      ]);

      if (bookingsRes.status === 'rejected') {
        const msg =
          bookingsRes.reason instanceof Error
            ? bookingsRes.reason.message
            : 'שגיאה בטעינת ההזמנות';
        setError(msg);
        return;
      }

      const myBookings = bookingsRes.value;
      const active = myBookings.find((b) => ACTIVE_STATUSES.includes(b.status)) ?? null;
      const history = myBookings
        .filter((b) => !ACTIVE_STATUSES.includes(b.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setBooking(active);
      setHistoryBookings(history);

      if (active && active.status === 'Held') {
        const expiresAtMs = getHoldExpirationMs(active);
        setSecondsLeft(Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)));
      } else {
        setSecondsLeft(0);
      }

      if (stationsRes.status === 'fulfilled') {
        const map: Record<number, Station> = {};
        for (const s of stationsRes.value) {
          map[s.id] = s;
        }
        setStationsById(map);
      }

      if (vehiclesRes.status === 'fulfilled') {
        const map: Record<number, Vehicle> = {};
        for (const v of vehiclesRes.value) {
          map[v.id] = v;
        }
        setVehiclesById(map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת השריון הפעיל');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookingsData();
  }, [loadBookingsData]);

  // טיימר ספירה לאחור מסונכרן לשעון אמיתי (רץ רק כשההזמנה בסטטוס Held)
  useEffect(() => {
    if (!booking || booking.status !== 'Held') return;

    const expiresAtMs = getHoldExpirationMs(booking);
    const updateRemaining = () => {
      setSecondsLeft(Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)));
    };

    updateRemaining();
    const timerId = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(timerId);
  }, [booking]);

  async function changeStatus(newStatus: 'Confirmed' | 'Charging' | 'Completed' | 'Cancelled') {
    if (!booking) return;
    setError(null);
    setUpdating(true);
    try {
      const updated = await apiFetch<ChargeBooking>(
        `/ChargeBooking/${booking.id}/status?status=${newStatus}`,
        { method: 'PATCH' }
      );

      if (newStatus === 'Completed') {
        localStorage.setItem(
          'lastCompletedBooking',
          JSON.stringify({
            bookingId: updated.id,
            stationId: updated.stationId,
            stationName: updated.stationName,
          })
        );
        navigate('/rating');
        return;
      }

      if (newStatus === 'Cancelled') {
        await loadBookingsData();
        return;
      }

      setBooking(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס ההזמנה');
    } finally {
      setUpdating(false);
    }
  }

  function estimateBookingEnergyAndCost(item: ChargeBooking): {
    kwh: number;
    minutes: number | null;
    cost: number | null;
  } {
    const addedPercent = Math.max(0, item.targetBatteryPercent - item.currentBatteryPercent);
    const vehicle = vehiclesById[item.vehicleId];
    const station = stationsById[item.stationId];
    const capacityKwh = vehicle?.batteryCapacityKwh ?? 60;
    const kwh = Math.round(((addedPercent / 100) * capacityKwh) * 10) / 10;
    const minutes =
      station && station.maxKw > 0
        ? Math.max(1, Math.round((kwh / station.maxKw) * 60))
        : null;
    const cost = station ? Math.round(kwh * station.pricePerKwh * 100) / 100 : null;
    return { kwh, minutes, cost };
  }

  function handleRateFromHistory(item: ChargeBooking) {
    localStorage.setItem(
      'lastCompletedBooking',
      JSON.stringify({
        bookingId: item.id,
        stationId: item.stationId,
        stationName: item.stationName,
      })
    );
    navigate('/rating');
  }

  const activeEstimate = useMemo(
    () => (booking ? estimateBookingEnergyAndCost(booking) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [booking, stationsById, vehiclesById]
  );

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'completed') {
      return historyBookings.filter((b) => b.status === 'Completed');
    }
    if (historyFilter === 'inactive') {
      return historyBookings.filter((b) => b.status === 'Cancelled' || b.status === 'Expired');
    }
    return historyBookings;
  }, [historyBookings, historyFilter]);

  const historySummary = useMemo(() => {
    const completed = historyBookings.filter((b) => b.status === 'Completed');
    let totalKwh = 0;
    let totalCost = 0;
    let hasCostData = false;

    for (const item of completed) {
      const addedPercent = Math.max(0, item.targetBatteryPercent - item.currentBatteryPercent);
      const vehicle = vehiclesById[item.vehicleId];
      const station = stationsById[item.stationId];
      const capacityKwh = vehicle?.batteryCapacityKwh ?? 60;
      const kwh = (addedPercent / 100) * capacityKwh;
      totalKwh += kwh;
      if (station) {
        totalCost += kwh * station.pricePerKwh;
        hasCostData = true;
      }
    }

    return {
      totalCount: historyBookings.length,
      completedCount: completed.length,
      totalKwh: Math.round(totalKwh * 10) / 10,
      totalCost: hasCostData ? totalCost.toFixed(2) : null,
    };
  }, [historyBookings, stationsById, vehiclesById]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const isExpiringSoon = booking?.status === 'Held' && secondsLeft > 0 && secondsLeft <= 180;

  const formattedEta = booking?.estimatedArrivalTime
    ? parseSafeArrivalDate(booking.estimatedArrivalTime, booking.createdAt).toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  if (loading) {
    return (
      <div className="dash-page" dir="rtl">
        <div className="ev-card driver-session-content" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ margin: 0, color: 'var(--ev-ink-muted)', fontWeight: 500 }}>
            טוען פרטי שריון והיסטוריית טעינות...
          </p>
        </div>
      </div>
    );
  }

  const currentStepIndex = booking
    ? BOOKING_STEPS.findIndex((step) => step.id === booking.status)
    : -1;
  const activeStation = booking ? stationsById[booking.stationId] : undefined;

  return (
    <div className="dash-page" dir="rtl">
      <PageHeader
        title="הטעינה שלי"
        description="מעקב אחר השריון הפעיל והיסטוריית ההזמנות והטעינות"
        icon={BatteryCharging}
        actions={
          booking && (
            <>
              <span className="ev-badge ev-badge-brand">הזמנה #{booking.id}</span>
              <StatusBadge status={booking.status} />
            </>
          )
        }
      />

      {/* כרטיס שריון / טעינה פעילה */}
      <div className="ev-card driver-session-content">
        {error && <div className="ev-alert-error">{error}</div>}

        {!booking ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 20px',
              background: 'var(--ev-bg)',
              borderRadius: '12px',
              border: '1px solid var(--ev-border)',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: 'var(--ev-ink)' }}>
              אין לך כרגע שריון או טעינה פעילה
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: 'var(--ev-ink-soft)' }}>
              בחרי עמדה מומלצת מהחיפוש כדי לשריין שקע מראש לפני ההגעה.
            </p>
            <button
              type="button"
              className="ev-btn ev-btn-auto"
              onClick={() => navigate('/search')}
            >
              חיפוש עמדת טעינה
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* פרטי עמדה ויעד סוללה */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
                  {booking.stationName}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--ev-ink-muted)' }}>
                  {booking.stationAddress}
                  {booking.vehicleModel ? ` · ${booking.vehicleModel}` : ''}
                </p>
              </div>

              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--ev-ink-soft)' }}>יעד סוללה</div>
                <div className="font-mono-num" style={{ fontSize: '1rem', fontWeight: 700 }}>
                  {booking.currentBatteryPercent}% ← {booking.targetBatteryPercent}%
                </div>
                {activeEstimate && (
                  <div className="tabular-nums" style={{ fontSize: '0.76rem', color: 'var(--ev-ink-muted)', marginTop: '3px' }}>
                    ~{activeEstimate.kwh} kWh
                    {activeEstimate.minutes !== null ? ` · ~${activeEstimate.minutes} דק׳ טעינה` : ''}
                    {activeEstimate.cost !== null ? ` · ~₪${activeEstimate.cost.toFixed(2)}` : ''}
                  </div>
                )}
              </div>
            </div>

            {/* סרגל שלבים */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '8px',
              }}
            >
              {BOOKING_STEPS.map((step, idx) => {
                const isActiveOrDone = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                return (
                  <div key={step.id} style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        height: '6px',
                        borderRadius: '999px',
                        marginBottom: '6px',
                        background: isActiveOrDone ? 'var(--ev-brand)' : '#e2e8f0',
                        transition: 'background-color 0.2s ease',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: isCurrent ? 700 : 500,
                        color: isCurrent
                          ? 'var(--ev-brand)'
                          : isActiveOrDone
                            ? 'var(--ev-ink)'
                            : 'var(--ev-ink-soft)',
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* תצוגת טיימר לשריון פעיל */}
            {booking.status === 'Held' && (
              <div
                style={{
                  padding: '24px 16px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  background: isExpiringSoon ? 'var(--ev-danger-soft)' : 'var(--ev-brand-soft)',
                  border: `1px solid ${
                    isExpiringSoon ? 'var(--ev-danger-border)' : 'var(--ev-brand-border)'
                  }`,
                }}
              >
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: isExpiringSoon ? 'var(--ev-danger)' : 'var(--ev-brand-hover)',
                    marginBottom: '6px',
                  }}
                >
                  {secondsLeft === 0
                    ? 'זמן השריון הסתיים — יש לרענן סטטוס'
                    : isExpiringSoon
                      ? 'השריון עומד לפוג בעוד פחות מ-3 דקות'
                      : 'זמן שנותר להגעה ואישור בעמדה'}
                </div>
                <div
                  className="font-mono-num"
                  style={{
                    fontSize: '2.75rem',
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: isExpiringSoon || secondsLeft === 0 ? 'var(--ev-danger)' : 'var(--ev-ink)',
                  }}
                >
                  {formattedTime}
                </div>
                {formattedEta && (
                  <div
                    className="tabular-nums"
                    style={{
                      marginTop: '8px',
                      fontSize: '0.8rem',
                      color: 'var(--ev-ink-muted)',
                      fontWeight: 500,
                    }}
                  >
                    הגעה מתוכננת (לפי מרחק ומרווח ביטחון): <strong>{formattedEta}</strong>
                  </div>
                )}
                {secondsLeft === 0 && (
                  <button
                    type="button"
                    className="ev-btn ev-btn-secondary ev-btn-auto"
                    style={{ marginTop: '12px' }}
                    onClick={() => void loadBookingsData()}
                  >
                    רענן סטטוס הזמנה
                  </button>
                )}
              </div>
            )}

            {/* ניווט אל העמדה בזמן שהשריון פעיל */}
            {booking.status === 'Held' && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: '#F8FAFC',
                  border: '1px solid var(--ev-border)',
                }}
              >
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--ev-ink)' }}>
                  ניווט אל העמדה
                </div>
                <StationNavigation
                  latitude={activeStation?.latitude}
                  longitude={activeStation?.longitude}
                  address={booking.stationAddress}
                />
              </div>
            )}

            {/* חיווי כשהרכב בשלב טעינה */}
            {booking.status === 'Charging' && (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: 'var(--ev-brand-soft)',
                  border: '1px solid var(--ev-brand-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
                    הטעינה מתבצעת כעת
                    {activeEstimate?.minutes !== null && activeEstimate
                      ? ` (זמן משוער: ~${activeEstimate.minutes} דק׳)`
                      : ''}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--ev-ink-muted)', marginTop: '2px' }}>
                    בסיום הוצאת הכבל לחצי על כפתור הסיום כדי לעדכן את זמינות העמדה.
                  </div>
                </div>
                <span
                  className="font-mono-num"
                  style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ev-brand)' }}
                >
                  {booking.currentBatteryPercent}% ← {booking.targetBatteryPercent}%
                </span>
              </div>
            )}

            {/* כפתורי פעולה */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {booking.status === 'Held' && (
                <button
                  type="button"
                  className="ev-btn"
                  style={{ flex: '1 1 200px' }}
                  disabled={updating}
                  onClick={() => void changeStatus('Confirmed')}
                >
                  {updating ? 'מעדכן...' : 'הגעתי לעמדה (אשר הגעה)'}
                </button>
              )}

              {booking.status === 'Confirmed' && (
                <button
                  type="button"
                  className="ev-btn ev-btn-accent"
                  style={{ flex: '1 1 220px' }}
                  disabled={updating}
                  onClick={() => void changeStatus('Charging')}
                >
                  {updating ? 'מתחיל טעינה...' : 'התחל טעינה'}
                </button>
              )}

              {booking.status === 'Charging' && (
                <button
                  type="button"
                  className="ev-btn"
                  style={{ flex: '1 1 220px' }}
                  disabled={updating}
                  onClick={() => void changeStatus('Completed')}
                >
                  {updating ? 'מסיים...' : 'סיימתי טעינה — עבור לדירוג'}
                </button>
              )}

              <button
                type="button"
                className="ev-btn ev-btn-secondary ev-btn-auto"
                onClick={() => navigate(`/stations/${booking.stationId}`)}
              >
                פרטי תחנה
              </button>

              {(booking.status === 'Held' || booking.status === 'Confirmed') && (
                <button
                  type="button"
                  className="ev-btn ev-btn-danger ev-btn-auto"
                  disabled={updating}
                  onClick={() => void changeStatus('Cancelled')}
                >
                  בטל שריון
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* היסטוריית הזמנות וטעינות */}
      <section className="ev-card driver-session-content" style={{ marginTop: '4px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '18px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
              היסטוריית הזמנות וטעינות
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--ev-ink-muted)' }}>
              מעקב אחר כל הטעינות שהושלמו, הזמנות שבוטלו ודירוגים פתוחים
            </p>
          </div>

          <div className="auth-toggle" style={{ marginBottom: 0 }}>
            {(
              [
                { id: 'all', label: `הכול (${historyBookings.length})` },
                { id: 'completed', label: `הושלמו (${historySummary.completedCount})` },
                { id: 'inactive', label: 'בוטלו / פג תוקף' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`auth-toggle-btn ${historyFilter === tab.id ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => setHistoryFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* כרטיסי סיכום */}
        {historyBookings.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px',
              marginBottom: '18px',
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#F8FAFC',
                border: '1px solid var(--ev-border)',
              }}
            >
              <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>סה״כ הזמנות עבר</div>
              <strong className="tabular-nums" style={{ fontSize: '1.15rem', color: 'var(--ev-ink)' }}>
                {historySummary.totalCount}
              </strong>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#F8FAFC',
                border: '1px solid var(--ev-border)',
              }}
            >
              <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>טעינות שהושלמו</div>
              <strong className="tabular-nums" style={{ fontSize: '1.15rem', color: 'var(--ev-brand)' }}>
                {historySummary.completedCount}
              </strong>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#F8FAFC',
                border: '1px solid var(--ev-border)',
              }}
            >
              <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>
                אנרגיה ועלות מצטברת (אומדן)
              </div>
              <strong className="tabular-nums" style={{ fontSize: '1.05rem', color: 'var(--ev-ink)' }}>
                {historySummary.totalKwh} kWh
                {historySummary.totalCost !== null ? ` · ₪${historySummary.totalCost}` : ''}
              </strong>
            </div>
          </div>
        )}

        {filteredHistory.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '28px 16px',
              borderRadius: '12px',
              background: '#F8FAFC',
              border: '1px solid var(--ev-border)',
              color: 'var(--ev-ink-muted)',
              fontSize: '0.88rem',
            }}
          >
            {historyBookings.length === 0
              ? 'עדיין אין הזמנות קודמות בהיסטוריה שלך.'
              : 'אין הזמנות התואמות לסינון שנבחר.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredHistory.map((item) => {
              const est = estimateBookingEnergyAndCost(item);
              const isCompleted = item.status === 'Completed';
              return (
                <article
                  key={item.id}
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    background: '#F8FAFC',
                    border: '1px solid var(--ev-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
                          {item.stationName}
                        </h3>
                        <span className="tabular-nums" style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>
                          #{item.id}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--ev-ink-muted)', marginTop: '3px' }}>
                        {item.stationAddress}
                        {item.vehicleModel ? ` · ${item.vehicleModel}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <StatusBadge status={item.status} />
                      <span className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)' }}>
                        {formatHebrewDateTime(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--ev-border)',
                    }}
                  >
                    <div
                      className="tabular-nums"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        flexWrap: 'wrap',
                        fontSize: '0.84rem',
                        color: 'var(--ev-ink-muted)',
                      }}
                    >
                      <span>
                        סוללה:{' '}
                        <strong className="font-mono-num" style={{ color: 'var(--ev-ink)' }}>
                          {item.currentBatteryPercent}% ← {item.targetBatteryPercent}%
                        </strong>
                      </span>
                      {isCompleted && (
                        <span>
                          אנרגיה ועלות משוערת:{' '}
                          <strong style={{ color: 'var(--ev-ink)' }}>
                            ~{est.kwh} kWh
                            {est.cost !== null ? ` · ~₪${est.cost.toFixed(2)}` : ''}
                          </strong>
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {isCompleted && !item.hasReview && (
                        <button
                          type="button"
                          className="ev-btn ev-btn-auto"
                          style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                          onClick={() => handleRateFromHistory(item)}
                        >
                          דרג תחנה
                        </button>
                      )}
                      {isCompleted && item.hasReview && (
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#15803d',
                            background: '#dcfce7',
                            padding: '5px 10px',
                            borderRadius: '8px',
                          }}
                        >
                          דורגה ✓
                        </span>
                      )}
                      <button
                        type="button"
                        className="ev-btn ev-btn-secondary ev-btn-auto"
                        style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                        onClick={() => navigate(`/stations/${item.stationId}`)}
                      >
                        פרטי תחנה
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}