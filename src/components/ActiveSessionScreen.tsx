import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ActiveSessionScreen() {
  // ניהול הזמן שנותר בסטייט (מתחיל ב-15 דקות = 900 שניות)
  const [secondsLeft, setSecondsLeft] = useState<number>(900);
  const navigate = useNavigate();

  // שימוש ב-useEffect להפעלת טיימר ספירה לאחור עם ניקוי (Cleanup) לפי הנחיות המורה
  useEffect(() => {
    const timerId = setInterval(() => {
      setSecondsLeft((prevSeconds) => {
        if (prevSeconds <= 1) {
          clearInterval(timerId);
          return 0;
        }
        return prevSeconds - 1;
      });
    }, 1000);

    // פונקציית ניקוי (Cleanup) כפי שלמדת בדוגמת השעון והטיימר
    return () => clearInterval(timerId);
  }, []);

  // המרת השניות לפורמט דקות:שניות (למשל 14:58)
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        
        <div className="screen-header">
          <span>ניווט ושריון עמדה בזמן אמת</span>
        </div>

        <div style={{ maxWidth: '550px', margin: '0 auto', textAlign: 'center' }}>
          
          {/* כרטיס טיימר וניווט */}
          <div style={{ background: '#121212', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, color: 'var(--light-blue)', fontSize: '1.2rem' }}>
              Sonol E-V Energy - מתחם שפיים
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              השקע שמור עבורך ל-15 הדקות הקרובות!
            </p>
            
            {/* הטיימר המעוגל המעוצב מעודכן דינמית מתוך הסטייט */}
            <div style={{ 
              position: 'relative', 
              width: '140px', 
              height: '140px', 
              margin: '20px auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: '8px solid var(--light-blue)',
              boxShadow: '0 0 15px rgba(125, 211, 252, 0.3)'
            }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--light-blue)' }}>
                {formattedTime}
              </span>
            </div>

            <button 
              className="btn" 
              style={{ background: 'var(--green-dark)', width: '100%', marginTop: '15px', padding: '14px', fontSize: '1rem', cursor: 'pointer' }}
              onClick={() => alert('פותח ניווט באפליקציית Waze...')}
            >
              🗺️ התחל ניווט ב-Waze
            </button>
          </div>

          {/* כרטיס סטטוס שקעים */}
          <div style={{ background: '#121212', padding: '20px', borderRadius: '16px', border: '1px solid var(--card-border)', textAlign: 'right', marginBottom: '20px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--text-main)', fontSize: '1rem', marginBottom: '15px' }}>
              🔌 סטטוס השקעים בעמדה:
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ 
                background: '#062f22', 
                border: '1.5px solid var(--primary)', 
                padding: '14px', 
                borderRadius: '10px', 
                textAlign: 'center' 
              }}>
                <strong style={{ display: 'block', color: 'white', fontSize: '0.9rem', marginBottom: '4px' }}>
                  שקע #1 (CCS)
                </strong>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  שמור עבורך
                </span>
              </div>

              <div style={{ 
                background: '#18181b', 
                border: '1px solid var(--card-border)', 
                padding: '14px', 
                borderRadius: '10px', 
                textAlign: 'center' 
              }}>
                <strong style={{ display: 'block', color: 'white', fontSize: '0.9rem', marginBottom: '4px' }}>
                  שקע #2 (Type 2)
                </strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  תפוס
                </span>
              </div>
            </div>
          </div>

          {/* כפתור מעבר למסך הבא באמצעות הניתוב */}
          <button 
            className="btn" 
            style={{ width: '100%', padding: '14px', fontSize: '1rem', cursor: 'pointer' }}
            onClick={() => navigate('/rating')}
          >
            הגעתי לעמדה / סיימתי טעינה ➔ עבור לדירוג ודיווח
          </button>

        </div>

      </div>
    </div>
  );
}