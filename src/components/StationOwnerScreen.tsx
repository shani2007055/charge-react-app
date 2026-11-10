import React, { useState } from 'react';

interface ChargingRecord {
  id: string;
  driverName: string;
  date: string;
  kwhUsed: string;
  payout: string;
}

export default function StationOwnerScreen() {
  const [stationName] = useState<string>('העמדה הביתית שלי (#WB-4412)');
  const [isStationActive, setIsStationActive] = useState<boolean>(true);

  // נתוני טבלת היסטוריית טעינות (מוגדרים כ-State כדי שאפשר יהיה להוסיף רשומות)
  const [history, setHistory] = useState<ChargingRecord[]>([
    {
      id: '#801',
      driverName: 'דני כהן',
      date: '05/10/2026',
      kwhUsed: '35 kWh',
      payout: '₪52.50'
    }
  ]);

  // פונקציה להחלפת סטטוס העמדה (פעילה / לא פעילה)
  const handleToggleStationStatus = () => {
    setIsStationActive(!isStationActive);
  };

  // פונקציה להוספת טעינה חדשה לדוגמה לטבלה
  const handleAddSampleRecord = () => {
    const newRecord: ChargingRecord = {
      id: `#${Math.floor(Math.random() * 900) + 100}`,
      driverName: 'ישראל ישראלי',
      date: new Date().toLocaleDateString('he-IL'),
      kwhUsed: '42 kWh',
      payout: '₪63.00'
    };
    setHistory([newRecord, ...history]);
  };

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        
        <div className="screen-header">
          <span>פנאל ניהול בעל תחנה</span>
        </div>

        {/* שורת סטטוס עמדה פעילה עם כפתור החלפת סטטוס אינטראקטיבי */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              עמדה פעילה רשומה: {stationName}
            </span>
            <span style={{ 
              background: isStationActive ? '#064e3b' : '#7f1d1d', 
              color: isStationActive ? 'var(--primary)' : '#fca5a5', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              fontSize: '0.85rem', 
              fontWeight: 'bold' 
            }}>
              {isStationActive ? 'פעילה ותקינה' : 'לא פעילה'}
            </span>
          </div>

          <button 
            type="button"
            className="btn"
            style={{ 
              width: 'auto', 
              padding: '6px 14px', 
              fontSize: '0.85rem', 
              background: isStationActive ? '#7f1d1d' : '#064e3b',
              cursor: 'pointer' 
            }}
            onClick={handleToggleStationStatus}
          >
            {isStationActive ? 'כבה עמדה זמנית ⏹️' : 'הפעל עמדה מחדש ⏵'}
          </button>
        </div>

        {/* שתי קופסאות מידע צד בצד */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '25px' }}>
          
          {/* קופסת דירוגים אחרונים */}
          <div style={{ background: '#121212', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--light-blue)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⭐ דירוגים אחרונים מנהגים:
            </h4>
            <div style={{ borderTop: '1px solid #262626', paddingTop: '10px', fontSize: '0.88rem' }}>
              <span style={{ fontWeight: 'bold', color: 'white' }}>דני כהן: </span>
              <span style={{ color: 'var(--yellow)' }}>⭐⭐⭐⭐⭐ </span>
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>"עמדה מצויינת!"</span>
            </div>
          </div>

          {/* קופסת דיווחי תקלות */}
          <div style={{ background: '#121212', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#f87171', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🚨 דיווחי תקלות מהשטח:
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {isStationActive ? 'אין דיווחי תקלות פעילים כרגע. התחנה במצב תקין.' : 'העמדה כבויה כרגע על ידי בעל התחנה.'}
            </p>
          </div>

        </div>

        {/* טבלת היסטוריית טעינות ותגמולים */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <h4 style={{ margin: 0, color: 'var(--light-blue)', fontSize: '1rem' }}>
              היסטוריית טעינות ותגמולים כספיים מהחברה הראשית:
            </h4>
            <button 
              type="button"
              className="btn"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', background: 'var(--accent-blue)', cursor: 'pointer' }}
              onClick={handleAddSampleRecord}
            >
              + הוסף סימולציית טעינה חדשה
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#121212', color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ padding: '10px' }}>מזהה</th>
                  <th style={{ padding: '10px' }}>שם הנהג</th>
                  <th style={{ padding: '10px' }}>תאריך</th>
                  <th style={{ padding: '10px' }}>kWh נצרך</th>
                  <th style={{ padding: '10px' }}>תגמול כספי (₪)</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #262626' }}>
                    <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{row.id}</td>
                    <td style={{ padding: '12px 10px', color: 'white', fontWeight: 'bold' }}>{row.driverName}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{row.date}</td>
                    <td style={{ padding: '12px 10px', color: 'white' }}>{row.kwhUsed}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--primary)', fontWeight: 'bold' }}>{row.payout}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}