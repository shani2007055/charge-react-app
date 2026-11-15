import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
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

// רכיב הגנה: מי שלא מחובר עם Token מוחזר אוטומטית למסך ההתחברות
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
    <div className="container" dir="rtl">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ color: 'white', margin: 0 }}>⚡ Smart EV Charging</h1>
          <p style={{ color: '#94a3b8', margin: '4px 0 0 0' }}>מערכת חכמה לחיפוש עמדות, שריון שקע וניהול קהילתי</p>
        </div>

        {/* תפריט עליון נקי המופיע רק למשתמש מחובר */}
        {token && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.9rem', marginLeft: '6px' }}>שלום, {name}</span>
            <button type="button" className="btn" style={{ width: 'auto', padding: '8px 14px', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => navigate(homePath)}>
              🏠 מסך ראשי
            </button>
            {role === 'Driver' && (
              <button type="button" className="btn" style={{ width: 'auto', padding: '8px 14px', fontSize: '0.85rem', background: '#1e293b', cursor: 'pointer' }} onClick={() => navigate('/active')}>
                ⏱️ השריון שלי
              </button>
            )}
            <button type="button" className="btn" style={{ width: 'auto', padding: '8px 14px', fontSize: '0.85rem', background: '#1e293b', cursor: 'pointer' }} onClick={() => navigate('/profile')}>
              👤 פרופיל
            </button>
            <button
              type="button"
              className="btn"
              style={{ width: 'auto', padding: '8px 14px', fontSize: '0.85rem', background: '#7f1d1d', cursor: 'pointer' }}
              onClick={() => {
                dispatch(logout());
                navigate('/');
              }}
            >
              🚪 התנתק
            </button>
          </div>
        )}
      </header>

      <main>
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