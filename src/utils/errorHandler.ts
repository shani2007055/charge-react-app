
export function getErrorMessage(
  error: unknown,
  fallback = 'לא ניתן להשלים את הפעולה'
): string {

  if (typeof error === 'string') {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    if (
      error.message === 'Failed to fetch' ||
      error.message === 'NetworkError'
    ) {
      return 'לא ניתן להתחבר לשרת. בדקו את החיבור.';
    }

    if (error.message === 'Invalid phone number.') {
      return 'מספר הטלפון אינו תקין';
    }

    if (
      error.message ===
      'Password must contain letters and digits.'
    ) {
      return 'הסיסמה חייבת להכיל אותיות באנגלית וספרות';
    }

    return error.message;
  }

  return fallback;
}
