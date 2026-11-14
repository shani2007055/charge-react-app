const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // אם המשתמש מחובר, מצרפים אוטומטית את ה-JWT לכל בקשה
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = `שגיאת שרת (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      message = errorJson.detail || errorJson.title || errorJson.message || errorText || message;
    } catch {
      if (errorText) message = errorText;
    }
    throw new Error(message);
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}