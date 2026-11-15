import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Zap,
  CalendarCheck,
  Mic
} from 'lucide-react';

import './HomeScreen.css';

export default function HomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="home-page" dir="rtl">

      <section className="home-hero">

        <div className="home-hero-content">

          <span className="home-tag">
            העתיד כבר חשמלי
          </span>

          <h1>
            הטעינה הבאה שלך
            <span> מתחילה כאן.</span>
          </h1>

          <p>
            מצאו את עמדת הטעינה המתאימה לכם,
            שריינו מקום מראש ותכננו את הדרך
            בצורה חכמה ופשוטה.
          </p>

          <button
            className="home-primary"
            onClick={() => navigate('/login')}
          >
            מתחילים עכשיו ←
          </button>

        </div>

        <div
          className="home-hero-image"
          role="img"
          aria-label="רכב חשמלי בעמדת טעינה"
        />

      </section>

      <section className="home-features">

        <article>
          <MapPin />
          <h3>מיקום חכם</h3>
        </article>

        <article>
          <Zap />
          <h3>התאמה אישית</h3>
        </article>

        <article>
          <CalendarCheck />
          <h3>שריון מראש</h3>
        </article>

        <article>
          <Mic />
          <h3>עוזר AI</h3>
        </article>

      </section>

    </div>
  );
}