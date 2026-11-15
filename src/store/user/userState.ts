import { isTokenExpired } from '../../api/apiClient';

export type UserRole = 'Driver' | 'Owner';

export interface UserState {
  id: number | null;
  name: string;
  email: string;
  role: UserRole;
  token: string | null;
  carModel: string;
  communityPoints: number;
  loading: boolean;
  error: string | null;
  sessionExpiredMessage: string | null;
}

interface StoredUserSession {
  id: number | null;
  name: string;
  email: string;
  role: UserRole;
}

function loadStoredSession(): StoredUserSession {
  try {
    const raw = localStorage.getItem('user_session');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredUserSession>;
      return {
        id: typeof parsed.id === 'number' ? parsed.id : null,
        name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'אורח',
        email: typeof parsed.email === 'string' ? parsed.email : '',
        role: parsed.role === 'Owner' ? 'Owner' : 'Driver',
      };
    }
  } catch {
    // אם הנתונים פגומים נתעלם ונשתמש בברירת מחדל
  }
  return { id: null, name: 'אורח', email: '', role: 'Driver' };
}

const rawToken = localStorage.getItem('token');
const hasExpiredOnLoad = Boolean(rawToken && isTokenExpired(rawToken));

if (hasExpiredOnLoad) {
  localStorage.removeItem('token');
  localStorage.removeItem('user_session');
}

const savedToken = hasExpiredOnLoad ? null : rawToken;
const savedSession = savedToken
  ? loadStoredSession()
  : { id: null, name: 'אורח', email: '', role: 'Driver' as UserRole };

export const initialState: UserState = {
  id: savedSession.id,
  name: savedSession.name,
  email: savedSession.email,
  role: savedSession.role,
  token: savedToken,
  carModel: 'Tesla Model 3 Long Range',
  communityPoints: 150,
  loading: false,
  error: null,
  sessionExpiredMessage: hasExpiredOnLoad
    ? 'פג תוקף ההתחברות למערכת. יש להתחבר מחדש כדי להמשיך.'
    : null,
};