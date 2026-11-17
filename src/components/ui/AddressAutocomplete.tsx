import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  resolveSuggestedAddress,
  suggestAddresses,
  type AddressSuggestion,
  type AutocompleteOption,
} from '../../utils/geocoding';

interface AddressAutocompleteProps {
  label: string;
  placeholder?: string;
  value: string;                                         // הטקסט בשדה (מנוהל ע"י ההורה)
  onChange: (text: string) => void;                      // המשתמש הקליד
  onSelect: (suggestion: AddressSuggestion) => void;     // המשתמש בחר הצעה מהרשימה
  onClear?: () => void;                                  // כפתור "נקה"
  isSelected?: boolean;                                  // האם כבר נבחרה כתובת (אז לא מחפשים שוב)
  disabled?: boolean;
  exactOnly?: boolean;                                   // true = מחייב רחוב + עיר (לעמדות טעינה)
  hint?: string | null;                                  // הודעת עזר מתחת לשדה
  rightAction?: ReactNode;                               // כפתור נוסף לצד השדה (למשל "זהה מיקום")
}

/**
 * שדה כתובת עם השלמה אוטומטית (מבוסס ArcGIS):
 * המשתמש מקליד → אחרי 350ms בלי הקלדה (debounce) → רשימת הצעות → בבחירה נשלפות קואורדינטות מדויקות.
 */
export default function AddressAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  onClear,
  isSelected = false,
  disabled = false,
  exactOnly = false,
  hint = null,
  rightAction,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteOption[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [noExactMatch, setNoExactMatch] = useState(false);

  // מונע פתיחה חוזרת של ההצעות מיד אחרי בחירה
  const skipNextRef = useRef(false);

  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 3 || isSelected) {
      setSuggestions([]);
      setNoExactMatch(false);
      return;
    }

    const controller = new AbortController();
    const timerId = window.setTimeout(async () => {
      setLoading(true);
      setNoExactMatch(false);
      try {
        const results = await suggestAddresses(
          query,
          controller.signal,
          exactOnly,
          exactOnly ? 10 : 6
        );
        setSuggestions(results);
        setHoveredId(null);
        if (exactOnly && results.length === 0) {
          setNoExactMatch(true);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [value, isSelected, exactOnly]);

  const handleSelect = async (item: AutocompleteOption) => {
    if (resolving) return;
    skipNextRef.current = true;
    setSuggestions([]);
    setHoveredId(null);
    setNoExactMatch(false);
    setResolving(true);

    try {
      const resolved = await resolveSuggestedAddress(item);
      onSelect(resolved);
    } catch {
      // במקרה של שגיאת רשת רגעית נשאיר את הטקסט לבדיקה ידנית בשמירה
      onChange(item.label);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="form-group" style={{ position: 'relative', marginBottom: 0 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-control"
          style={{ flex: '1 1 220px' }}
          placeholder={placeholder}
          value={value}
          disabled={disabled || resolving}
          onChange={(e) => {
            setNoExactMatch(false);
            onChange(e.target.value);
          }}
        />
        {rightAction}
        {onClear && value && (
          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            disabled={disabled || resolving}
            onClick={() => {
              setSuggestions([]);
              setNoExactMatch(false);
              onClear();
            }}
          >
            נקה
          </button>
        )}
      </div>

      {hint && (
        <div style={{ fontSize: '0.78rem', color: '#B45309', marginTop: '6px' }}>
          {hint}
        </div>
      )}

      {!hint && exactOnly && noExactMatch && !loading && !isSelected && (
        <div style={{ fontSize: '0.78rem', color: '#B45309', marginTop: '6px' }}>
          לא נמצאה כתובת רחוב מדויקת — יש להזין רחוב, מספר בית ועיר (למשל: הרב גולדקנופף 3, ירושלים).
        </div>
      )}

      {(loading || resolving) && (
        <div style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)', marginTop: '6px' }}>
          {resolving
            ? 'מאמת קואורדינטות מדויקות...'
            : exactOnly
              ? 'מחפש כתובות מדויקות...'
              : 'מחפש הצעות כתובות...'}
        </div>
      )}

      {suggestions.length > 0 && (
        <ul
          onMouseLeave={() => setHoveredId(null)}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            background: 'var(--ev-surface-solid)',
            border: '1px solid var(--ev-border)',
            borderRadius: '10px',
            listStyle: 'none',
            margin: '6px 0 0 0',
            padding: 0,
            maxHeight: '220px',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(15, 23, 42, 0.1)',
          }}
        >
          {suggestions.map((item) => {
            const isHovered = hoveredId === item.id;
            return (
              <li
                key={item.id}
                onClick={() => void handleSelect(item)}
                onMouseEnter={() => setHoveredId(item.id)}
                style={{
                  padding: '10px 14px',
                  fontSize: '0.88rem',
                  color: isHovered ? 'var(--ev-brand-hover)' : 'var(--ev-ink)',
                  background: isHovered ? 'var(--ev-brand-soft)' : 'transparent',
                  fontWeight: isHovered ? 600 : 400,
                  textAlign: 'right',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--ev-surface-subtle)',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>{item.label}</span>
                {exactOnly && !item.hasHouseNumber && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#B45309',
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      padding: '1px 6px',
                      borderRadius: '5px',
                      flexShrink: 0,
                    }}
                  >
                    הוסף מס׳ בית
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}