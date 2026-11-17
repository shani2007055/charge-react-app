import { useEffect, useRef, useState } from 'react';
import { searchAddresses, type AddressSuggestion } from '../../utils/geocoding';

interface AddressAutocompleteProps {
  label: string;
  placeholder?: string;
  value: string;                                         // הטקסט בשדה (מנוהל ע"י ההורה)
  onChange: (text: string) => void;                      // המשתמש הקליד
  onSelect: (suggestion: AddressSuggestion) => void;     // המשתמש בחר הצעה מהרשימה
  onClear?: () => void;                                  // כפתור "נקה"
  isSelected?: boolean;                                  // האם כבר נבחרה כתובת (אז לא מחפשים שוב)
  disabled?: boolean;
}

/**
 * שדה כתובת עם השלמה אוטומטית:
 * המשתמש מקליד → אחרי 400ms בלי הקלדה (debounce) → חיפוש ב-Nominatim → רשימת הצעות.
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
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

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
      return;
    }

    const controller = new AbortController();
    const timerId = window.setTimeout(async () => {
      setLoading(true);
      try {
        setSuggestions(await searchAddresses(query, controller.signal));
        setHoveredId(null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    // ניקוי: אם המשתמש הקליד שוב לפני שעברו 400ms – מבטלים את הטיימר ואת הבקשה הקודמת
    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [value, isSelected]);

  const handleSelect = (item: AddressSuggestion) => {
    skipNextRef.current = true;
    setSuggestions([]);
    setHoveredId(null);
    onSelect(item);
  };

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {onClear && value && (
          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            disabled={disabled}
            onClick={() => {
              setSuggestions([]);
              onClear();
            }}
          >
            נקה
          </button>
        )}
      </div>

      {loading && (
        <div style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)', marginTop: '6px' }}>
          מחפש הצעות כתובות...
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
                onClick={() => handleSelect(item)}
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
                }}
              >
                {item.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}