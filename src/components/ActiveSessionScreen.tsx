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
  createdAt: string;
}

const ACTIVE_STATUSES = ['Held', 'Confirmed', 'Charging'];

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
        const expiresAtMs = new Date(active.createdAt).getTime() + 15 * 60 * 1000;
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
        // שומרים את פרטי ההזמנה והתחנה עבור מסך הדירוג ודיווח התקלות
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

  if (loading) {
    return (
      <div className="container" dir="rtl">
        <div className="screen-view" style={{ textAlign: 'center', padding: '40px', color: 'white' }}>
          <p>⏳ טוען פרטי שריון פעיל...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        <div className="screen-header">
          <span>ניווט ושריון עמדה בזמן אמת</span>
        </div>

        <div style={{ maxWidth: '550px', margin: '0 auto', textAlign: 'center' }}>
          {error && (
            <div style={{ background: '#ff4d4d', color: 'white', padding: '10px', borderRadius: '6px', marginBottom: '15px' }}>
              {error}
            </div>
          )}

          {!booking ? (
            <div style={{ background: '#121212', padding: '30px', borderRadius: '16px', border: '1px solid #333', color: 'white' }}>
              <p style={{ color: '#aaa', marginBottom: '20px' }}>אין לך כרגע שריון או טעינה פעילה.</p>
              <button type="button" className="btn" onClick={() => navigate('/search')} style={{ cursor: 'pointer' }}>
                🔍 חפש עמדה לשריון
              </button>
            </div>
          ) : (
            <div style={{ background: '#121212', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
              <h3 style={{ marginTop: 0, color: 'var(--light-blue)', fontSize: '1.2rem' }}>
                {booking.stationName}
              </h3>
              <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px' }}>
                📍 {booking.stationAddress} | 🚗 {booking.vehicleModel}
              </p>
              <p style={{ color: 'var(--primary)', fontWeight: 'bold', marginBottom: '18px' }}>
                סטטוס נוכחי: {booking.status} ({booking.currentBatteryPercent}% → {booking.targetBatteryPercent}%)
              </p>

              {booking.status === 'Held' && (
                <div style={{
                  width: '140px',
                  height: '140px',
                  margin: '16px auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  border: '8px solid var(--light-blue)',
                  boxShadow: '0 0 15px rgba(125, 211, 252, 0.3)',
                }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--light-blue)' }}>
                    {formattedTime}
                  </span>
                </div>
              )}

              {booking.status === 'Held' && (
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(booking.stationAddress)}&navigate=yes`}
                target="_blank"
                rel="noreferrer"
                className="btn"
                style={{ display: 'block', textDecoration: 'none', background: 'var(--green-dark)', marginTop: '15px', padding: '12px' }}
              >
                🗺️ פתח ניווט ב-Waze
              </a>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                {booking.status === 'Held' && (
                  <button type="button" className="btn" disabled={updating} onClick={() => changeStatus('Confirmed')} style={{ cursor: 'pointer' }}>
                    ✅ הגעתי לעמדה (אשר הגעה)
                  </button>
                )}

                {booking.status === 'Confirmed' && (
                  <button type="button" className="btn" disabled={updating} onClick={() => changeStatus('Charging')} style={{ cursor: 'pointer' }}>
                    ⚡ התחל טעינה
                  </button>
                )}

                {booking.status === 'Charging' && (
                  <button type="button" className="btn" disabled={updating} onClick={() => changeStatus('Completed')} style={{ cursor: 'pointer' }}>
                    🏁 סיימתי טעינה ➔ עבור לדירוג ודיווח
                  </button>
                )}

                {(booking.status === 'Held' || booking.status === 'Confirmed') && (
                  <button
                    type="button"
                    className="btn"
                    disabled={updating}
                    onClick={() => changeStatus('Cancelled')}
                    style={{ background: '#7f1d1d', cursor: 'pointer' }}
                  >
                    ❌ בטל שריון
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}