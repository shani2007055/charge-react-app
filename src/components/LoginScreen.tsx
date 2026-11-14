import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginUser, registerUser } from '../store/user/userThunks';
import type { UserRole } from '../store/user/userState';

export default function LoginScreen() {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Driver');
  const [hasStation, setHasStation] = useState<boolean>(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.user);

  function isValidEmail(value: string) {
    return value.includes('@') && value.includes('.');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage('');

    if (authMode === 'login') {
      if (!email || !password) {
        setErrorMessage('נא למלא אימייל וסיסמה.');
        return;
      }
    } else {
      if (!fullName || !email || !phone || !password || !confirmPassword) {
        setErrorMessage('נא למלא את כל שדות החובה בהרשמה.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('הסיסמאות אינן תואמות.');
        return;
      }
    }

    if (!isValidEmail(email)) {
      setErrorMessage('כתובת האימייל אינה תקינה (חסר @ או נקודה).');
      return;
    }

    try {
      if (authMode === 'login') {
        await dispatch(loginUser({ email, password, role: selectedRole })).unwrap();
      } else {
        await dispatch(
          registerUser({
            name: fullName,
            email,
            phone,
            password,
            confirmPassword,
            role: selectedRole,
          })
        ).unwrap();
      }

      navigate(selectedRole === 'Owner' ? '/owner' : '/search');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'שגיאה בחיבור לשרת');
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

          {errorMessage && (
            <div style={{ background: '#ff4d4d', color: 'white', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {authMode === 'login' ? (
              <div>
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
                    placeholder="050-1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>🔒 סיסמה (לפחות 8 תווים, אות באנגלית ומספר):</label>
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>🔒 אימות סיסמה:</label>
                  <input
                    type="password"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>👤 בחר אופן כניסה למערכת:</label>
              <select
                className="form-control"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              >
                <option value="Driver">לקוח / נהג המחפש טעינה (Driver)</option>
                <option value="Owner">משתמש תחנה (Station Owner)</option>
              </select>
            </div>

            {selectedRole === 'Owner' && (
              <div className="form-group" style={{ background: '#121212', padding: '12px', borderRadius: '8px', border: '1px solid #333' }}>
                <label style={{ fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasStation} onChange={(e) => setHasStation(e.target.checked)} />
                  <strong>האם קיימת לך כבר תחנה רשומה במערכת?</strong>
                </label>
              </div>
            )}

            <button type="submit" className="btn" disabled={loading} style={{ marginTop: '10px', cursor: 'pointer' }}>
              {loading ? 'מתחבר לשרת...' : 'המשך למערכת ➔'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}