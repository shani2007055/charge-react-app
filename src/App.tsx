import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAppSelector((state) => state.user.token);
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function Layout() {
  const { token, role, name } = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const homePath = role === 'Owner' ? '/owner' : '/search';

  useEffect(() => {
    const handleSessionExpired = () => {
      dispatch(expireSession());
      navigate('/', { replace: true });
    };
    window.addEventListener('auth:expired', handleSessionExpired);
    return () => window.removeEventListener('auth:expired', handleSessionExpired);
  }, [dispatch, navigate]);

  return (
    <div className="ev-app-shell" dir="rtl">
      <svg
        className="ev-bg-contours"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d="M-80 180 C 260 90, 440 340, 820 220 C 1120 125, 1290 280, 1520 190"
          stroke="#EA580C"
          strokeWidth="2.5"
        />
        <path
          d="M-60 440 C 310 520, 580 310, 960 430 C 1220 510, 1340 390, 1520 460"
          stroke="#EA580C"
          strokeWidth="1.5"
          strokeDasharray="8 8"
        />
        <path
          d="M-40 720 C 280 610, 640 820, 1020 670 C 1260 575, 1380 690, 1520 640"
          stroke="#EA580C"
          strokeWidth="2"
        />
        <circle cx="820" cy="220" r="7" fill="#EA580C" />
        <circle cx="960" cy="430" r="6" fill="#EA580C" />
        <circle cx="310" cy="485" r="5" fill="#EA580C" />
      </svg>

      <header className="ev-header">
        <div className="ev-header-inner">
          <button
            type="button"
            className="ev-brand"
            onClick={() => navigate(token ? homePath : '/')}
          >
            <svg
              className="ev-brand-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>Smart EV</span>
          </button>

          {token && (
            <nav className="ev-nav" aria-label="ניווט ראשי">
              <button
                type="button"
                className={`ev-nav-link ${location.pathname === homePath ? 'active' : ''}`}
                onClick={() => navigate(homePath)}
              >
                {role === 'Owner' ? 'ניהול עמדות' : 'חיפוש עמדות'}
              </button>

              {role === 'Driver' && (
                <>
                  <button
                    type="button"
                    className={`ev-nav-link ${location.pathname === '/results' ? 'active' : ''}`}
                    onClick={() => navigate('/results')}
                  >
                    מפה ותוצאות
                  </button>
                  <button
                    type="button"
                    className={`ev-nav-link ${location.pathname === '/active' ? 'active' : ''}`}
                    onClick={() => navigate('/active')}
                  >
                    השריון שלי
                  </button>
                </>
              )}

              <button
                type="button"
                className={`ev-nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
                onClick={() => navigate('/profile')}
              >
                פרופיל
              </button>
            </nav>
          )}

          {token && (
            <div className="ev-header-actions">
              <span className="ev-user-greeting">שלום, {name}</span>
              <button
                type="button"
                className="ev-btn ev-btn-secondary ev-btn-auto"
                onClick={() => {
                  dispatch(logout());
                  navigate('/');
                }}
              >
                התנתקות
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="ev-main">
        <Outlet />
      </main>

      {token && <VoiceAgentWidget />}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/search" element={<ProtectedRoute><DriverSearchScreen /></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute><StationResultsScreen /></ProtectedRoute>} />
        <Route path="/active" element={<ProtectedRoute><ActiveSessionScreen /></ProtectedRoute>} />
        <Route path="/rating" element={<ProtectedRoute><RatingAndReportScreen /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><UserProfileScreen /></ProtectedRoute>} />
        <Route path="/owner" element={<ProtectedRoute><StationOwnerScreen /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}