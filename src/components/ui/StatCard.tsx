import type { LucideIcon } from 'lucide-react';
import './Dashboard.css';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'orange' | 'green' | 'red' | 'blue';
  description?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  tone = 'orange',
  description
}: StatCardProps) {
  return (
    <article className={`dash-stat tone-${tone}`}>
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
    </article>
  );
}