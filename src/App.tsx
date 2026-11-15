
import { useEffect, type ReactNode } from 'react';

import {
  Navigate,
  Outlet,
  Route,
  Routes,
  NavLink,
  useNavigate
} from 'react-router-dom';
import RoleSwitcher from './components/RoleSwitcher';
import AdminDashboard from './components/admin/AdminDashboard';
import { isAdminToken } from './store/user/userState';
import HomeScreen from './components/HomeScreen';
import LoginScreen from './components/LoginScreen';
import DriverSearchScreen from './components/DriverSearchScreen';
import StationResultsScreen from './components/StationResultsScreen';
import ActiveSessionScreen from './components/ActiveSessionScreen';
import RatingAndReportScreen from './components/RatingAndReportScreen';
import UserProfileScreen from './components/UserProfileScreen';
import StationOwnerScreen from './components/StationOwnerScreen';
import VoiceAgentWidget from './components/VoiceAgentWidget';

import { useAppDispatch, useAppSelector } from './store/hooks';
import { expireSession, logout } from './store/user/userSlice';

import './App.css';
import './Modern.css';

function ProtectedRoute({
  children,
  requiredRole
}: {
  children: ReactNode;
  requiredRole?: 'Driver' | 'Owner';
}) {
  const { token, role } = useAppSelector(state => state.user);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isAdminToken(token)) {
    return <Navigate to="/admin" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return (
      <Navigate
        to={role === 'Owner' ? '/owner' : '/search'}
        replace
      />
    );
  }

  return <>{children}</>;
}
function AdminRoute({ children }: { children: ReactNode }) {

  const { token, role } = useAppSelector(
    state => state.user
  );

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminToken(token)) {
    return (
      <Navigate
        to={role === 'Owner' ? '/owner' : '/search'}
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

const homePath = isAdmin
  ? '/admin'
  : role === 'Owner'
    ? '/owner'
    : '/search';

  useEffect(() => {

    const handleSessionExpired = () => {
      dispatch(expireSession());
      navigate('/login', { replace: true });
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

  return (
    <div className="ev-app-shell" dir="rtl">

      <header className="modern-header">

        <div className="modern-header-inner">

          <NavLink to="/" className="modern-logo">
            <span className="modern-logo-icon">⚡</span>

            <span>
              Smart EV
              <small>CHARGE SMARTER</small>
            </span>
          </NavLink>

          <nav className="modern-nav">

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
                  className="modern-outline"
                  onClick={() => {
                    dispatch(logout());
                    navigate('/');
                  }}
                >
                  התנתקות
                </button>
              </>
            ) : (
              <button
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
        <strong>⚡ Smart EV</strong>

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

  const isAdmin = isAdminToken(token);

const homePath = isAdmin
  ? '/admin'
  : role === 'Owner'
    ? '/owner'
    : '/search';

  return (
    <Routes>
      <Route path="/admin" element={
  <AdminRoute>
    <AdminDashboard />
  </AdminRoute>
} />

      <Route element={<Layout />}>

        <Route path="/" element={<HomeScreen />} />

        <Route path="/login" element={
          token
            ? <Navigate to={homePath} replace />
            : <LoginScreen />
        } />

        <Route path="/search" element={
          <ProtectedRoute requiredRole="Driver">
            <DriverSearchScreen />
          </ProtectedRoute>
        } />

        <Route path="/results" element={
          <ProtectedRoute requiredRole="Driver">
            <StationResultsScreen />
          </ProtectedRoute>
        } />

        <Route path="/active" element={
          <ProtectedRoute requiredRole="Driver">
            <ActiveSessionScreen />
          </ProtectedRoute>
        } />

        <Route path="/rating" element={
          <ProtectedRoute requiredRole="Driver">
            <RatingAndReportScreen />
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <UserProfileScreen />
          </ProtectedRoute>
        } />

        <Route path="/owner" element={
          <ProtectedRoute requiredRole="Owner">
            <StationOwnerScreen />
          </ProtectedRoute>
        } />

        <Route path="*" element={
          <Navigate to="/" replace />
        } />

      </Route>

    </Routes>
  );
}
