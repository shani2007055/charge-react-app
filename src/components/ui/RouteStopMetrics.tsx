import { CornerUpRight, BatteryCharging, Wallet, Clock, Flag } from 'lucide-react';
import type { RankedStationResult } from '../../store/stations/stationsState';
import './DriverDashboard.css';

interface RouteStopMetricsProps {
  rec: RankedStationResult;
}

/**
 * נתוני עצירה בדרך (מצב מסלול): עקיפה, כמה לטעון לפחות, עלות, זמן נוסף, ואחוז ביעד.
 * מוצג רק כשהשרת החזיר את השדות האלה (recommend-route).
 */
export default function RouteStopMetrics({ rec }: RouteStopMetricsProps) {
  if (rec.chargeKwh == null) return null; // לא מצב מסלול – לא מציגים כלום

  const metrics = [
    { icon: CornerUpRight, label: 'עקיפה', value: `${rec.detourKm ?? 0} ק"מ` },
    { icon: BatteryCharging, label: 'לטעינה', value: `${rec.chargeKwh} קוט"ש` },
    { icon: Wallet, label: 'עלות', value: `₪${(rec.chargeCost ?? 0).toFixed(1)}` },
    { icon: Clock, label: 'תוספת זמן', value: `~${Math.ceil(rec.extraMinutes ?? 0)} דק'` },
    { icon: Flag, label: 'ביעד', value: `${rec.arrivalPercentAtDestination ?? 0}%` },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(74px, 1fr))',
        gap: '8px',
        marginTop: '10px',
        padding: '10px 8px',
        borderRadius: '10px',
        background: 'var(--ev-brand-soft)',
        border: '1px solid var(--ev-brand-border)',
      }}
    >
      {metrics.map(({ icon: Icon, label, value }) => (
        <div key={label} style={{ textAlign: 'center', minWidth: 0 }}>
          <Icon size={15} style={{ color: 'var(--ev-brand)' }} />
          <div className="tabular-nums" style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
            {value}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--ev-ink-soft)' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}