import type { LucideIcon } from 'lucide-react';
import './Dashboard.css';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'orange' | 'green' | 'red' | 'blue';
  description?: string;
  onClick?: () => void;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  tone = 'orange',
  description,
  onClick,
}: StatCardProps) {
  const content = (
    <>
      <div className="dash-stat-icon">
        <Icon size={24} />
      </div>

      <span className="dash-stat-label">
        {title}
      </span>

      <strong className="dash-stat-value">
        {value}
      </strong>

      {description && <small>{description}</small>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`dash-stat dash-stat-clickable tone-${tone}`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={`dash-stat tone-${tone}`}>
      {content}
    </article>
  );
}