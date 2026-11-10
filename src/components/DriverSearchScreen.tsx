import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DriverSearchScreen() {
  const [batteryLevel, setBatteryLevel] = useState<number>(18);
  const [estimatedRange, setEstimatedRange] = useState<string>('כ-45 ק"מ');
  const [batteryStatusText, setBatteryStatusText] = useState<string>('סוללה קריטית (18%)');
  const [batteryColor, setBatteryColor] = useState<string>('var(--danger)');
  const [isPulse, setIsPulse] = useState<boolean>(true);

  // הוספת סטيت לשדות נוספים במסך (Controlled Inputs)
  const [location, setLocation] = useState<string>('תל אביב, דרך בגין 120');
  const [destination, setDestination] = useState<string>('חיפה (95 ק"מ)');
  const [priority, setPriority] = useState<string>('דירוג קהילה גבוה ביותר + מהירות');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const navigate = useNavigate();

  // פונקציה לעדכון הסוללה, הטווח והאנימציה לפי מה שהמשתמש מקליד
  const handleBatteryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setBatteryLevel(val);
    const estKm = Math.round(val * 2.5);
    setEstimatedRange(`כ-${estKm} ק"מ`);

    if (val <= 20) {
      setBatteryStatusText(`סוללה קריטית (${val}%)`);
      setBatteryColor('var(--danger)');
      setIsPulse(true);
    } else if (val <= 50) {
      setBatteryStatusText(`סוללה במצב בינוני (${val}%)`);
      setBatteryColor('var(--yellow)');
      setIsPulse(false);
    } else {
      setBatteryStatusText(`סוללה מלאה/תקינה (${val}%)`);
      setBatteryColor('var(--primary)');
      setIsPulse(false);
    }
  };

  // פונקציית שליחת הטופס עם ולידציה ומעבר לעמוד תוצאות
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // מניעת רענון הדף (חובה לפי ההנחיות)
    setErrorMessage('');

    // ולידציה בסיסית: בדיקה שהמיקום והיעד אינם ריקים
    if (!location.trim() || !destination.trim()) {
      setErrorMessage('נא למלא את מיקום המוצא ויעד הנסיעה.');
      return;
    }

    console.log('נתוני חיפוש עמדה:', { location, batteryLevel, destination, priority });

    // מעבר לעמוד הבא (תוצאות והמלצות) בעזרת הניתוב שלמדת
    navigate('/results');
  }

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        
        <div className="screen-header">
          <span>🔍 חיפוש מהיר והעדפות טעינה</span>
        </div>

        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          
          {/* הצגת שגיאה במידת הצורך */}
          {errorMessage && (
            <div style={{ background: '#ff4d4d', color: 'white', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
              {errorMessage}
            </div>
          )}

          {/* עטיפת הטופס ב-form עם אירוע onSubmit */}
          <form onSubmit={handleSubmit}>
            
            <div className="form-group">
              <label>📍 מיקום נוכחי:</label>
              <input 
                type="text" 
                className="form-control" 
                value={location} 
                onChange={(e) => setLocation(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>🔋 אחוז סוללה נוכחי (%):</label>
              <input 
                type="number" 
                className="form-control" 
                value={batteryLevel} 
                onChange={handleBatteryChange} 
              />
              
              {/* וידג'ט הסוללה האנימטיבי התואם לאפיון */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#121212', padding: '12px', borderRadius: '10px', border: '1px solid #333', marginTop: '8px' }}>
                <div style={{ width: '50px', height: '24px', border: '2px solid #333', borderRadius: '5px', padding: '2px', position: 'relative' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(Math.max(batteryLevel, 0), 100)}%`, 
                    background: batteryColor, 
                    borderRadius: '2px',
                    transition: 'width 0.4s ease, background 0.4s ease'
                  }} />
                </div>
                <span style={{ fontSize: '0.85rem', color: batteryColor, fontWeight: 'bold' }}>
                  {batteryStatusText}
                </span>
              </div>
            </div>

            {/* כפתור חירום מהיר למצב סוללה קריטית */}
            {batteryLevel <= 20 && (
              <div style={{ background: '#450a0a', padding: '10px', borderRadius: '8px', marginBottom: '15px', border: '1px solid var(--danger)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#fca5a5' }}>סוללה קריטית? </span>
                <button 
                  type="button"
                  className="btn" 
                  style={{ background: 'var(--danger)', padding: '6px 12px', fontSize: '0.8rem', width: 'auto', display: 'inline-block', marginRight: '8px', cursor: 'pointer' }}
                  onClick={() => alert('מצב חירום הופעל! מציג עמדות טעינה מהירות מיידיות בסביבתך הקרובה...')}
                >
                  🚨 מצא עמדה קרובה מיידית
                </button>
              </div>
            )}

            {/* שדות הטווח והיעד מודגשים זה לצד זה כמו באפיון */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>🚗 טווח מוערך נותר:</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={estimatedRange} 
                  readOnly 
                  style={{ color: '#85e02c', fontWeight: 'bold' }} 
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>🎯 יעד מרחק (ק"מ):</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>⭐ סדר עדיפויות באלגוריתם:</label>
              <select 
                className="form-control"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="דירוג קהילה גבוה ביותר + מהירות">דירוג קהילה גבוה ביותר + מהירות</option>
                <option value="חיסכון מקסימלי בזמן כולל">חיסכון מקסימלי בזמן כולל</option>
                <option value="מרחק פיזי קצר ביותר">מרחק פיזי קצר ביותר</option>
              </select>
            </div>

            <button type="submit" className="btn" style={{ marginTop: '10px', cursor: 'pointer' }}>
              חשב עמדה אופטימלית ➔
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}