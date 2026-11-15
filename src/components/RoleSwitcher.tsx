
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarFront, Zap, ShieldCheck } from 'lucide-react';

import {
  useAppDispatch,
  useAppSelector
} from '../store/hooks';

import { switchUserRole } from '../store/user/userThunks';

import {
  isAdminToken,
  type UserRole
} from '../store/user/userState';

export default function RoleSwitcher() {

  const { role, token, loading } = useAppSelector(
    state => state.user
  );

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [error, setError] = useState('');

  async function changeRole(newRole: UserRole) {

    if (role === newRole || loading) return;

    const approved = window.confirm(
      'לעבור לפרופיל השני? אם הפרופיל עדיין לא קיים, הוא ייווצר.'
    );

    if (!approved) return;

    setError('');

    try {

      const result = await dispatch(
        switchUserRole(newRole)
      ).unwrap();

      navigate(
        isAdminToken(result.token)
          ? '/admin'
          : newRole === 'Owner'
            ? '/owner'
            : '/search',
        { replace: true }
      );

    } catch (err) {

      const message =
        typeof err === 'object' &&
        err !== null &&
        'message' in err
          ? String(err.message)
          : 'לא ניתן לעבור פרופיל כרגע';

      setError(message);
    }
  }

  if (isAdminToken(token)) {
    return (
      <div className="admin-role-label">
        <ShieldCheck size={19} />
        מנהל מערכת
      </div>
    );
  }

  return (
    <div className="role-switcher-wrapper">

      <div className="role-switcher">

        <button
          className={role === 'Driver' ? 'selected' : ''}
          disabled={loading}
          aria-pressed={role === 'Driver'}
          onClick={() => changeRole('Driver')}
        >
          <CarFront size={18} />
          נהג
        </button>

        <button
          className={role === 'Owner' ? 'selected' : ''}
          disabled={loading}
          aria-pressed={role === 'Owner'}
          onClick={() => changeRole('Owner')}
        >
          <Zap size={18} />
          בעל תחנה
        </button>

      </div>

      {error && (
        <small className="role-error" role="alert">
          {error}
        </small>
      )}

    </div>
  );
}
