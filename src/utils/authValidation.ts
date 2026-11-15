
export type AuthFieldName =
  | 'name'
  | 'email'
  | 'phone'
  | 'password'
  | 'confirmPassword'
  | 'code';

export type AuthErrors =
  Partial<Record<AuthFieldName, string>>;

export const PASSWORD_RULE =
  /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;

export const PHONE_RULE =
  /^0\d{1,2}-?\d{7}$/;

export function validateEmail(email: string): string {

  if (!email.trim()) {
    return 'יש להזין כתובת אימייל';
  }

  if (
    email.trim().length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return 'כתובת האימייל אינה תקינה';
  }

  return '';
}

export function validatePassword(password: string): string {

  if (!password) {
    return 'יש להזין סיסמה';
  }

  if (!PASSWORD_RULE.test(password)) {
    return 'הסיסמה חייבת להכיל 8–100 תווים, אות באנגלית ומספר';
  }

  return '';
}

export function validateLogin(
  email: string,
  password: string
): AuthErrors {

  const errors: AuthErrors = {};

  const emailError = validateEmail(email);

  if (emailError) errors.email = emailError;

  if (!password) {
    errors.password = 'יש להזין סיסמה';
  }

  return errors;
}

export function validateRegister(data: {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}): AuthErrors {

  const errors = validateLogin(
    data.email,
    data.password
  );

  if (
    data.name.trim().length < 2 ||
    data.name.trim().length > 60
  ) {
    errors.name = 'השם חייב להכיל בין 2 ל-60 תווים';
  }

  if (!PHONE_RULE.test(data.phone.trim())) {
    errors.phone = 'יש להזין מספר טלפון תקין';
  }

  const passwordError =
    validatePassword(data.password);

  if (passwordError) {
    errors.password = passwordError;
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = 'יש לאמת את הסיסמה';
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'הסיסמאות אינן תואמות';
  }

  return errors;
}

export function validateReset(
  email: string,
  code: string,
  password: string,
  confirmPassword: string
): AuthErrors {

  const errors: AuthErrors = {};

  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);

  if (emailError) errors.email = emailError;

  if (passwordError) errors.password = passwordError;

  if (!/^\d{6}$/.test(code.trim())) {
    errors.code = 'יש להזין קוד בן 6 ספרות';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'יש לאמת את הסיסמה';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'הסיסמאות אינן תואמות';
  }

  return errors;
}
