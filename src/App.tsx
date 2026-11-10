import { Routes, Route, Link, NavLink, Outlet } from 'react-router-dom';
import LoginScreen from './components/LoginScreen';
import DriverSearchScreen from './components/DriverSearchScreen';
import StationResultsScreen from './components/StationResultsScreen';
import ActiveSessionScreen from './components/ActiveSessionScreen';
import RatingAndReportScreen from './components/RatingAndReportScreen';
import UserProfileScreen from './components/UserProfileScreen';
import StationOwnerScreen from './components/StationOwnerScreen';
import './App.css';

// קומפוננטת מעטפת (Layout) עם תפריט ניווט קבוע ו-Outlet לתוכן המתחלף
function Layout() {
  return (
    <div className="container" dir="rtl">
      <header>
        <div>
          <h1>⚡ Smart EV Charging</h1>
          <p>מערכת חכמה לחיפוש עמדות, שריון שקע וניהול קהילתי</p>
        </div>
      </header>

      {/* תפריט ניווט עליון עם NavLink המדגיש אוטומטית את העמוד הפעיל */}
      <nav style={{ 
        display: 'flex', 
        gap: '8px', 
        overflowX: 'auto', 
        padding: '10px', 
        background: '#1e1e1e', 
        borderRadius: '12px', 
        marginBottom: '20px', 
        border: '1px solid #333' 
      }}>
        <NavLink to="/" style={({ isActive }) => ({ padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', background: isActive ? 'var(--accent-blue)' : '#121212', color: 'white', fontSize: '0.85rem' })}>
          1. התחברות
        </NavLink>
        <NavLink to="/search" style={({ isActive }) => ({ padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', background: isActive ? 'var(--accent-blue)' : '#121212', color: 'white', fontSize: '0.85rem' })}>
          2. חיפוש נהג
        </NavLink>
        <NavLink to="/results" style={({ isActive }) => ({ padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', background: isActive ? 'var(--accent-blue)' : '#121212', color: 'white', fontSize: '0.85rem' })}>
          3. תוצאות והמלצות
        </NavLink>
        <NavLink to="/active" style={({ isActive }) => ({ padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', background: isActive ? 'var(--accent-blue)' : '#121212', color: 'white', fontSize: '0.85rem' })}>
          4. ניווט ושריון
        </NavLink>
        <NavLink to="/rating" style={({ isActive }) => ({ padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', background: isActive ? 'var(--accent-blue)' : '#121212', color: 'white', fontSize: '0.85rem' })}>
          5. דירוג ודיווח
        </NavLink>
        <NavLink to="/profile" style={({ isActive }) => ({ padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', background: isActive ? 'var(--accent-blue)' : '#121212', color: 'white', fontSize: '0.85rem' })}>
          6. פרופיל
        </NavLink>
        <NavLink to="/owner" style={({ isActive }) => ({ padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', background: isActive ? 'var(--primary)' : '#121212', color: isActive ? 'black' : 'white', fontWeight: 'bold', fontSize: '0.85rem' })}>
          7. פנאל בעל תחנה
        </NavLink>
      </nav>

      {/* מקום הצגת המסך הנוכחי בהתאם לכתובת (Outlet) */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}

// הגדרת כלל הנתיבים (Routes) של האפליקציה
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/search" element={<DriverSearchScreen />} />
        <Route path="/results" element={<StationResultsScreen />} />
        <Route path="/active" element={<ActiveSessionScreen />} />
        <Route path="/rating" element={<RatingAndReportScreen />} />
        <Route path="/profile" element={<UserProfileScreen />} />
        <Route path="/owner" element={<StationOwnerScreen />} />
        
        {/* טיפול בכתובת שלא קיימת (שגיאה 404) */}
        <Route path="*" element={<div style={{ textAlign: 'center', color: 'white', padding: '40px' }}><h2>404 - העמוד לא נמצא</h2><Link to="/" style={{ color: 'var(--light-blue)' }}>חזרה לדף הבית</Link></div>} />
      </Route>
    </Routes>
  );
}