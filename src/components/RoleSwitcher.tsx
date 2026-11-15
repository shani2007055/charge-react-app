
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  CarFront,
  Zap,
  ShieldCheck
} from 'lucide-react';

import {
  useAppDispatch,
  useAppSelector
} from '../store/hooks';

import {
  switchUserRole
} from '../store/user/userThunks';

import {
  isAdminToken,
  hasUserProfile,
  type UserRole
} from '../store/user/userState';

import ConfirmDialog from './ui/ConfirmDialog';

export default function RoleSwitcher() {

  const { role, token, loading } = useAppSelector(
    state => state.user
  );

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [error, setError] = useState('');

  const [pendingRole, setPendingRole] =
    useState<UserRole | null>(null);

  async function performSwitch(newRole: UserRole) {

    if (!token || role === newRole || loading) {
      return;
    }

    setError('');

    try {

      const result = await dispatch(
        switchUserRole(newRole)
      ).unwrap();

      setPendingRole(null);

      navigate(
        isAdminToken(result.token)
          ? '/admin'
          : newRole === 'Owner'
            ? '/owner'
            : '/search',
        { replace: true }
      );

    } catch (err) {

      setPendingRole(null);

      const message =
        typeof err === 'object' &&
        err !== null &&
        'message' in err
          ? String(err.message)
          : 'לא ניתן לעבור פרופיל כרגע';

      setError(message);
    }
  }

  function changeRole(newRole: UserRole) {

    if (!token || role === newRole || loading) {
      return;
    }

    setError('');

    if (hasUserProfile(token, newRole)) {

      void performSwitch(newRole);

    } else {

      setPendingRole(newRole);
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

  const profileName =
    pendingRole === 'Owner'
      ? 'בעל תחנה'
      : 'נהג';

  return (

    <div className="role-switcher-wrapper">

      <div className="role-switcher">

        <button
          type="button"
          className={
            role === 'Driver' ? 'selected' : ''
          }
          disabled={loading}
          aria-pressed={role === 'Driver'}
          onClick={() => changeRole('Driver')}
        >
          <CarFront size={18} />
          נהג
        </button>

        <button
          type="button"
          className={
            role === 'Owner' ? 'selected' : ''
          }
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

      <ConfirmDialog
        open={pendingRole !== null}
        title={`יצירת פרופיל ${profileName}`}
        message={
          `עדיין אין לך פרופיל ${profileName}. ` +
          'האם ליצור פרופיל חדש ולעבור אליו?'
        }
        confirmText="יצירת פרופיל"
        cancelText="ביטול"
        loading={loading}
        onCancel={() => setPendingRole(null)}
        onConfirm={() => {

          if (pendingRole) {
            void performSwitch(pendingRole);
          }
        }}
      />

    </div>
  );
}
