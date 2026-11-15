const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AUTH_EXEMPT_ENDPOINTS = [
  '/users/login',
  '/users/register',
  '/users/forgot-password',
  '/users/reset-password',
];

export function isTokenExpired(token: string): boolean {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return true;
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function triggerSessionExpired(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user_session');
  window.dispatchEvent(new CustomEvent('auth:expired'));
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  const isAuthEndpoint = AUTH_EXEMPT_ENDPOINTS.some((path) => endpoint.startsWith(path));

  if (token && !isAuthEndpoint && isTokenExpired(token)) {
    triggerSessionExpired();
    throw new Error('פג תוקף ההתחברות למערכת. יש להתחבר מחדש.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // אם המשתמש מחובר (ולא בבקשה ציבורית), מצרפים את ה-JWT
  if (token && !isAuthEndpoint) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !isAuthEndpoint) {
    triggerSessionExpired();
    throw new Error('פג תוקף ההתחברות למערכת. יש להתחבר מחדש.');
  }

  if (!response.ok) {
    const errorText = await response.text();
    let message = `שגיאת שרת (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText) as {
        detail?: string;
        title?: string;
        message?: string;
        errors?: Record<string, string[]>;
      };
      const firstValidationError = errorJson.errors
        ? Object.values(errorJson.errors).flat()[0]
        : undefined;
      message =
        firstValidationError ||
        errorJson.detail ||
        errorJson.message ||
        errorJson.title ||
        errorText ||
        message;
    } catch {
      if (errorText) message = errorText;
    }
    throw new Error(message);
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}