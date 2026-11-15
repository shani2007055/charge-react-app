import './Dashboard.css';

const statuses: Record<string, {
  label: string;
  tone: string;
}> = {
  available: { label: 'זמינה', tone: 'green' },
  occupied: { label: 'תפוסה', tone: 'orange' },
  reserved: { label: 'משוריינת', tone: 'blue' },
  faulty: { label: 'תקולה', tone: 'red' },
  inactive: { label: 'מושבתת', tone: 'gray' },
  unknown: { label: 'לא ידוע', tone: 'gray' },
  held: { label: 'ממתינה לאישור', tone: 'orange' },
  confirmed: { label: 'מאושרת', tone: 'blue' },
  charging: { label: 'בטעינה', tone: 'green' },
  completed: { label: 'הסתיימה', tone: 'green' },
  cancelled: { label: 'בוטלה', tone: 'gray' },
  expired: { label: 'פג תוקף', tone: 'red' }
};

interface StatusBadgeProps {
  status?: string | null;
  isActive?: boolean;
}

export default function StatusBadge({
  status,
  isActive
}: StatusBadgeProps) {
  const key = isActive === false
    ? 'inactive'
    : status?.trim().toLowerCase() || 'unknown';

  const item = statuses[key] ?? {
    label: status || 'לא ידוע',
    tone: 'gray'
  };

  return (
    <span className={`dash-status tone-${item.tone}`}>
      <span className="dash-status-dot" />
      {item.label}
    </span>
  );
}