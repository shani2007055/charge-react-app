import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginScreen() {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<string>('driver');
  const [hasStation, setHasStation] = useState<boolean>(true);

  // שדות קלט (Controlled Inputs)
  const [email, setEmail] = useState('israel@ev.com');
  const [password, setPassword] = useState('123456');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // סטייט להצגת הודעות שגיאה למשתמש (ולידציה)
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  // פונקציית בדיקה האם המייל תקין (מכילה @ ונקודה)
  function isValidEmail(value: string) {
    return value.includes('@') && value.includes('.');
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(''); // איפוס שגיאות קודמות

    // 1. בדיקת ולידציה בסיסית לשדות ריקים
    if (authMode === 'login') {
      if (!email || !password) {
        setErrorMessage('נא למלא אימייל וסיסמה.');
        return;
      }
    } else {
      if (!fullName || !email || !phone || !password) {
        setErrorMessage('נא למלא את כל שדות החובה בהרשמה.');
        return;
      }
    }

    // 2. בדיקת תקינות מבנה המייל
    if (!isValidEmail(email)) {
      setErrorMessage('כתובת האימייל אינה תקינה (חסר @ או נקודה).');
      return;
    }

    // 3. הדמיה של בדיקת "האם המייל כבר קיים במערכת" (לדוגמה בהרשמה)
    if (authMode === 'register' && email === 'israel@ev.com') {
      // אם המייל כבר תפוס, נעביר אותו אוטומטית להתחברות ונציג הודעה!
      setAuthMode('login');
      setErrorMessage('המייל כבר קיים במערכת! הועברת למסך התחברות.');
      return;
    }

    // אם הכל עבר בהצלחה - עוברים לעמוד הבא
    console.log('התחברות/הרשמה הצליחו, עוברים עמוד...');
    if (selectedRole === 'owner') {
      navigate('/owner');
    } else {
      navigate('/search');
    }
  }

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        
        <div className="screen-header">
          <span>⚡ כניסה למערכת / הרשמה</span>
        </div>

        <div style={{ maxWidth: '450px', margin: '0 auto' }}>
          
          <div className="auth-toggle">
            <div 
              className={`auth-toggle-btn ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => { setAuthMode('login'); setErrorMessage(''); }}
            >
              התחברות
            </div>
            <div 
              className={`auth-toggle-btn ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => { setAuthMode('register'); setErrorMessage(''); }}
            >
              הרשמה מחדש
            </div>
          </div>

          {/* הצגת הודעת שגיאה/התראה בעיצוב מותנה */}
          {errorMessage && (
            <div style={{ background: '#ff4d4d', color: 'white', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {authMode === 'login' ? (
              <div>
                <div className="form-group">
                  <label>📧 שם משתמש / אימייל:</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>🔒 סיסמה:</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label>👤 שם מלא:</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="ישראל ישראלי" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>📧 אימייל:</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="user@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                 <div className="form-group">
                  <label>📱 טלפון:</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="055-5555555" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>🔒 סיסמה:</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>👤 בחר אופן כניסה למערכת:</label>
              <select 
                className="form-control"
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="driver">לקוח / נהג המחפש טעינה (Driver)</option>
                <option value="owner">משתמש תחנה (Station Owner)</option>
              </select>
            </div>

            {selectedRole === 'owner' && (
              <div className="form-group" style={{ background: '#121212', padding: '12px', borderRadius: '8px', border: '1px solid #333' }}>
                <label style={{ fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasStation} onChange={(e) => setHasStation(e.target.checked)} />
                  <strong>האם קיימת לך כבר תחנה רשומה במערכת?</strong>
                </label>
              </div>
            )}

            <button type="submit" className="btn" style={{ marginTop: '10px', cursor: 'pointer' }}>
              המשך למערכת ➔
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}