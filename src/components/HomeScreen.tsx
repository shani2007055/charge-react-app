
import { useNavigate } from 'react-router-dom';

import {
  MapPin,
  Zap,
  CalendarCheck,
  Mic,
  ArrowLeft,
  Search,
  House,
  BatteryCharging,
  Leaf
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
              <section className="home-how-it-works">

        <div className="home-how-header">

          <span className="home-how-kicker">
            פשוט. חכם. שיתופי.
          </span>

          <h2>איך זה עובד?</h2>

          <p>
            שלושה צעדים קטנים לעולם טעינה גדול יותר.
          </p>

        </div>

        <div className="home-steps-grid">

          <article className="home-step-card">

            <div className="home-step-top">
              <div className="home-step-icon">
                <House size={30} />
              </div>
              <span className="home-step-number">
                01
              </span>
            </div>

            <h3>משתפים עמדה</h3>

            <p>
              בעלי עמדות טעינה פרטיות מפרסמים
              את העמדה שלהם ומגדירים מחיר וזמינות.
            </p>

          </article>

          <article className="home-step-card">

            <div className="home-step-top">
              <div className="home-step-icon">
                <MapPin size={30} />
              </div>
              <span className="home-step-number">
                02
              </span>
            </div>

            <h3>מוצאים ומשריינים</h3>

            <p>
              נהגים מוצאים עמדת טעינה מתאימה
              ומשריינים מראש את זמן הטעינה שלהם.
            </p>

          </article>

          <article className="home-step-card">

            <div className="home-step-top">
              <div className="home-step-icon">
                <BatteryCharging size={30} />
              </div>
              <span className="home-step-number">
                03
              </span>
            </div>

            <h3>מטעינים ונהנים</h3>

            <p>
              מגיעים לעמדה ומטעינים בקלות,
              כחלק מקהילת טעינה שיתופית.
            </p>

          </article>

        </div>

        <div className="home-community-banner">

          <Leaf size={23} />

          <span>
            יותר עמדות. יותר אפשרויות. קהילה אחת.
          </span>

        </div>

      </section>
    </div>
  );
}
