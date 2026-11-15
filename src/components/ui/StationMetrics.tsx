import {
  Zap,
  Plug,
  Wallet,
  Star
} from 'lucide-react';

import type {
  Station
} from '../../store/stations/stationsState';

import './DriverDashboard.css';

interface StationMetricsProps {
  station: Station;
}

export default function StationMetrics({
  station
}: StationMetricsProps) {

  const metrics = [
    {
      icon: Zap,
      label: 'הספק טעינה',
      value: `${station.maxKw} kW`
    },
    {
      icon: Plug,
      label: 'סוג מחבר',
      value: station.chargerType
    },
    {
      icon: Wallet,
      label: 'מחיר לקוט״ש',
      value: `₪${station.pricePerKwh.toFixed(2)}`
    },
    {
      icon: Star,
      label: 'דירוג משתמשים',
      value: station.averageRating != null
        ? `${station.averageRating.toFixed(1)} (${station.reviewsCount})`
        : 'טרם דורגה'
    }
  ];

  return (
    <div className="station-metrics">
      {metrics.map(({ icon: Icon, label, value }) => (
        <div
          className="station-metric"
          key={label}
        >
          <div className="station-metric-label">
            <Icon size={17} />
            <span>{label}</span>
          </div>

          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}