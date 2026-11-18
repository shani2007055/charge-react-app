
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Mail,
  LockKeyhole,
  UserRound,
  Phone,
  CarFront,
  Zap,
  MapPin,
  CalendarCheck,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  LoaderCircle,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

import AuthField from './AuthField';

import { apiFetch } from '../api/apiClient';
import { getErrorMessage } from '../utils/errorHandler';

import {
  useAppDispatch,
  useAppSelector
} from '../store/hooks';

import {
  loginUser,
  registerUser
} from '../store/user/userThunks';

import type { UserRole } from '../store/user/userState';

import {
  validateLogin,
  validateRegister,
  validateEmail,
  validateReset,
  type AuthErrors,
  type AuthFieldName
} from '../utils/authValidation';

import './LoginScreen.css';

type AuthMode = 'login' | 'register' | 'forgot';

interface ForgotPasswordResponse {
  message?: string;
  sentViaEmail?: boolean;
  devCode?: string | null;
}

function buildStrongPassword(): string {
  const groups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%&*'
  ];

  const all = groups.join('');

  const pick = (pool: string) => {
    const random = crypto.getRandomValues(
      new Uint32Array(1)
    )[0];

    return pool[random % pool.length];
  };

  const chars = groups.map(pick);

  while (chars.length < 16) {
    chars.push(pick(all));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const random = crypto.getRandomValues(
      new Uint32Array(1)
    )[0];

    const j = random % (i + 1);

    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export default function LoginScreen() {

  const [mode, setMode] = useState<AuthMode>('login');

  const [searchParams] = useSearchParams();

const [role, setRole] = useState<UserRole>(
  searchParams.get('role') === 'Owner'
    ? 'Owner'
    : 'Driver'
);

  const [values, setValues] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    code: ''
  });

  const [errors, setErrors] =
    useState<AuthErrors>({});

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [forgotStep, setForgotStep] =
    useState<'request' | 'reset'>('request');

  const [forgotLoading, setForgotLoading] =
    useState(false);

  const [resetEmail, setResetEmail] = useState('');

  const [devCode, setDevCode] =
    useState<string | null>(null);

  const dispatch = useAppDispatch();
 

  const { loading, sessionExpiredMessage } =
    useAppSelector(state => state.user);

  const busy = loading || forgotLoading;

  function updateField(
    name: AuthFieldName,
    value: string
  ) {
    setValues(previous => ({
      ...previous,
      [name]: value
    }));

    setErrors(previous => ({
      ...previous,
      [name]: undefined
    }));

    setErrorMessage('');
  }

  function changeMode(nextMode: AuthMode) {

    if (busy) return;

    setMode(nextMode);
    setErrors({});
    setErrorMessage('');
    setSuccessMessage('');
    setForgotStep('request');
    setDevCode(null);
    setResetEmail('');

    setValues(previous => ({
      ...previous,
      password: '',
      confirmPassword: '',
      code: ''
    }));
  }

  function generatePassword() {

    const password = buildStrongPassword();

    setValues(previous => ({
      ...previous,
      password,
      confirmPassword: password
    }));

    setErrors(previous => ({
      ...previous,
      password: undefined,
      confirmPassword: undefined
    }));

    setSuccessMessage(
      'נוצרה סיסמה חזקה. מומלץ לשמור אותה במנהל הסיסמאות.'
    );
    setErrorMessage('');
  }

  async function handleAuth() {

    const validation =
      mode === 'register'
        ? validateRegister(values)
        : validateLogin(values.email, values.password);

    setErrors(validation);

    if (Object.keys(validation).length > 0) return;

    try {

      if (mode === 'login') {

        await dispatch(loginUser({
          email: values.email.trim(),
          password: values.password,
          role
        })).unwrap();

      } else {

        await dispatch(registerUser({
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          password: values.password,
          confirmPassword: values.confirmPassword,
          role
        })).unwrap();
      }

      

    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleForgot() {

    if (forgotStep === 'request') {

      const emailError = validateEmail(values.email);

      if (emailError) {
        setErrors({ email: emailError });
        return;
      }

      setForgotLoading(true);

      try {

        const email = values.email.trim();

        const response =
          await apiFetch<ForgotPasswordResponse>(
            '/users/forgot-password',
            {
              method: 'POST',
              body: JSON.stringify({ email })
            }
          );

        setResetEmail(email);
        setForgotStep('reset');

        if (import.meta.env.DEV) {
          setDevCode(response.devCode ?? null);
        }

        setSuccessMessage(
          'אם החשבון קיים, נשלח קוד איפוס לכתובת האימייל.'
        );

      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setForgotLoading(false);
      }

    } else {

      const validation = validateReset(
        resetEmail,
        values.code,
        values.password,
        values.confirmPassword
      );

      setErrors(validation);

      if (Object.keys(validation).length > 0) return;

      setForgotLoading(true);

      try {

        await apiFetch('/users/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            email: resetEmail,
            code: values.code.trim(),
            newPassword: values.password,
            confirmNewPassword: values.confirmPassword
          })
        });

        setMode('login');
        setForgotStep('request');
        setDevCode(null);
        setResetEmail('');

        setValues(previous => ({
          ...previous,
          password: '',
          confirmPassword: '',
          code: ''
        }));

        setSuccessMessage(
          'הסיסמה אופסה בהצלחה. ניתן להתחבר כעת.'
        );

      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setForgotLoading(false);
      }
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy) return;

    setErrors({});
    setErrorMessage('');
    setSuccessMessage('');

    if (mode === 'forgot') {
      await handleForgot();
    } else {
      await handleAuth();
    }
  }

  const title =
    mode === 'login'
      ? 'טוב שחזרתם'
      : mode === 'register'
        ? 'בואו נתחיל'
        : 'שחזור סיסמה';

  return (
    <div className="auth-page" dir="rtl">

      <aside className="auth-visual">

        <div className="auth-visual-content">

          <div className="auth-tag">
            <Zap size={16} />
            SMART EV EXPERIENCE
          </div>

          <h2>
            כל הדרך שלך.
            <span> במקום אחד.</span>
          </h2>

          <p>
            חיפוש חכם, שריון מראש וניהול טעינה פשוט.
          </p>

          <div className="auth-benefits">

            <div>
              <MapPin />
              מציאת התחנה המתאימה
            </div>

            <div>
              <CalendarCheck />
              שריון בזמן אמת
            </div>

            <div>
              <ShieldCheck />
              חיבור מאובטח
            </div>

          </div>

        </div>

      </aside>

      <section className="auth-panel">

        <Link to="/" className="auth-back">
          <ArrowRight size={17} />
          חזרה לדף הבית
        </Link>

        <div className="auth-heading">

          <span className="auth-kicker">
            SMART EV
          </span>

          <h1>{title}</h1>

          <p>
            {mode === 'login'
              ? 'התחברו לחשבון שלכם והמשיכו בדרך'
              : mode === 'register'
                ? 'הצטרפו לעולם הטעינה החכמה'
                : 'נחזיר לכם את הגישה לחשבון'}
          </p>

        </div>

        {mode !== 'forgot' && (
          <div className="auth-tabs">

            <button
              type="button"
              disabled={busy}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => changeMode('login')}
            >
              התחברות
            </button>

            <button
              type="button"
              disabled={busy}
              className={mode === 'register' ? 'active' : ''}
              onClick={() => changeMode('register')}
            >
              הרשמה חדשה
            </button>

          </div>
        )}

        {(errorMessage || sessionExpiredMessage) && (
          <div className="auth-message error" role="alert">
            <AlertCircle size={19} />
            {errorMessage || sessionExpiredMessage}
          </div>
        )}

        {successMessage && (
          <div className="auth-message success" role="status">
            <CheckCircle2 size={19} />
            {successMessage}
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
          noValidate
        >

          {mode !== 'forgot' && (
            <>
              <label className="auth-role-title">
                בחירת פרופיל
              </label>

              <div className="auth-role-options">

                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={role === 'Driver'}
                  className={role === 'Driver' ? 'selected' : ''}
                  onClick={() => setRole('Driver')}
                >
                  <CarFront size={24} />
                  <strong>נהג</strong>
                  <small>חיפוש וטעינה</small>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={role === 'Owner'}
                  className={role === 'Owner' ? 'selected' : ''}
                  onClick={() => setRole('Owner')}
                >
                  <Zap size={24} />
                  <strong>בעל תחנה</strong>
                  <small>ניהול עמדות</small>
                </button>

              </div>
            </>
          )}

          {mode === 'register' && (
            <div className="auth-field-grid">

              <AuthField
                name="name"
                label="שם מלא"
                icon={UserRound}
                autoComplete="name"
                value={values.name}
                maxLength={60}
                error={errors.name}
                disabled={busy}
                onChange={v => updateField('name', v)}
              />

              <AuthField
                name="phone"
                label="מספר טלפון"
                type="tel"
                icon={Phone}
                autoComplete="tel"
                value={values.phone}
                placeholder="050-1234567"
                error={errors.phone}
                disabled={busy}
                onChange={v => updateField('phone', v)}
              />

            </div>
          )}

          <AuthField
            name="email"
            label="כתובת אימייל"
            type="email"
            icon={Mail}
            autoComplete="email"
            value={
              mode === 'forgot' && forgotStep === 'reset'
                ? resetEmail
                : values.email
            }
            placeholder="name@example.com"
            error={errors.email}
            disabled={
              busy ||
              (mode === 'forgot' && forgotStep === 'reset')
            }
            onChange={v => updateField('email', v)}
          />

          {mode === 'forgot' && forgotStep === 'reset' && (
            <>
              {import.meta.env.DEV && devCode && (
                <div className="auth-dev-code">
                  קוד פיתוח מקומי: {devCode}
                </div>
              )}

              <AuthField
                name="code"
                label="קוד אימות"
                icon={KeyRound}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={values.code}
                error={errors.code}
                disabled={busy}
                onChange={v =>
                  updateField(
                    'code',
                    v.replace(/\D/g, '').slice(0, 6)
                  )
                }
              />
            </>
          )}

          {(mode !== 'forgot' || forgotStep === 'reset') && (
            <AuthField
              name="password"
              label={
                mode === 'forgot'
                  ? 'סיסמה חדשה'
                  : 'סיסמה'
              }
              type="password"
              icon={LockKeyhole}
              autoComplete={
                mode === 'login'
                  ? 'current-password'
                  : 'new-password'
              }
              value={values.password}
              error={errors.password}
              disabled={busy}
              onChange={v => updateField('password', v)}
            />
          )}

          {(mode === 'register' ||
            (mode === 'forgot' && forgotStep === 'reset')) && (
            <>
              <AuthField
                name="confirmPassword"
                label="אימות סיסמה"
                type="password"
                icon={LockKeyhole}
                autoComplete="new-password"
                value={values.confirmPassword}
                error={errors.confirmPassword}
                disabled={busy}
                onChange={v =>
                  updateField('confirmPassword', v)
                }
              />

              <div className="auth-password-info">
                לפחות 8 תווים, אות באנגלית ומספר.

                <button
                  type="button"
                  className="auth-text-button"
                  disabled={busy}
                  onClick={generatePassword}
                >
                  יצירת סיסמה חזקה
                </button>
              </div>
            </>
          )}

          {mode === 'login' && (
            <button
              type="button"
              className="auth-text-button"
              disabled={busy}
              onClick={() => changeMode('forgot')}
            >
              שכחתי סיסמה
            </button>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={busy}
          >

            {busy ? (
              <>
                <LoaderCircle className="auth-spinner" size={20} />
                מבצע פעולה...
              </>
            ) : (
              <>
                {mode === 'login'
                  ? 'כניסה למערכת'
                  : mode === 'register'
                    ? 'יצירת חשבון'
                    : forgotStep === 'request'
                      ? 'שליחת קוד איפוס'
                      : 'איפוס סיסמה'}

                <ArrowLeft size={20} />
              </>
            )}

          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              className="auth-text-button"
              disabled={busy}
              onClick={() => changeMode('login')}
            >
              חזרה להתחברות
            </button>
          )}

          {mode === 'forgot' && forgotStep === 'reset' && (
            <button
              type="button"
              className="auth-text-button"
              disabled={busy}
              onClick={() => changeMode('forgot')}
            >
              בקשת קוד חדש
            </button>
          )}

        </form>

        <div className="auth-security">
          <ShieldCheck size={17} />
          הגישה לחשבון מוגנת באמצעות אימות משתמשים
        </div>

      </section>

    </div>
  );
}
