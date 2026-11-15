import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { addCommunityPoints } from '../store/user/userSlice';
import { apiFetch } from '../api/apiClient';

interface CompletedBooking {
  id: number;
  stationId: number;
  stationName: string;
  status: string;
  hasReview: boolean;
}

interface BookingTarget {
  bookingId: number;
  stationId: number;
  stationName: string;
}

export default function RatingAndReportScreen() {
  const [booking, setBooking] = useState<BookingTarget | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>('');
  const [selectedIssue, setSelectedIssue] = useState<string>('שקע טעינה אינו מגיב');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [earnedPoints, setEarnedPoints] = useState<number>(10);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function findBookingToReview() {
      const saved = localStorage.getItem('lastCompletedBooking');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as BookingTarget;
          if (parsed.bookingId && parsed.stationId) {
            setBooking(parsed);
            return;
          }
        } catch {
          localStorage.removeItem('lastCompletedBooking');
        }
      }

      try {
        const myBookings = await apiFetch<CompletedBooking[]>('/ChargeBooking/my');
        const pendingReview = myBookings.find((b) => b.status === 'Completed' && !b.hasReview);
        if (pendingReview) {
          setBooking({
            bookingId: pendingReview.id,
            stationId: pendingReview.stationId,
            stationName: pendingReview.stationName,
          });
        }
      } catch {
        // המשתמש אינו נהג או אינו מחובר
      }
    }

    findBookingToReview();
  }, []);

  const handleSubmitRating = async (e: FormEvent) => {
    e.preventDefault();
    if (!booking) {
      setError('לא נמצאה טעינה שהסתיימה וממתינה לדירוג.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/ReviewsToCharge', {
        method: 'POST',
        body: JSON.stringify({
          chargeBookingId: booking.bookingId,
          rating,
          comment: reviewText.trim() || 'חוויית טעינה מצוינת!',
        }),
      });

      localStorage.removeItem('lastCompletedBooking');
      setEarnedPoints(10);
      dispatch(addCommunityPoints(10));
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחת הדירוג לשרת');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!booking) {
      setError('לא נמצאה טעינה פעילה או שהסתיימה לדיווח.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/StationStatusLogs/report-fault', {
        method: 'POST',
        body: JSON.stringify({ stationId: booking.stationId }),
      });

      try {
        await apiFetch('/ReviewsToCharge', {
          method: 'POST',
          body: JSON.stringify({
            chargeBookingId: booking.bookingId,
            rating: 1,
            comment: `דיווח תקלה: ${selectedIssue}`,
          }),
        });
      } catch {
        // אם כבר נכתבה ביקורת להזמנה זו, דיווח התקלה בלוג הסטטוסים עדיין הצליח
      }

      localStorage.removeItem('lastCompletedBooking');
      setEarnedPoints(20);
      dispatch(addCommunityPoints(20));
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בדיווח התקלה לשרת');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="container" dir="rtl">
        <div
          className="ev-card"
          style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center', padding: '40px 28px' }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '999px',
              background: 'var(--ev-brand-soft)',
              border: '1px solid var(--ev-brand-border)',
              color: 'var(--ev-brand)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.35rem', color: 'var(--ev-ink)' }}>
            תודה רבה, הדיווח נשמר במערכת
          </h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '0.9rem', color: 'var(--ev-ink-muted)' }}>
            המשוב שלך עוזר לכל הנהגים למצוא עמדות אמינות ופנויות בזמן אמת.
          </p>

          <div
            style={{
              background: 'var(--ev-brand-soft)',
              border: '1px solid var(--ev-brand-border)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '24px',
            }}
          >
            <div style={{ fontSize: '0.84rem', color: 'var(--ev-ink-muted)', marginBottom: '4px' }}>
              תגמול קהילה התווסף לחשבונך
            </div>
            <div
              className="font-mono-num"
              style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ev-brand)' }}
            >
              +{earnedPoints} נקודות קהילה
            </div>
          </div>

          <button type="button" className="ev-btn" onClick={() => navigate('/search')}>
            חזרה לחיפוש עמדות
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" dir="rtl">
      <div className="ev-card" style={{ maxWidth: '640px', margin: '0 auto', padding: '28px' }}>
        <div className="screen-header">
          <div>
            <div>סיכום טעינה, דירוג ודיווח תקלות</div>
            <p className="ev-subtitle">
              {booking
                ? `${booking.stationName} · הזמנה #${booking.bookingId}`
                : 'לא נמצאה טעינה שהסתיימה וממתינה לדירוג'}
            </p>
          </div>
        </div>

        {!booking && (
          <div
            className="ev-alert-brand"
            style={{ textAlign: 'center', marginBottom: '20px' }}
          >
            לא נמצאה טעינה שהסתיימה ועדיין לא דורגה. יש לסיים טעינה כדי לדרג.
          </div>
        )}

        {error && <div className="ev-alert-error">{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* טופס דירוג */}
          <form
            onSubmit={handleSubmitRating}
            style={{
              background: 'var(--ev-bg)',
              padding: '22px',
              borderRadius: '12px',
              border: '1px solid var(--ev-border)',
            }}
          >
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.02rem', color: 'var(--ev-ink)' }}>
              איך הייתה חוויית הטעינה?
            </h3>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '18px',
                direction: 'ltr',
                justifyContent: 'flex-end',
              }}
            >
              <span
                className="font-mono-num"
                style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ev-ink-muted)', marginRight: '8px' }}
              >
                {rating}/5
              </span>
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    aria-label={`דירוג ${star}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      color: filled ? '#f59e0b' : '#cbd5e1',
                      transition: 'transform 0.15s ease, color 0.15s ease',
                      transform: filled ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill={filled ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                );
              })}
            </div>

            <div className="form-group">
              <label>חוות דעת קצרה</label>
              <input
                type="text"
                className="form-control"
                placeholder="לדוגמה: עמדה מהירה, נקייה ופנויה."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
              />
            </div>

            <button type="submit" className="ev-btn" disabled={submitting || !booking}>
              {submitting ? 'שולח לשרת...' : 'שלח דירוג וסיים נסיעה'}
            </button>
          </form>

          {/* טופס דיווח תקלה */}
          <form
            onSubmit={handleSubmitReport}
            style={{
              background: 'var(--ev-danger-soft)',
              padding: '22px',
              borderRadius: '12px',
              border: '1px solid var(--ev-danger-border)',
            }}
          >
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.98rem', color: '#991b1b' }}>
              זיהית תקלה בעמדה?
            </h4>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.82rem', color: '#b91c1c' }}>
              דיווח אמין מסיר זמנית את העמדה התקולה ומזכה אותך ב-20 נקודות קהילה.
            </p>

            <div className="form-group">
              <label style={{ color: '#991b1b' }}>סוג התקלה</label>
              <select
                className="form-control"
                value={selectedIssue}
                onChange={(e) => setSelectedIssue(e.target.value)}
              >
                <option value="שקע טעינה אינו מגיב">שקע טעינה אינו מגיב</option>
                <option value="כבל קרוע או פגום">כבל קרוע או פגום</option>
                <option value="העמדה תפוסה פיזית אך מופיעה כפנויה">
                  העמדה תפוסה פיזית אך מופיעה כפנויה
                </option>
                <option value="תקלת תקשורת / אפליקציה">תקלת תקשורת / אפליקציה</option>
              </select>
            </div>

            <button
              type="submit"
              className="ev-btn"
              disabled={submitting || !booking}
              style={{ background: 'var(--ev-danger)' }}
            >
              {submitting ? 'שולח דיווח...' : 'דווח על תקלה וסיים נסיעה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}