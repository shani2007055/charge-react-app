
import { useEffect, type ReactNode } from 'react';

import {
  Navigate,
  Outlet,
  Route,
  Routes,
  NavLink,
  useNavigate
} from 'react-router-dom';
import { Zap, Mic } from 'lucide-react';
import RoleSwitcher from './components/RoleSwitcher';
import AdminDashboard from './components/admin/AdminDashboard';
import HomeScreen from './components/HomeScreen';
import LoginScreen from './components/LoginScreen';
import DriverSearchScreen from './components/DriverSearchScreen';
import StationResultsScreen from './components/StationResultsScreen';
import ActiveSessionScreen from './components/ActiveSessionScreen';
import RatingAndReportScreen from './components/RatingAndReportScreen';
import UserProfileScreen from './components/UserProfileScreen';
import StationOwnerScreen from './components/StationOwnerScreen';
import VoiceAgentWidget from './components/VoiceAgentWidget';

import {
  isAdminToken,
  type UserRole
} from './store/user/userState';

import {
  useAppDispatch,
  useAppSelector
} from './store/hooks';

import {
  expireSession,
  logout
} from './store/user/userSlice';

import './App.css';
import './Modern.css';


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
  requiredRole
}: {
  children: ReactNode;
  requiredRole?: UserRole;
}) {

  const { token, role } = useAppSelector(
    state => state.user
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
  children
}: {
  children: ReactNode;
}) {

  const { token, role } = useAppSelector(
    state => state.user
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
    state => state.user
  );

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const isAdmin = isAdminToken(token);
  const homePath = getHomePath(token, role);

  useEffect(() => {

    const handleSessionExpired = () => {
      dispatch(expireSession());

      navigate('/login', {
        replace: true
      });
    };

    window.addEventListener(
      'auth:expired',
      handleSessionExpired
    );

    return () => window.removeEventListener(
      'auth:expired',
      handleSessionExpired
    );

  }, [dispatch, navigate]);


  function handleLogout() {
    dispatch(logout());

    navigate('/', {
      replace: true
    });
  }


  return (
    <div className="ev-app-shell" dir="rtl">

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
                      <button
  type="button"
  className="modern-ai-nav"
  onClick={() => {
    window.dispatchEvent(
      new Event('smart-ev:open-assistant')
    );
  }}
>
  <Mic size={17} />
  עוזר AI
</button>

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
    state => state.user
  );

  const homePath = getHomePath(token, role);

  return (
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
  );
}
