import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../utils/errorHandler';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/apiClient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginUser, registerUser } from '../store/user/userThunks';
import type { UserRole } from '../store/user/userState';

type AuthMode = 'login' | 'register' | 'forgot';
type ForgotStep = 'request' | 'reset';

interface ForgotPasswordResponse {
  message?: string;
  sentViaEmail?: boolean;
  devCode?: string | null;
}

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;

function buildStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  const pick = (pool: string) => {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return pool[arr[0] % pool.length];
  };

  const chars = [
    pick(upper),
    pick(upper),
    pick(lower),
    pick(lower),
    pick(digits),
    pick(digits),
    pick(special),
  ];

  while (chars.length < 12) {
    chars.push(pick(all));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join('');
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const eyeButtonStyle = {
  position: 'absolute' as const,
  right: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  padding: '4px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#64748B',
  cursor: 'pointer',
};

export default function LoginScreen() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Driver');
  const [hasStation, setHasStation] = useState<boolean>(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // מצב שחזור סיסמה
  const [forgotStep, setForgotStep] = useState<ForgotStep>('request');
  const [resetCode, setResetCode] = useState('');
  const [devResetCode, setDevResetCode] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.user);

  function isValidEmail(value: string) {
    return value.includes('@') && value.includes('.');
  }

  function handleGenerateStrongPassword() {
    const generated = buildStrongPassword();
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    setShowConfirmPassword(true);
    setErrorMessage('');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (authMode === 'login') {
      if (!email || !password) {
        setErrorMessage('נא למלא אימייל וסיסמה.');
        return;
      }
    } else if (authMode === 'register') {
      if (!fullName || !email || !phone || !password || !confirmPassword) {
        setErrorMessage('נא למלא את כל שדות החובה בהרשמה.');
        return;
      }
      if (!PASSWORD_RULE.test(password)) {
        setErrorMessage('הסיסמה חייבת להכיל לפחות 8 תווים, כולל אות באנגלית ומספר.');
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
  setErrorMessage(getErrorMessage(err));
}
  }

  async function handleForgotRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage('נא להזין כתובת אימייל תקינה.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await apiFetch<ForgotPasswordResponse>('/users/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail }),
      });

      setDevResetCode(res.devCode ?? null);
      if (res.devCode) {
        setResetCode(res.devCode);
      }
      setSuccessMessage(
        res.message || 'אם כתובת האימייל קיימת במערכת, נשלח קוד איפוס בן 6 ספרות.'
      );
      setForgotStep('reset');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'שגיאה בשליחת בקשת איפוס סיסמה');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedEmail = email.trim();
    const trimmedCode = resetCode.trim();

    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage('כתובת האימייל אינה תקינה.');
      return;
    }
    if (trimmedCode.length !== 6) {
      setErrorMessage('יש להזין קוד אימות בן 6 ספרות.');
      return;
    }
    if (!PASSWORD_RULE.test(password)) {
      setErrorMessage('הסיסמה החדשה חייבת להכיל לפחות 8 תווים, אות באנגלית ומספר.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('הסיסמאות אינן תואמות.');
      return;
    }

    setForgotLoading(true);
    try {
      await apiFetch<{ message?: string }>('/users/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedEmail,
          code: trimmedCode,
          newPassword: password,
          confirmNewPassword: confirmPassword,
        }),
      });

      setAuthMode('login');
      setForgotStep('request');
      setResetCode('');
      setDevResetCode(null);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setSuccessMessage('הסיסמה אופסה בהצלחה! כעת ניתן להתחבר עם הסיסמה החדשה.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'שגיאה באיפוס הסיסמה');
    } finally {
      setForgotLoading(false);
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
            סוג שקע, מרחק ומחיר לקוט&quot;ש — עם שריון דינמי לפי המרחק שלך ועוזר קולי בעברית.
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
                10–30 דק&apos;
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)', marginTop: '4px' }}>
                שריון דינמי לפי מרחק + ביטחון
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

      {/* כרטיס התחברות, הרשמה ושחזור סיסמה */}
      <div className="ev-card" style={{ padding: '32px' }}>
        {authMode !== 'forgot' ? (
          <div className="auth-toggle">
            <button
              type="button"
              className={`auth-toggle-btn ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('login');
                setErrorMessage('');
                setSuccessMessage('');
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
                setSuccessMessage('');
              }}
            >
              הרשמה חדשה
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--ev-border)',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--ev-ink)' }}>
                שחזור סיסמה
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--ev-ink-soft)', marginTop: '2px' }}>
                {forgotStep === 'request'
                  ? 'שלב 1 מתוך 2: הזנת אימייל לקבלת קוד אימות'
                  : 'שלב 2 מתוך 2: הזנת קוד אימות ובחירת סיסמה חדשה'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setForgotStep('request');
                setErrorMessage('');
                setSuccessMessage('');
                setDevResetCode(null);
                setResetCode('');
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--ev-border)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--ev-ink-muted)',
                cursor: 'pointer',
              }}
            >
              חזרה להתחברות
            </button>
          </div>
        )}

        {errorMessage && <div className="ev-alert-error">{errorMessage}</div>}

        {successMessage && (
          <div
            style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#15803D',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '0.86rem',
              marginBottom: '14px',
              lineHeight: 1.5,
            }}
          >
            {successMessage}
          </div>
        )}

        {authMode === 'forgot' ? (
          forgotStep === 'request' ? (
            <form onSubmit={handleForgotRequest}>
              <div className="form-group">
                <label htmlFor="forgot-email">כתובת אימייל</label>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="form-control"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                />
              </div>

              <button type="submit" className="btn" disabled={forgotLoading}>
                {forgotLoading ? 'שולח בקשה...' : 'שלח קוד איפוס'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              {devResetCode && (
                <div
                  className="ev-alert-brand"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    marginBottom: '14px',
                  }}
                >
                  מצב פיתוח מקומי (ללא שרת מייל): קוד האימות שלך הוא{' '}
                  <strong className="tabular-nums" dir="ltr">
                    {devResetCode}
                  </strong>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="reset-email">כתובת אימייל</label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                />
              </div>

              <div className="form-group">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <label htmlFor="reset-code" style={{ margin: 0 }}>
                    קוד אימות (6 ספרות)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('request');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      color: 'var(--ev-brand)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    שלח קוד מחדש
                  </button>
                </div>
                <input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="form-control tabular-nums"
                  placeholder="123456"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  dir="ltr"
                  style={{ textAlign: 'left', letterSpacing: '0.2em', fontWeight: 700 }}
                />
              </div>

              <div className="form-group">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
                  }}
                >
                  <label htmlFor="reset-password" style={{ margin: 0 }}>
                    סיסמה חדשה (8+ תווים, אות באנגלית ומספר)
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateStrongPassword}
                    style={{
                      background: 'var(--ev-brand-soft)',
                      color: 'var(--ev-brand-hover)',
                      border: '1px solid var(--ev-brand-border)',
                      borderRadius: '7px',
                      padding: '3px 9px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    צור סיסמה חזקה
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-password"
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    dir="ltr"
                    style={{ textAlign: 'left', paddingRight: '38px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    style={eyeButtonStyle}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reset-confirm-password">אימות סיסמה חדשה</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-confirm-password"
                    name="confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    dir="ltr"
                    style={{ textAlign: 'left', paddingRight: '38px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    title={showConfirmPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    style={eyeButtonStyle}
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
              </div>

              <button type="submit" className="btn" disabled={forgotLoading}>
                {forgotLoading ? 'מעדכן סיסמה...' : 'אפס סיסמה ועבור להתחברות'}
              </button>
            </form>
          )
        ) : (
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
                  <label htmlFor="auth-fullname">שם מלא</label>
                  <input
                    id="auth-fullname"
                    name="name"
                    type="text"
                    autoComplete="name"
                    className="form-control"
                    placeholder="ישראל ישראלי"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="auth-phone">טלפון</label>
                  <input
                    id="auth-phone"
                    name="tel"
                    type="tel"
                    autoComplete="tel"
                    className="form-control"
                    placeholder="050-1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="auth-email">כתובת אימייל</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                className="form-control"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                style={{ textAlign: 'left' }}
              />
            </div>

            <div className="form-group">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                }}
              >
                <label htmlFor="auth-password" style={{ margin: 0 }}>
                  {authMode === 'register'
                    ? 'סיסמה (לפחות 8 תווים, אות באנגלית ומספר)'
                    : 'סיסמה'}
                </label>
                {authMode === 'register' ? (
                  <button
                    type="button"
                    onClick={handleGenerateStrongPassword}
                    style={{
                      background: 'var(--ev-brand-soft)',
                      color: 'var(--ev-brand-hover)',
                      border: '1px solid var(--ev-brand-border)',
                      borderRadius: '7px',
                      padding: '3px 9px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    צור סיסמה חזקה
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot');
                      setForgotStep('request');
                      setErrorMessage('');
                      setSuccessMessage('');
                      setPassword('');
                      setConfirmPassword('');
                      setDevResetCode(null);
                      setResetCode('');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      color: 'var(--ev-brand)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    שכחתי סיסמה?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="auth-password"
                  name={authMode === 'register' ? 'new-password' : 'password'}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  style={{ textAlign: 'left', paddingRight: '38px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  style={eyeButtonStyle}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {authMode === 'register' && (
                <div style={{ fontSize: '0.75rem', color: 'var(--ev-ink-soft)', marginTop: '5px' }}>
                  Chrome/Google יציעו אוטומטית סיסמה חזקה בשדה זה, או שניתן ליצור סיסמה בלחיצה למעלה.
                </div>
              )}
            </div>

            {authMode === 'register' && (
              <div className="form-group">
                <label htmlFor="auth-confirm-password">אימות סיסמה</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="auth-confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    dir="ltr"
                    style={{ textAlign: 'left', paddingRight: '38px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    title={showConfirmPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    style={eyeButtonStyle}
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
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
              {loading
                ? 'מתחבר לשרת...'
                : authMode === 'login'
                  ? 'כניסה למערכת'
                  : 'יצירת חשבון והמשך'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}