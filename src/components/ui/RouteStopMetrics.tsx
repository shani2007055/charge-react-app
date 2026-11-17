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
  if (rec.chargeKwh == null) return null;   // לא מצב מסלול – לא מציגים כלום

  const metrics = [
    { icon: CornerUpRight, label: 'עקיפה מהדרך', value: `${rec.detourKm ?? 0} ק"מ` },
    { icon: BatteryCharging, label: 'מספיק לטעון', value: `${rec.chargeKwh} קוט"ש` },
    { icon: Wallet, label: 'עלות משוערת', value: `₪${(rec.chargeCost ?? 0).toFixed(1)}` },
    { icon: Clock, label: 'זמן נוסף', value: `~${Math.ceil(rec.extraMinutes ?? 0)} דק'` },
    { icon: Flag, label: 'סוללה ביעד', value: `${rec.arrivalPercentAtDestination ?? 0}%` },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: '8px',
        marginTop: '12px',
        padding: '10px',
        borderRadius: '10px',
        background: 'var(--ev-brand-soft)',
        border: '1px solid var(--ev-brand-border)',
      }}
    >
      {metrics.map(({ icon: Icon, label, value }) => (
        <div key={label} style={{ textAlign: 'center' }}>
          <Icon size={16} style={{ color: 'var(--ev-brand)' }} />
          <div className="tabular-nums" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
            {value}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--ev-ink-soft)' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}