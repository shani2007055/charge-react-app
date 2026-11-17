import { useEffect, useRef } from 'react';

interface BlockedHoursBarProps {
  value: number[];
  onChange: (nextHours: number[]) => void;
  disabled?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, idx) => idx);
const NIGHT_HOURS = [0, 1, 2, 3, 4, 5, 6, 23];
const WORKDAY_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

function normalizeHours(hours: number[]): number[] {
  return Array.from(new Set(hours.filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))).sort(
    (a, b) => a - b
  );
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatBlockedSummary(hours: number[]): string {
  const sorted = normalizeHours(hours);
  if (sorted.length === 0) {
    return 'העמדה פתוחה 24/7 — אין שעות חסומות.';
  }
  if (sorted.length === 24) {
    return 'כל 24 השעות חסומות כרגע.';
  }

  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      ranges.push(`${formatHour(start)}–${formatHour((prev + 1) % 24)}`);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push(`${formatHour(start)}–${formatHour((prev + 1) % 24)}`);

  return `חסומה ב-${sorted.length} שעות: ${ranges.join(' , ')}`;
}

export default function BlockedHoursBar({ value, onChange, disabled = false }: BlockedHoursBarProps) {
  const paintModeRef = useRef<'block' | 'unblock' | null>(null);
  const valueRef = useRef<number[]>(value);
  valueRef.current = value;

  useEffect(() => {
    const stopPainting = () => {
      paintModeRef.current = null;
    };
    window.addEventListener('pointerup', stopPainting);
    window.addEventListener('pointercancel', stopPainting);
    return () => {
      window.removeEventListener('pointerup', stopPainting);
      window.removeEventListener('pointercancel', stopPainting);
    };
  }, []);

  const blockedSet = new Set(normalizeHours(value));

  const applyHourChange = (hour: number, mode: 'block' | 'unblock') => {
    if (disabled) return;
    const next = new Set(valueRef.current);
    if (mode === 'block') {
      next.add(hour);
    } else {
      next.delete(hour);
    }
    onChange(normalizeHours(Array.from(next)));
  };

  const handlePointerDown = (hour: number) => {
    if (disabled) return;
    const mode = blockedSet.has(hour) ? 'unblock' : 'block';
    paintModeRef.current = mode;
    applyHourChange(hour, mode);
  };

  const handlePointerEnter = (hour: number) => {
    if (disabled || !paintModeRef.current) return;
    applyHourChange(hour, paintModeRef.current);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '0.82rem', color: 'var(--ev-ink-muted)', fontWeight: 600 }}>
          לחצי או גררי על השעות כדי לחסום אותן להזמנה:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            disabled={disabled}
            onClick={() => onChange(NIGHT_HOURS)}
            style={{ padding: '5px 10px', fontSize: '0.78rem' }}
          >
            לילה בבית (23:00–07:00)
          </button>
          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            disabled={disabled}
            onClick={() => onChange(WORKDAY_HOURS)}
            style={{ padding: '5px 10px', fontSize: '0.78rem' }}
          >
            יום עבודה (08:00–17:00)
          </button>
          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            disabled={disabled}
            onClick={() => onChange([])}
            style={{ padding: '5px 10px', fontSize: '0.78rem' }}
          >
            נקה הכול (24/7)
          </button>
        </div>
      </div>

      {/* ציר 24 שעות משמאל לימין (00 -> 23) לנוחות קריאת השעון */}
      <div
        dir="ltr"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: '4px',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {HOURS.map((hour) => {
          const isBlocked = blockedSet.has(hour);
          return (
            <button
              key={hour}
              type="button"
              disabled={disabled}
              onPointerDown={() => handlePointerDown(hour)}
              onPointerEnter={() => handlePointerEnter(hour)}
              title={`${formatHour(hour)}–${formatHour((hour + 1) % 24)}: ${isBlocked ? 'חסום' : 'פתוח'}`}
              className="font-mono-num"
              style={{
                padding: '7px 2px',
                borderRadius: '7px',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
                border: isBlocked ? '1px solid #FCA5A5' : '1px solid #A7F3D0',
                background: isBlocked ? '#FEE2E2' : '#ECFDF5',
                color: isBlocked ? '#991B1B' : '#065F46',
                transition: 'background-color 0.12s ease, border-color 0.12s ease',
              }}
            >
              {String(hour).padStart(2, '0')}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.8rem',
          color: 'var(--ev-ink-muted)',
        }}
      >
        <span>{formatBlockedSummary(value)}</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '3px',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'inline-block',
              }}
            />
            פתוח
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '3px',
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                display: 'inline-block',
              }}
            />
            חסום
          </span>
        </div>
      </div>
    </div>
  );
}