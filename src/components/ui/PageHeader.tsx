import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import './Dashboard.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

export default function PageHeader({
  title,
  description,
  icon: Icon,
  actions
}: PageHeaderProps) {
  return (
    <header className="dash-heading">
      <div className="dash-heading-main">
        {Icon && (
          <div className="dash-heading-icon">
            <Icon size={27} />
          </div>
        )}

        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>

      {actions && (
        <div className="dash-heading-actions">
          {actions}
        </div>
      )}
    </header>
  );
}