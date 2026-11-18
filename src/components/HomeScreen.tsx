
import { useNavigate } from 'react-router-dom';

import {
  MapPin,
  Zap,
  CalendarCheck,
  Mic,
  ArrowLeft,
  Search,
  House
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
  function openJourney(targetRole: 'Driver' | 'Owner') {

  if (!token) {
    navigate(`/login?role=${targetRole}`);
    return;
  }

  if (isAdmin) {
    navigate('/admin');
    return;
  }

  if (role === targetRole) {
    navigate(
      targetRole === 'Driver'
        ? '/search'
        : '/owner'
    );
    return;
  }

  navigate('/profile');
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
               <Zap size={16} />
                הדור הבא של הטעינה השיתופית
              </span>

          <h1>
  מחברים אנשים.
  <span>משתפים אנרגיה.</span>
</h1>

<p>
  רשת טעינה שיתופית המחברת בין בעלי
  עמדות טעינה פרטיות לבין נהגים
  המחפשים טעינה קרובה, זמינה ונוחה.
</p>

<div className="home-community-note">
  <span className="home-green-dot" />
  משתפים עמדות. חוסכים זמן. יוצרים עתיד ירוק.
</div>
          
          <div className="home-action-buttons">

  <button
    type="button"
    className="home-journey-button home-journey-driver"
    onClick={() => openJourney('Driver')}
  >
    <Search size={25} />

    <div>
      <strong>מציאת עמדת טעינה</strong>
      <small>אני מחפש טעינה</small>
    </div>

    <ArrowLeft size={18} />
  </button>

  <button
    type="button"
    className="home-journey-button home-journey-owner"
    onClick={() => openJourney('Owner')}
  >
    <House size={25} />

    <div>
      <strong>שיתוף עמדה פרטית</strong>
      <small>יש לי עמדת טעינה</small>
    </div>

    <ArrowLeft size={18} />
  </button>

</div>

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
