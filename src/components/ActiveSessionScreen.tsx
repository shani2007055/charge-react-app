import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/apiClient';

interface ChargeBooking {
  id: number;
  stationId: number;
  stationName: string;
  stationAddress: string;
  vehicleModel: string;
  status: 'Held' | 'Confirmed' | 'Charging' | 'Completed' | 'Cancelled' | 'Expired';
  currentBatteryPercent: number;
  targetBatteryPercent: number;
  estimatedArrivalTime?: string;
  holdExpiresAt?: string;
  createdAt: string;
}

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

export default function ActiveSessionScreen() {
  const [booking, setBooking] = useState<ChargeBooking | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function loadActiveBooking() {
    try {
      setLoading(true);
      setError(null);
      const myBookings = await apiFetch<ChargeBooking[]>('/ChargeBooking/my');
      const active = myBookings.find((b) => ACTIVE_STATUSES.includes(b.status)) ?? null;
      setBooking(active);
      if (active) {
        const expiresAtMs = active.holdExpiresAt
          ? new Date(active.holdExpiresAt).getTime()
          : new Date(active.createdAt).getTime() + 15 * 60 * 1000;
        const remainingSec = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
        setSecondsLeft(remainingSec);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת השריון הפעיל');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActiveBooking();
  }, []);

  // טיימר ספירה לאחור עם Cleanup (רץ רק כשההזמנה בסטטוס Held)
  useEffect(() => {
    if (!booking || booking.status !== 'Held') return;

    const timerId = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timerId);
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
        setBooking(null);
        return;
      }

      setBooking(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס ההזמנה');
    } finally {
      setUpdating(false);
    }
  }

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
      <div className="container" dir="rtl">
        <div className="ev-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ margin: 0, color: 'var(--ev-ink-muted)', fontWeight: 500 }}>
            טוען פרטי שריון פעיל...
          </p>
        </div>
      </div>
    );
  }

  const currentStepIndex = booking
    ? BOOKING_STEPS.findIndex((step) => step.id === booking.status)
    : -1;

  return (
    <div className="container" dir="rtl">
      <div className="ev-card" style={{ maxWidth: '680px', margin: '0 auto', padding: '28px' }}>
        <div className="screen-header">
          <div>
            <div>ניווט ושריון עמדה בזמן אמת</div>
            <p className="ev-subtitle">מעקב הגעה, התחלת טעינה וסיום מסודר</p>
          </div>
          {booking && (
            <span
              className="font-mono-num"
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--ev-brand)',
              }}
            >
              הזמנה #{booking.id}
            </span>
          )}
        </div>

        {error && <div className="ev-alert-error">{error}</div>}

        {!booking ? (
          <div
            style={{
              textAlign: 'center',
              padding: '36px 20px',
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
                  {isExpiringSoon
                    ? 'השריון עומד לפוג בעוד פחות מ-3 דקות'
                    : 'זמן שנותר להגעה ואישור בעמדה'}
                </div>
                <div
                  className="font-mono-num"
                  style={{
                    fontSize: '2.75rem',
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: isExpiringSoon ? 'var(--ev-danger)' : 'var(--ev-ink)',
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
                <>
                  <a
                    href={`https://waze.com/ul?q=${encodeURIComponent(booking.stationAddress)}&navigate=yes`}
                    target="_blank"
                    rel="noreferrer"
                    className="ev-btn ev-btn-secondary"
                    style={{ flex: '1 1 180px', textDecoration: 'none' }}
                  >
                    פתח ניווט ב-Waze
                  </a>
                  <button
                    type="button"
                    className="ev-btn"
                    style={{ flex: '1 1 180px' }}
                    disabled={updating}
                    onClick={() => changeStatus('Confirmed')}
                  >
                    {updating ? 'מעדכן...' : 'הגעתי לעמדה (אשר הגעה)'}
                  </button>
                </>
              )}

              {booking.status === 'Confirmed' && (
                <button
                  type="button"
                  className="ev-btn ev-btn-accent"
                  style={{ flex: '1 1 220px' }}
                  disabled={updating}
                  onClick={() => changeStatus('Charging')}
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
                  onClick={() => changeStatus('Completed')}
                >
                  {updating ? 'מסיים...' : 'סיימתי טעינה — עבור לדירוג'}
                </button>
              )}

              {(booking.status === 'Held' || booking.status === 'Confirmed') && (
                <button
                  type="button"
                  className="ev-btn ev-btn-danger ev-btn-auto"
                  disabled={updating}
                  onClick={() => changeStatus('Cancelled')}
                >
                  בטל שריון
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}