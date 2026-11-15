
import { useNavigate } from 'react-router-dom';
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
          <span>📍</span>
          <h3>חיפוש חכם</h3>
          <p>מציאת עמדות בהתאם למיקום ולצרכים שלכם.</p>
        </article>

        <article>
          <span>⚡</span>
          <h3>התאמה אישית</h3>
          <p>המלצות בהתאם לסוללה ולסוג המטען.</p>
        </article>

        <article>
          <span>🕒</span>
          <h3>שריון מראש</h3>
          <p>הזמנת עמדה לפני ההגעה.</p>
        </article>

        <article>
          <span>🎙️</span>
          <h3>עוזר חכם</h3>
          <p>חיפוש עמדות באמצעות העוזר הקולי.</p>
        </article>

      </section>

    </div>
  );
}
