import { useAppSelector, useAppDispatch } from '../store/hooks';
import { addCommunityPoints } from '../store/user/userSlice';

export default function UserProfileScreen() {
  // שאיפת נתונים מתוך ה-Store המרכזי בעזרת ההוק המקוצר שלמדת
  const { name, carModel, communityPoints } = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        
        <div className="screen-header">
          <span>👤 פרופיל משתמש (מנוהל ע"י Redux)</span>
        </div>

        <div style={{ maxWidth: '500px', margin: '0 auto', background: '#121212', padding: '20px', borderRadius: '10px', color: 'white', border: '1px solid #333' }}>
          
          <h2 style={{ marginBottom: '15px' }}>שלום, {name}</h2>
          
          <div style={{ marginBottom: '10px', fontSize: '1rem' }}>
            🚗 דגם רכב: <strong>{carModel}</strong>
          </div>
          
          <div style={{ marginBottom: '20px', fontSize: '1rem' }}>
            ⭐ נקודות קהילה: <strong style={{ color: 'var(--primary)' }}>{communityPoints}</strong>
          </div>

          {/* כפתור שמפעיל dispatch ומעדכן את הסטייט המרכזי ב-Store */}
          <button 
            type="button"
            className="btn" 
            style={{ cursor: 'pointer' }}
            onClick={() => dispatch(addCommunityPoints(10))}
          >
            + הוסף 10 נקודות קהילה ל-Redux
          </button>
          
        </div>

      </div>
    </div>
  );
}