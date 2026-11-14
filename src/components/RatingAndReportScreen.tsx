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
      // 1. סימון העמדה כתקולה בלוג הסטטוסים (Faulty) -> מופיע מיד אצל בעל העמדה ומסונן מהאלגוריתם!
      await apiFetch('/StationStatusLogs/report-fault', {
        method: 'POST',
        body: JSON.stringify({ stationId: booking.stationId }),
      });

      // 2. אם עדיין לא נכתבה ביקורת להזמנה זו, נשמור גם את פירוט התקלה כביקורת
      try {
        await apiFetch('/ReviewsToCharge', {
          method: 'POST',
          body: JSON.stringify({
            chargeBookingId: booking.bookingId,
            rating: 1,
            comment: `⚠️ דיווח תקלה: ${selectedIssue}`,
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
        <div className="screen-view" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚡ 🎉</div>
          <h2 style={{ color: 'var(--light-blue)', fontSize: '1.8rem', marginBottom: '10px' }}>
            תודה רבה! הדיווח נשמר במערכת
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
            המשוב שלך מסייע לכל הקהילה למצוא עמדות אמינות ופנויות בזמן אמת.
          </p>
          <div style={{
            background: '#062f22',
            border: '2px solid var(--primary)',
            borderRadius: '16px',
            padding: '20px',
            maxWidth: '400px',
            margin: '0 auto 30px auto',
          }}>
            <span style={{ color: 'var(--text-main)', fontSize: '1rem', display: 'block', marginBottom: '8px' }}>
              תגמול קהילה התווסף לחשבונך!
            </span>
            <span style={{ color: 'var(--primary)', fontSize: '1.6rem', fontWeight: 'bold' }}>
              ⭐ +{earnedPoints} נקודות קהילה!
            </span>
          </div>
          <button
            className="btn"
            style={{ maxWidth: '400px', margin: '0 auto', padding: '14px', fontSize: '1rem', cursor: 'pointer' }}
            onClick={() => navigate('/search')}
          >
            🏠 חזרה לחיפוש חדש
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        <div className="screen-header">
          <span>סיכום טעינה, דירוג ודיווח תקלות</span>
        </div>

        <div style={{ maxWidth: '550px', margin: '0 auto' }}>
          {booking ? (
            <p style={{ color: 'var(--light-blue)', textAlign: 'center', marginBottom: '15px' }}>
              מדרגים את הטעינה בתחנה: <strong>{booking.stationName}</strong> (הזמנה #{booking.bookingId})
            </p>
          ) : (
            <div style={{ background: '#1e293b', color: '#cbd5e1', padding: '12px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center' }}>
              לא נמצאה טעינה שהסתיימה ועדיין לא דורגה. יש לסיים טעינה כדי לדרג.
            </div>
          )}

          {error && (
            <div style={{ background: '#ff4d4d', color: 'white', padding: '10px', borderRadius: '6px', marginBottom: '15px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmitRating} style={{ background: '#121212', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)', marginBottom: '20px', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '15px' }}>
              ⭐ הטרמינל פנוי? דרג את חוויית הטעינה:
            </h3>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px', direction: 'ltr' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  style={{
                    fontSize: '2rem',
                    cursor: 'pointer',
                    color: (hoverRating || rating) >= star ? 'var(--yellow)' : '#4b5563',
                    transition: 'transform 0.2s ease, color 0.2s ease',
                    transform: (hoverRating || rating) >= star ? 'scale(1.15)' : 'scale(1)',
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  ★
                </span>
              ))}
            </div>

            <div className="form-group" style={{ textAlign: 'right', marginBottom: '15px' }}>
              <label>חוות דעת קצרה:</label>
              <input
                type="text"
                className="form-control"
                placeholder="לדוגמה: עמדה מהירה, נקייה ופנויה."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
              />
            </div>

            <button type="submit" className="btn" disabled={submitting || !booking} style={{ width: '100%', padding: '12px', cursor: 'pointer' }}>
              {submitting ? 'שולח לשרת...' : 'שלח דירוג וסיום נסיעה 📥'}
            </button>
          </form>

          <form onSubmit={handleSubmitReport} style={{ background: '#180505', padding: '24px', borderRadius: '16px', border: '1.5px solid var(--danger)', textAlign: 'right' }}>
            <h4 style={{ marginTop: 0, color: '#f87171', fontSize: '1.05rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ זיהית תקלה בעמדה? דווח לנו (וקבל 20 נקודות בונוס!):
            </h4>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ color: '#fca5a5' }}>סוג התקלה:</label>
              <select
                className="form-control"
                value={selectedIssue}
                onChange={(e) => setSelectedIssue(e.target.value)}
                style={{ background: '#121212', borderColor: '#7f1d1d', color: 'white' }}
              >
                <option value="שקע טעינה אינו מגיב">שקע טעינה אינו מגיב</option>
                <option value="כבל קרוע או פגום">כבל קרוע או פגום</option>
                <option value="העמדה תפוסה פיזית אך מופיעה כפנויה">העמדה תפוסה פיזית אך מופיעה כפנויה</option>
                <option value="תקלת תקשורת / אפליקציה">תקלת תקשורת / אפליקציה</option>
              </select>
            </div>

            <button type="submit" className="btn" disabled={submitting || !booking} style={{ background: 'var(--danger)', width: '100%', padding: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              🚨 דווח על תקלה וסיום נסיעה 🎊
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}