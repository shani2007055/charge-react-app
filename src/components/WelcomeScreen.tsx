
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Zap,
  CarFront,
  House,
  CheckCircle2,
  Check,
  ArrowLeft,
  RefreshCw,
  LoaderCircle,
  MapPin,
  Plug
} from 'lucide-react';

import {
  useAppDispatch,
  useAppSelector
} from '../store/hooks';

import {
  switchUserRole
} from '../store/user/userThunks';

import {
  setActiveRole
} from '../store/user/userSlice';

import {
  hasUserProfile,
  type UserRole
} from '../store/user/userState';

import './WelcomeScreen.css';


export default function WelcomeScreen() {

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { name, role, token, loading } =
    useAppSelector(state => state.user);

  const [error, setError] = useState('');

  const [pending, setPending] =
    useState<UserRole | null>(null);


  async function selectJourney(targetRole: UserRole) {

    if (loading || pending) return;

    setError('');

    const targetPath =
      targetRole === 'Driver'
        ? '/search'
        : '/owner';

    if (role === targetRole) {
      navigate(targetPath, { replace: true });
      return;
    }

    setPending(targetRole);

    try {

      if (
        targetRole === 'Owner' &&
        !hasUserProfile(token, 'Owner')
      ) {

        dispatch(setActiveRole('Owner'));

      } else {

        await dispatch(
          switchUserRole(targetRole)
        ).unwrap();

      }

      navigate(targetPath, { replace: true });

    } catch {

      setError(
        'לא ניתן לעבור לפרופיל כרגע. נסו שוב.'
      );

    } finally {

      setPending(null);

    }
  }


  return (

    <main className="welcome-page" dir="rtl">

      <header className="welcome-heading">

        <div className="welcome-brand-icon">
          <Zap size={32} />
        </div>

        <div className="welcome-success">
          <CheckCircle2 size={19} />
          החשבון שלכם מוכן!
        </div>

        <h1>
          ברוכים הבאים, {name}!
          <span>הדרך שלכם מתחילה כאן.</span>
        </h1>

        <p>
          הצטרפתם לקהילת הטעינה השיתופית.
          בחרו כיצד תרצו להתחיל.
        </p>

      </header>


      <div className="welcome-options">

        {/* Driver */}

        <article className="welcome-card">

          <div className="welcome-visual welcome-driver-visual">
            <img
  src="/images/charging-driver.jpg"
  alt="רכב חשמלי בעמדת טעינה"
  className="welcome-image"
/>

            <CarFront size={85} strokeWidth={1.3} />

            <div className="welcome-floating-icon">
              <MapPin size={27} />
            </div>

            <span>DRIVE & CHARGE</span>

          </div>

          <div className="welcome-card-content">

            <span className="welcome-card-tag">
              לנהגים חשמליים
            </span>

            <h2>אני מחפש טעינה</h2>

            <p>
              מצאו עמדות טעינה פרטיות,
              בחרו את העמדה המתאימה לכם
              ושריינו מקום מראש.
            </p>

            <ul>
              <li>
                <Check size={19} />
                חיפוש עמדות לפי מיקום
              </li>

              <li>
                <Check size={19} />
                שריון טעינה מראש
              </li>

              <li>
                <Check size={19} />
                עוזר AI חכם
              </li>
            </ul>

            <button
              type="button"
              className="welcome-button welcome-primary"
              disabled={loading || pending !== null}
              onClick={() => selectJourney('Driver')}
            >

              {pending === 'Driver'
                ? <LoaderCircle className="welcome-spinner" />
                : <CarFront size={21} />
              }

              מציאת עמדת טעינה

              <ArrowLeft size={19} />

            </button>

          </div>

        </article>


        {/* Owner */}

        <article className="welcome-card">

          <div className="welcome-visual welcome-owner-visual">
            <img
  src="/images/charging-owner.jpg"
  alt="עמדת טעינה ביתית פרטית"
  className="welcome-image"
/>

            <House size={85} strokeWidth={1.3} />

            <div className="welcome-floating-icon">
              <Plug size={27} />
            </div>

            <span>SHARE & EARN</span>

          </div>

          <div className="welcome-card-content">

            <span className="welcome-card-tag">
              לבעלי עמדות פרטיות
            </span>

            <h2>יש לי עמדת טעינה</h2>

            <p>
              הפכו את עמדת הטעינה הפרטית שלכם
              לחלק מרשת טעינה שיתופית
              ונגישה לנהגים נוספים.
            </p>

            <ul>
              <li>
                <Check size={19} />
                פרסום עמדת טעינה פרטית
              </li>

              <li>
                <Check size={19} />
                קביעת מחיר וזמינות
              </li>

              <li>
                <Check size={19} />
                ניהול הזמנות
              </li>
            </ul>

            <button
              type="button"
              className="welcome-button welcome-outline"
              disabled={loading || pending !== null}
              onClick={() => selectJourney('Owner')}
            >

              {pending === 'Owner'
                ? <LoaderCircle className="welcome-spinner" />
                : <House size={21} />
              }

              שיתוף עמדה פרטית

              <ArrowLeft size={19} />

            </button>

          </div>

        </article>

      </div>


      {error && (
        <div className="welcome-error" role="alert">
          {error}
        </div>
      )}


      <div className="welcome-note">

        <RefreshCw size={23} />

        <div>
          <strong>לא חייבים לבחור רק צד אחד!</strong>

          <p>
            ניתן לעבור בין פרופיל נהג
            לפרופיל בעל עמדה גם בהמשך.
          </p>
        </div>

      </div>

    </main>

  );
}
