import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchStations } from '../store/stations/stationsThunks';

export default function StationResultsScreen() {
  const dispatch = useAppDispatch();
  // שאיפת הנתונים, הטעינה והשגיאה מתוך ה-Store
  const { items, loading, error } = useAppSelector((state) => state.stations);

  // שליחת הבקשה לשרת ברגע שהקומפוננטה נטענת
  useEffect(() => {
    dispatch(fetchStations());
  }, [dispatch]);

  // טיפול במצב טעינה (כמו שלמדת)
  if (loading) {
    return (
      <div className="container" dir="rtl">
        <div className="screen-view" style={{ textAlign: 'center', padding: '40px', color: 'white' }}>
          <p>⏳ טוען עמדות טעינה מהשרת...</p>
        </div>
      </div>
    );
  }

  // טיפול במצב שגיאה (כמו שלמדת)
  if (error) {
    return (
      <div className="container" dir="rtl">
        <div className="screen-view" style={{ textAlign: 'center', padding: '40px', color: '#ff4d4d' }}>
          <p>❌ שגיאה בטעינת העמדות: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        
        <div className="screen-header">
          <span>⚡ תוצאות עמדות טעינה (מנוהל ע"י Redux)</span>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', color: 'white' }}>
          <p style={{ marginBottom: '15px', color: '#aaa' }}> נמצאו {items.length} עמדות זמינות בסביבתך:</p>

          <ul style={{ listStyle: 'none', padding: 0 }}>
            {items.slice(0, 5).map((station) => (
              <li 
                key={station.id} 
                style={{ 
                  background: '#121212', 
                  padding: '15px', 
                  borderRadius: '8px', 
                  marginBottom: '10px', 
                  border: '1px solid #333' 
                }}
              >
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{station.name}</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#aaa' }}>{station.location}</p>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}