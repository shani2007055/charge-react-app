
import { useNavigate } from 'react-router-dom';

import {
  MapPin,
  Zap,
  CalendarCheck,
  Mic,
  ArrowLeft
} from 'lucide-react';

import { useAppSelector } from '../store/hooks';
import { isAdminToken } from '../store/user/userState';

import './HomeScreen.css';

export default function HomeScreen() {

  const navigate = useNavigate();

  const { token, role } = useAppSelector(
    state => state.user
  );

  const isAdmin = isAdminToken(token);

  const isDriver =
    !!token && !isAdmin && role === 'Driver';

  function openFeature(path: string) {

    if (!token) {
      navigate('/login');
      return;
    }

    if (isAdmin) {
      navigate('/admin');
      return;
    }

    if (!isDriver) {
      navigate('/owner');
      return;
    }

    navigate(path);
  }

  function openAssistant() {

    if (!isDriver) {
      openFeature('/search');
      return;
    }

    window.dispatchEvent(
      new Event('smart-ev:open-assistant')
    );
  }

  const features = [
    {
      icon: MapPin,
      title: 'מיקום חכם',
      description: 'גלו עמדות טעינה על המפה',
      action: () => openFeature('/results')
    },
    {
      icon: Zap,
      title: 'התאמה אישית',
      description: 'מצאו עמדה המתאימה לרכב שלכם',
      action: () => openFeature('/search')
    },
    {
      icon: CalendarCheck,
      title: 'שריון מראש',
      description: 'מצאו עמדה ושריינו מקום',
      action: () => openFeature('/search')
    },
    {
      icon: Mic,
      title: 'עוזר AI',
      description: 'דברו עם העוזר החכם שלכם',
      action: openAssistant
    }
  ];

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
            type="button"
            className="home-primary"
            onClick={() => openFeature('/search')}
          >
            מתחילים עכשיו ←
          </button>

          {isDriver && (
            <button
              type="button"
              className="home-ai-button"
              onClick={openAssistant}
            >
              <Mic size={20} />
              שיחה עם העוזר החכם
            </button>
          )}

        </div>

        <div
          className="home-hero-image"
          role="img"
          aria-label="רכב חשמלי בעמדת טעינה"
        />

      </section>

      <section className="home-features">

        {features.map(feature => {

          const Icon = feature.icon;

          return (

            <button
              key={feature.title}
              type="button"
              className="home-feature-button"
              onClick={feature.action}
            >

              <Icon size={36} />

              <h3>{feature.title}</h3>

              <p>{feature.description}</p>

              <ArrowLeft
                size={17}
                className="home-feature-arrow"
              />

            </button>
          );
        })}

      </section>

    </div>
  );
}
