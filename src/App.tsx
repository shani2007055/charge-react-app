import { useEffect, type ReactNode } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { Zap } from 'lucide-react';
import RoleSwitcher from './components/RoleSwitcher';
import AdminDashboard from './components/admin/AdminDashboard';
import HomeScreen from './components/HomeScreen';
import WelcomeScreen from './components/WelcomeScreen';
import LoginScreen from './components/LoginScreen';
import DriverSearchScreen from './components/DriverSearchScreen';
import StationResultsScreen from './components/StationResultsScreen';
import StationDetailsScreen from './components/StationDetailsScreen';
import ActiveSessionScreen from './components/ActiveSessionScreen';
import RatingAndReportScreen from './components/RatingAndReportScreen';
import UserProfileScreen from './components/UserProfileScreen';
import StationOwnerScreen from './components/StationOwnerScreen';
import VoiceAgentWidget from './components/VoiceAgentWidget';
import {
  isAdminToken,
  type UserRole,
} from './store/user/userState';
import {
  useAppDispatch,
  useAppSelector,
} from './store/hooks';
import {
  expireSession,
  logout,
} from './store/user/userSlice';
import './App.css';
import './Modern.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

function getHomePath(
  token: string | null,
  role: UserRole
) {
  if (isAdminToken(token)) {
    return '/admin';
  }

  return role === 'Owner'
    ? '/owner'
    : '/search';
}

function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: UserRole;
}) {
  const { token, role } = useAppSelector(
    (state) => state.user
  );

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isAdminToken(token)) {
    return <Navigate to="/admin" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return (
      <Navigate
        to={getHomePath(token, role)}
        replace
      />
    );
  }

  return <>{children}</>;
}

function AdminRoute({
  children,
}: {
  children: ReactNode;
}) {
  const { token, role } = useAppSelector(
    (state) => state.user
  );

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminToken(token)) {
    return (
      <Navigate
        to={getHomePath(token, role)}
        replace
      />
    );
  }

  return <>{children}</>;
}

function Layout() {
  const { token, role, name } = useAppSelector(
    (state) => state.user
  );

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = isAdminToken(token);
  const homePath = getHomePath(token, role);
  const showRouteBg = pathname !== '/' && pathname !== '/login';

  useEffect(() => {
    const handleSessionExpired = () => {
      dispatch(expireSession());
      navigate('/login', {
        replace: true,
      });
    };

    window.addEventListener(
      'auth:expired',
      handleSessionExpired
    );

    return () =>
      window.removeEventListener(
        'auth:expired',
        handleSessionExpired
      );
  }, [dispatch, navigate]);

  function handleLogout() {
    dispatch(logout());
    navigate('/', {
      replace: true,
    });
  }

  return (
    <div
      className={`ev-app-shell${showRouteBg ? ' with-route-bg' : ''}`}
      dir="rtl"
    >
      {showRouteBg && (
        <svg
          className="ev-bg-route-svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path
            d="M -40 165 Q 380 55 780 145 T 1490 95"
            fill="none"
            stroke="#EA580C"
            strokeWidth="2"
            strokeDasharray="7 8"
            strokeOpacity="0.34"
          />
          <path
            d="M -60 220 Q 440 110 920 205 T 1500 155"
            fill="none"
            stroke="#EA580C"
            strokeWidth="1.6"
            strokeOpacity="0.18"
          />
          <path
            d="M -40 480 C 310 340, 690 540, 1080 370 S 1400 290, 1500 350"
            fill="none"
            stroke="#EA580C"
            strokeWidth="2"
            strokeDasharray="7 8"
            strokeOpacity="0.3"
          />
          <path
            d="M -60 760 Q 410 630 880 770 T 1500 680"
            fill="none"
            stroke="#475569"
            strokeWidth="1.8"
            strokeDasharray="6 8"
            strokeOpacity="0.22"
          />

          <circle cx="360" cy="105" r="10" fill="#EA580C" fillOpacity="0.1" />
          <circle cx="360" cy="105" r="4" fill="#EA580C" fillOpacity="0.38" />

          <circle cx="1020" cy="132" r="11" fill="#EA580C" fillOpacity="0.1" />
          <circle cx="1020" cy="132" r="4.5" fill="#EA580C" fillOpacity="0.38" />

          <circle cx="180" cy="420" r="9" fill="#EA580C" fillOpacity="0.09" />
          <circle cx="180" cy="420" r="3.5" fill="#EA580C" fillOpacity="0.32" />

          <circle cx="1260" cy="340" r="10" fill="#EA580C" fillOpacity="0.09" />
          <circle cx="1260" cy="340" r="4" fill="#EA580C" fillOpacity="0.34" />

          <circle cx="880" cy="770" r="10" fill="#475569" fillOpacity="0.08" />
          <circle cx="880" cy="770" r="4" fill="#475569" fillOpacity="0.28" />
        </svg>
      )}

      <header className="modern-header">
        <div className="modern-header-inner">
          <NavLink
            to="/"
            className="modern-logo"
          >
            <span className="modern-logo-icon">
              <Zap size={25} />
            </span>
            <span>
              Smart EV
              <small>CHARGE SMARTER</small>
            </span>
          </NavLink>

          <nav
            className="modern-nav"
            aria-label="ניווט ראשי"
          >
            <NavLink to="/" end>
              דף הבית
            </NavLink>

            {token && (
              isAdmin ? (
                <NavLink to="/admin">
                  לוח בקרה
                </NavLink>
              ) : (
                <>
                  <NavLink to={homePath}>
                    {role === 'Owner'
                      ? 'ניהול תחנות'
                      : 'חיפוש עמדות'}
                  </NavLink>

                  {role === 'Driver' && (
                    <>
                      <NavLink to="/results">
                        מפה ותוצאות
                      </NavLink>

                      <NavLink to="/active">
                        השריון שלי
                      </NavLink>
                    </>
                  )}

                  <NavLink to="/profile">
                    הפרופיל שלי
                  </NavLink>
                </>
              )
            )}
          </nav>

          <div className="modern-actions">
            {token ? (
              <>
                <RoleSwitcher />

                <span className="modern-user">
                  שלום, {name}
                </span>

                <button
                  type="button"
                  className="modern-outline"
                  onClick={handleLogout}
                >
                  התנתקות
                </button>
              </>
            ) : (
              <button
                type="button"
                className="modern-primary"
                onClick={() => navigate('/login')}
              >
                כניסה למערכת
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="ev-main">
        <Outlet />
      </main>

      {token && !isAdmin && role === 'Driver' && (
        <VoiceAgentWidget />
      )}

      <footer className="modern-footer">
        <strong>
          <Zap
            size={18}
            style={{ verticalAlign: 'middle' }}
          />
          {' '}Smart EV
        </strong>

        <span>
          הדרך החכמה לטעינה חשמלית
        </span>
      </footer>
    </div>
  );
}

export default function App() {
  const { token, role } = useAppSelector(
    (state) => state.user
  );

  const homePath = getHomePath(token, role);

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/"
            element={<HomeScreen />}
          />

          <Route
            path="/login"
            element={
              token
                ? <Navigate to={homePath} replace />
                : <LoginScreen />
            }
          />
            <Route
  path="/welcome"
  element={
    <ProtectedRoute>
      <WelcomeScreen />
    </ProtectedRoute>
  }
/>
          <Route
            path="/search"
            element={
              <ProtectedRoute requiredRole="Driver">
                <DriverSearchScreen />
              </ProtectedRoute>
            }
          />

          <Route
            path="/results"
            element={
              <ProtectedRoute requiredRole="Driver">
                <StationResultsScreen />
              </ProtectedRoute>
            }
          />

          <Route
            path="/stations/:id"
            element={
              <ProtectedRoute requiredRole="Driver">
                <StationDetailsScreen />
              </ProtectedRoute>
            }
          />

          <Route
            path="/active"
            element={
              <ProtectedRoute requiredRole="Driver">
                <ActiveSessionScreen />
              </ProtectedRoute>
            }
          />

          <Route
            path="/rating"
            element={
              <ProtectedRoute requiredRole="Driver">
                <RatingAndReportScreen />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfileScreen />
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner"
            element={
              <ProtectedRoute requiredRole="Owner">
                <StationOwnerScreen />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Route>
      </Routes>
    </>
  );
}