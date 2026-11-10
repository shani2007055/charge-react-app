import React, { useState } from 'react';

export default function UserProfileScreen() {
  // הפיכת השדה למבוקר (Controlled Input) עם אפשרות עדכון
  const [carModel, setCarModel] = useState<string>('Tesla Model 3 Long Range');
  const [communityPoints] = useState<number>(150);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // טיפול בשמירת השינויים בטופס
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // מניעת רענון הדף
    setIsEditing(false);
    setSuccessMessage('פרטי הפרופיל עודכנו בהצלחה!');
    
    // הסרת הודעת ההצלחה אחרי כמה שניות
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        
        <div className="screen-header">
          <span>פרופיל משתמש ונקודות קהילה</span>
        </div>

        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          
          {/* הודעת הצלחה מותנית */}
          {successMessage && (
            <div style={{ background: '#062f22', color: 'var(--primary)', padding: '10px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', border: '1px solid var(--primary)' }}>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>דגם רכב:</label>
              <input 
                type="text" 
                className="form-control" 
                value={carModel} 
                onChange={(e) => setCarModel(e.target.value)} 
                readOnly={!isEditing} // ניתן לעריכה רק במצב עריכה
                style={{ 
                  textAlign: 'center', 
                  fontWeight: 'bold', 
                  background: isEditing ? '#1e1e1e' : '#121212',
                  border: isEditing ? '1px solid var(--accent-blue)' : '1px solid var(--card-border)'
                }}
              />
            </div>

            <div className="form-group">
              <label>נקודות קהילה ובונוסים:</label>
              <input 
                type="text" 
                className="form-control" 
                value={`${communityPoints} נקודות`} 
                readOnly 
                style={{ 
                  color: 'var(--primary)', 
                  fontWeight: 'bold', 
                  fontSize: '1.2rem',
                  textAlign: 'center',
                  background: '#121212'
                }}
              />
            </div>

            {/* כפתורי שליטה במצב עריכה */}
            {!isEditing ? (
              <button 
                type="button" 
                className="btn" 
                style={{ marginTop: '10px', background: '#333', cursor: 'pointer' }}
                onClick={() => setIsEditing(true)}
              >
                ערוך פרטי רכב ✏️
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="submit" 
                  className="btn" 
                  style={{ flex: 1, background: 'var(--primary)', color: 'black', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  שמור שינויים ✓
                </button>
                <button 
                  type="button" 
                  className="btn" 
                  style={{ flex: 1, background: '#4b5563', cursor: 'pointer' }}
                  onClick={() => setIsEditing(false)}
                >
                  ביטול
                </button>
              </div>
            )}
          </form>

        </div>

      </div>
    </div>
  );
}