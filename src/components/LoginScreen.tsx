import { useState, type FormEvent } from 'react';
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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
    <div
      className="container"
      dir="rtl"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        alignItems: 'stretch',
      }}
    >
      {/* כרטיס היכרות ותועלת מרכזית */}
      <div
        className="ev-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '32px',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 10px 0',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--ev-brand)',
            }}
          >
            טעינה חכמה · שריון בזמן אמת · ניהול עמדות
          </p>
          <h2
            style={{
              margin: '0 0 12px 0',
              fontSize: '1.75rem',
              lineHeight: 1.3,
              fontWeight: 700,
              color: 'var(--ev-ink)',
            }}
          >
            למצוא עמדת טעינה פנויה, לשריין מראש ולהגיע בראש שקט.
          </h2>
          <p
            style={{
              margin: '0 0 28px 0',
              fontSize: '0.95rem',
              lineHeight: 1.65,
              color: 'var(--ev-ink-muted)',
            }}
          >
            מערכת תפעולית לנהגים ולבעלי עמדות בישראל. חישוב התאמה מדויק לפי מצב הסוללה,
            סוג שקע, מרחק ומחיר לקוט&quot;ש — עם שריון מיידי ל-15 דקות ועוזר קולי בעברית.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '16px',
              paddingTop: '20px',
              borderTop: '1px solid var(--ev-border)',
            }}
          >
            <div>
              <div className="tabular-nums" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                15 דק&apos;
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)', marginTop: '4px' }}>
                נעילת שקע מובטחת עד ההגעה
              </div>
            </div>
            <div>
              <div className="tabular-nums" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                CCS · Type2
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)', marginTop: '4px' }}>
                התאמה אוטומטית לשקע הרכב
              </div>
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>זמן אמת</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)', marginTop: '4px' }}>
                דיווחי תקינות וזמינות קהילתיים
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '28px',
            paddingTop: '16px',
            borderTop: '1px solid var(--ev-surface-subtle)',
            fontSize: '0.8rem',
            color: 'var(--ev-ink-soft)',
          }}
        >
          התחברו כנהגים לחיפוש ושריון עמדות, או כבעלי עמדות לניהול זמינות, תמחור ותקלות.
        </div>
      </div>

      {/* כרטיס התחברות והרשמה */}
      <div className="ev-card" style={{ padding: '32px' }}>
        <div className="auth-toggle">
          <button
            type="button"
            className={`auth-toggle-btn ${authMode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('login');
              setErrorMessage('');
            }}
          >
            התחברות
          </button>
          <button
            type="button"
            className={`auth-toggle-btn ${authMode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('register');
              setErrorMessage('');
            }}
          >
            הרשמה חדשה
          </button>
        </div>

        {errorMessage && <div className="ev-alert-error">{errorMessage}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>אופן כניסה למערכת</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSelectedRole('Driver')}
                style={{
                  padding: '10px 12px',
                  borderRadius: '9px',
                  border:
                    selectedRole === 'Driver'
                      ? '1.5px solid var(--ev-brand)'
                      : '1px solid var(--ev-border)',
                  background:
                    selectedRole === 'Driver' ? 'var(--ev-brand-soft)' : 'var(--ev-surface)',
                  color: selectedRole === 'Driver' ? 'var(--ev-brand-hover)' : 'var(--ev-ink)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                נהג רכב חשמלי
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('Owner')}
                style={{
                  padding: '10px 12px',
                  borderRadius: '9px',
                  border:
                    selectedRole === 'Owner'
                      ? '1.5px solid var(--ev-brand)'
                      : '1px solid var(--ev-border)',
                  background:
                    selectedRole === 'Owner' ? 'var(--ev-brand-soft)' : 'var(--ev-surface)',
                  color: selectedRole === 'Owner' ? 'var(--ev-brand-hover)' : 'var(--ev-ink)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                בעל עמדת טעינה
              </button>
            </div>
          </div>

          {authMode === 'register' && (
            <>
              <div className="form-group">
                <label>שם מלא</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="ישראל ישראלי"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>טלפון</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="050-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>כתובת אימייל</label>
            <input
              type="email"
              className="form-control"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </div>

          <div className="form-group">
            <label>
              {authMode === 'register'
                ? 'סיסמה (לפחות 8 תווים, אות באנגלית ומספר)'
                : 'סיסמה'}
            </label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </div>

          {authMode === 'register' && (
            <div className="form-group">
              <label>אימות סיסמה</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                dir="ltr"
                style={{ textAlign: 'left' }}
              />
            </div>
          )}

          {selectedRole === 'Owner' && (
            <div
              className="form-group"
              style={{
                background: 'var(--ev-bg)',
                padding: '12px 14px',
                borderRadius: '9px',
                border: '1px solid var(--ev-border)',
              }}
            >
              <label
                style={{
                  fontWeight: 500,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.86rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={hasStation}
                  onChange={(e) => setHasStation(e.target.checked)}
                />
                <span>קיימת לי כבר תחנה רשומה במערכת</span>
              </label>
            </div>
          )}

          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '6px' }}>
            {loading ? 'מתחבר לשרת...' : authMode === 'login' ? 'כניסה למערכת' : 'יצירת חשבון והמשך'}
          </button>
        </form>
      </div>
    </div>
  );
}