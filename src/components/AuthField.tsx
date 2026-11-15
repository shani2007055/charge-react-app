
import { useState, type HTMLInputTypeAttribute } from 'react';

import {
  Eye,
  EyeOff,
  type LucideIcon
} from 'lucide-react';

interface AuthFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  disabled?: boolean;
  maxLength?: number;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
}

export default function AuthField({
  label,
  name,
  value,
  onChange,
  icon: Icon,
  type = 'text',
  placeholder,
  error,
  autoComplete,
  disabled,
  maxLength,
  inputMode
}: AuthFieldProps) {

  const [visible, setVisible] = useState(false);

  const isPassword = type === 'password';

  const direction =
    ['email', 'password', 'tel'].includes(type) ||
    inputMode === 'numeric'
      ? 'ltr'
      : 'rtl';

  return (
    <div className="auth-field">

      <label htmlFor={name}>{label}</label>

      <div className={
        `auth-input-wrap ${error ? 'invalid' : ''}`
      }>

        {Icon && <Icon size={19} aria-hidden="true" />}

        <input
          id={name}
          name={name}
          type={isPassword && visible ? 'text' : type}
          dir={direction}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          maxLength={maxLength}
          inputMode={inputMode}
          onChange={e => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${name}-error` : undefined
          }
        />

        {isPassword && (
          <button
            type="button"
            className="auth-eye"
            onClick={() => setVisible(!visible)}
            disabled={disabled}
            aria-label={
              visible ? 'הסתר סיסמה' : 'הצג סיסמה'
            }
          >
            {visible
              ? <EyeOff size={19} />
              : <Eye size={19} />}
          </button>
        )}

      </div>

      {error && (
        <small
          id={`${name}-error`}
          className="auth-field-error"
          role="alert"
        >
          {error}
        </small>
      )}

    </div>
  );
}
