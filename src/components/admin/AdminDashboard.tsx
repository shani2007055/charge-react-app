import {
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import {
  LayoutDashboard,
  Users,
  CarFront,
  Building2,
  Zap,
  Car,
  CalendarDays,
  Star,
  TriangleAlert,
  RefreshCw,
  Search,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  Eye,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { Station } from '../../store/stations/stationsState';
import ConfirmDialog from '../ui/ConfirmDialog';
import PageHeader from '../ui/PageHeader';
import StatCard from '../ui/StatCard';
import StatusBadge from '../ui/StatusBadge';
import {
  deleteAdminDriver,
  deleteAdminOwner,
  deleteAdminReview,
  deleteAdminStatusLog,
  deleteAdminUser,
  fetchAdminData,
  reviewAdminStation,
} from './adminApi';
import {
  emptyAdminData,
  type AdminData,
  type AdminPage,
  type AdminSection,
} from './adminTypes';
import './AdminDashboard.css';

const PAGE_SIZE = 12;

type StationTableFilter = 'all' | 'pending' | 'faulty';

const navigation: {
  id: AdminPage;
  label: string;
  icon: LucideIcon;
}[] = [
  {
    id: 'overview',
    label: 'סקירה כללית',
    icon: LayoutDashboard,
  },
  {
    id: 'users',
    label: 'משתמשים',
    icon: Users,
  },
  {
    id: 'drivers',
    label: 'נהגים',
    icon: CarFront,
  },
  {
    id: 'owners',
    label: 'בעלי תחנות',
    icon: Building2,
  },
  {
    id: 'stations',
    label: 'עמדות טעינה',
    icon: Zap,
  },
  {
    id: 'vehicles',
    label: 'רכבים',
    icon: Car,
  },
  {
    id: 'bookings',
    label: 'הזמנות',
    icon: CalendarDays,
  },
  {
    id: 'reviews',
    label: 'ביקורות',
    icon: Star,
  },
  {
    id: 'logs',
    label: 'יומן סטטוסים ותקלות',
    icon: TriangleAlert,
  },
];

type CellValue = string | number | boolean | null;

type TableRow = {
  id: number;
  cells: CellValue[];
  searchText?: string;
};

interface TableData {
  headers: string[];
  rows: TableRow[];
  statusColumn?: number;
  approvalColumn?: number;
  hasActions?: boolean;
}

interface PendingAdminAction {
  title: string;
  message: string;
  confirmText: string;
  successMessage: string;
  variant?: 'primary' | 'danger' | 'success';
  run: () => Promise<void>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('he-IL');
}

function formatBlockedHours(hours?: number[]): string {
  if (!hours || hours.length === 0) {
    return 'ללא שעות חסומות (פתוחה 24/7)';
  }
  return [...hours]
    .sort((a, b) => a - b)
    .map((h) => `${String(h).padStart(2, '0')}:00`)
    .join(', ');
}

function getApprovalMeta(status?: string | null): {
  label: string;
  tone: 'green' | 'orange' | 'red';
} {
  if (status === 'Pending') {
    return { label: 'ממתינה לאישור', tone: 'orange' };
  }
  if (status === 'Rejected') {
    return { label: 'נדחתה', tone: 'red' };
  }
  return { label: 'מאושרת', tone: 'green' };
}

function getMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function getTable(
  page: AdminPage,
  data: AdminData
): TableData {
  switch (page) {
    case 'users':
      return {
        headers: [
          'מזהה', 'שם', 'דוא״ל', 'טלפון',
          'הרשאה', 'נהג', 'בעל תחנה',
        ],
        hasActions: true,
        rows: data.users.map((u) => ({
          id: u.id,
          cells: [
            u.id, u.name, u.email, u.phone,
            u.access === 'Admin'
              ? 'מנהל מערכת'
              : 'משתמש',
            u.driverId != null,
            u.ownerId != null,
          ],
        })),
      };
    case 'drivers':
      return {
        headers: [
          'מזהה', 'מזהה משתמש', 'שם',
          'דוא״ל', 'טלפון', 'הזמנות', 'רכבים',
        ],
        hasActions: true,
        rows: data.drivers.map((d) => ({
          id: d.id,
          cells: [
            d.id, d.userId, d.name,
            d.email, d.phone,
            d.totalBookings, d.vehicles.length,
          ],
        })),
      };
    case 'owners':
      return {
        headers: [
          'מזהה', 'מזהה משתמש',
          'שם', 'דוא״ל', 'טלפון', 'עמדות',
        ],
        hasActions: true,
        rows: data.owners.map((o) => ({
          id: o.id,
          cells: [
            o.id, o.userId, o.name,
            o.email, o.phone, o.stationsCount,
          ],
        })),
      };
    case 'stations':
      return {
        headers: [
          'מזהה',
          'שם עמדה',
          'כתובת',
          'מצב תפעולי',
          'אישור מנהל',
        ],
        statusColumn: 3,
        approvalColumn: 4,
        hasActions: true,
        rows: data.stations.map((s) => ({
          id: s.id,
          cells: [
            s.id,
            s.name,
            s.address,
            s.isActive ? s.currentStatus : 'Inactive',
            s.approvalStatus ?? 'Approved',
          ],
          searchText: [
            s.id,
            s.name,
            s.address,
            s.ownerName ?? '',
            s.ownerEmail ?? '',
            s.ownerPhone ?? '',
            s.chargerType,
            `${s.maxKw} kW`,
            s.pricePerKwh,
            s.approvalStatus ?? 'Approved',
          ]
            .join(' ')
            .toLowerCase(),
        })),
      };
    case 'vehicles':
      return {
        headers: [
          'מזהה', 'מזהה נהג', 'דגם רכב',
          'קיבולת סוללה', 'סוללה נוכחית', 'מחבר',
        ],
        rows: data.vehicles.map((v) => ({
          id: v.id,
          cells: [
            v.id, v.driverId, v.model,
            `${v.batteryCapacityKwh} kWh`,
            `${v.currentBattery}%`,
            v.supportedChargerType,
          ],
        })),
      };
    case 'bookings':
      return {
        headers: [
          'מזהה', 'עמדה', 'מזהה נהג',
          'רכב', 'סוללה נוכחית', 'יעד טעינה',
          'סטטוס', 'זמן יצירה', 'הגעה משוערת',
        ],
        statusColumn: 6,
        rows: data.bookings.map((b) => ({
          id: b.id,
          cells: [
            b.id, b.stationName, b.driverId,
            b.vehicleModel,
            `${b.currentBatteryPercent}%`,
            `${b.targetBatteryPercent}%`,
            b.status,
            formatDate(b.createdAt),
            formatDate(b.estimatedArrivalTime),
          ],
        })),
      };
    case 'reviews':
      return {
        headers: [
          'מזהה', 'הזמנה', 'עמדה', 'נהג',
          'דירוג', 'ביקורת', 'תאריך',
        ],
        hasActions: true,
        rows: data.reviews.map((r) => ({
          id: r.id,
          cells: [
            r.id, r.chargeBookingId,
            r.stationName, r.driverName,
            `${r.rating}/5`,
            r.comment, formatDate(r.createdAt),
          ],
        })),
      };
    case 'logs':
      return {
        headers: [
          'מזהה', 'עמדה', 'סטטוס',
          'נהג משויך', 'עדכון אחרון',
        ],
        statusColumn: 2,
        hasActions: true,
        rows: data.logs.map((l) => ({
          id: l.id,
          cells: [
            l.id, l.stationName, l.status,
            l.currentDriverName,
            formatDate(l.updatedAt),
          ],
        })),
      };
    default:
      return { headers: [], rows: [] };
  }
}

export default function AdminDashboard() {
  const { id: currentUserId, name, token } = useAppSelector(
    (state) => state.user
  );
  const [page, setPage] = useState<AdminPage>('overview');
  const [data, setData] = useState<AdminData>(emptyAdminData);
  const [errors, setErrors] = useState<
    Partial<Record<AdminSection, string>>
  >({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [onlyFaults, setOnlyFaults] = useState(false);
  const [stationFilter, setStationFilter] = useState<StationTableFilter>('all');
  const [onlyActiveBookings, setOnlyActiveBookings] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<PendingAdminAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // דיאלוג פרטי עמדה מלאים
  const detailsDialogRef = useRef<HTMLDialogElement>(null);
  const [detailsStation, setDetailsStation] = useState<Station | null>(null);

  // דיאלוג דחיית עמדה עם סיבה
  const rejectDialogRef = useRef<HTMLDialogElement>(null);
  const [rejectTarget, setRejectTarget] = useState<Station | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectValidationError, setRejectValidationError] = useState<string | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  useEffect(() => {
    const dialog = detailsDialogRef.current;
    if (!dialog) return;
    if (detailsStation && !dialog.open) {
      dialog.showModal();
    }
    if (!detailsStation && dialog.open) {
      dialog.close();
    }
  }, [detailsStation]);

  useEffect(() => {
    const dialog = rejectDialogRef.current;
    if (!dialog) return;
    if (rejectTarget && !dialog.open) {
      dialog.showModal();
    }
    if (!rejectTarget && dialog.open) {
      dialog.close();
    }
  }, [rejectTarget]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrors({});
    setData(emptyAdminData);

    void fetchAdminData(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setData(result.data);
      setErrors(result.errors);
      setLoading(false);
    });

    return () => controller.abort();
  }, [refresh, token]);

  const currentPage =
    navigation.find((item) => item.id === page) ?? navigation[0];

  const activeOwners = useMemo(
    () => data.owners.filter((o) => o.stationsCount > 0),
    [data.owners]
  );

  const pendingStations = useMemo(
    () => data.stations.filter((s) => s.approvalStatus === 'Pending'),
    [data.stations]
  );

  const table = useMemo(
    () => getTable(page, { ...data, owners: activeOwners }),
    [page, data, activeOwners]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return table.rows.filter((row) => {
      if (page === 'logs' && onlyFaults) {
        const statusValue = String(row.cells[2] ?? '').toLowerCase();
        if (statusValue !== 'faulty') return false;
      }
      if (page === 'stations' && stationFilter !== 'all') {
        if (stationFilter === 'pending') {
          if (String(row.cells[4] ?? '') !== 'Pending') return false;
        } else if (stationFilter === 'faulty') {
          if (String(row.cells[3] ?? '').toLowerCase() !== 'faulty') return false;
        }
      }
      if (page === 'bookings' && onlyActiveBookings) {
        const statusValue = String(row.cells[6] ?? '').toLowerCase();
        if (!['held', 'confirmed', 'charging'].includes(statusValue)) return false;
      }
      if (!query) return true;
      if (row.searchText && row.searchText.includes(query)) return true;
      return row.cells.some((cell) =>
        String(cell ?? '').toLowerCase().includes(query)
      );
    });
  }, [table.rows, search, page, onlyFaults, stationFilter, onlyActiveBookings]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE)
  );
  const safePage = Math.min(pageNumber, pageCount);
  const visibleRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const activeBookings = data.bookings.filter((b) =>
    ['held', 'confirmed', 'charging'].includes(b.status.toLowerCase())
  ).length;

  const faultyStations = data.stations.filter(
    (s) => s.currentStatus?.toLowerCase() === 'faulty'
  ).length;

  const stationGroups = useMemo(() => {
    const counts = {
      available: 0,
      busy: 0,
      reserved: 0,
      faulty: 0,
      inactive: 0,
    };
    for (const s of data.stations) {
      const status = s.currentStatus?.toLowerCase();
      if (!s.isActive) {
        counts.inactive += 1;
      } else if (status === 'faulty') {
        counts.faulty += 1;
      } else if (status === 'reserved') {
        counts.reserved += 1;
      } else if (status === 'busy' || status === 'occupied') {
        counts.busy += 1;
      } else {
        counts.available += 1;
      }
    }
    return [
      { label: 'זמינות', count: counts.available, color: '#16a34a' },
      { label: 'תפוסות', count: counts.busy, color: '#ea580c' },
      { label: 'משוריינות', count: counts.reserved, color: '#2563eb' },
      { label: 'תקולות', count: counts.faulty, color: '#dc2626' },
      { label: 'מושבתות', count: counts.inactive, color: '#64748b' },
    ];
  }, [data.stations]);

  function metricValue(section: AdminSection, value: number): string | number {
    if (loading || errors[section]) return '—';
    return value;
  }

  function changePage(
    nextPage: AdminPage,
    options?: {
      onlyFaults?: boolean;
      stationFilter?: StationTableFilter;
      onlyActiveBookings?: boolean;
    }
  ) {
    setPage(nextPage);
    setSearch('');
    setPageNumber(1);
    setOnlyFaults(options?.onlyFaults ?? false);
    setStationFilter(options?.stationFilter ?? 'all');
    setOnlyActiveBookings(options?.onlyActiveBookings ?? false);
    setActionError(null);
    setActionSuccess(null);
  }

  function openRejectDialog(station: Station) {
    setRejectTarget(station);
    setRejectReason('');
    setRejectValidationError(null);
    setActionError(null);
    setActionSuccess(null);
  }

  function requestApproveStation(station: Station) {
    setPendingAction({
      title: 'אישור עמדת טעינה',
      message: `האם לאשר את העמדה "${station.name}" (${station.address}) להצגה עבור כלל הנהגים?`,
      confirmText: 'אשר עמדה',
      variant: 'success',
      successMessage: `העמדה "${station.name}" אושרה בהצלחה ותופיע מעכשיו לנהגים.`,
      run: async () => {
        await reviewAdminStation(station.id, { approvalStatus: 'Approved' });
      },
    });
  }

  async function handleConfirmReject() {
    if (!rejectTarget) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      setRejectValidationError('יש להזין סיבת דחייה שתוצג לבעל העמדה.');
      return;
    }

    setRejectLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await reviewAdminStation(rejectTarget.id, {
        approvalStatus: 'Rejected',
        rejectionReason: trimmed,
      });
      setActionSuccess(`העמדה "${rejectTarget.name}" נדחתה והסיבה נשלחה לבעל התחנה.`);
      setRejectTarget(null);
      setRejectReason('');
      setRefresh((v) => v + 1);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'דחיית העמדה נכשלה.'
      );
      setRejectTarget(null);
    } finally {
      setRejectLoading(false);
    }
  }

  async function executePendingAction() {
    if (!pendingAction) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await pendingAction.run();
      setActionSuccess(pendingAction.successMessage);
      setPendingAction(null);
      setRefresh((v) => v + 1);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'ביצוע הפעולה נכשל.'
      );
      setPendingAction(null);
    } finally {
      setActionLoading(false);
    }
  }

  function renderRowActions(rowId: number) {
    if (page === 'users') {
      const user = data.users.find((u) => u.id === rowId);
      if (!user) return null;
      if (user.id === currentUserId || user.access === 'Admin') {
        return <span className="admin-protected-tag">מנהל מוגן</span>;
      }
      return (
        <div className="admin-actions-cell">
          <button
            type="button"
            className="admin-action-btn danger"
            onClick={() =>
              setPendingAction({
                title: 'מחיקת משתמש',
                message: `האם למחוק את המשתמש "${user.name}" (${user.email}) מהמערכת? פעולה זו אינה הפיכה.`,
                confirmText: 'מחק משתמש',
                variant: 'danger',
                successMessage: `המשתמש "${user.name}" נמחק בהצלחה.`,
                run: () => deleteAdminUser(user.id),
              })
            }
          >
            <Trash2 size={14} />
            מחק
          </button>
        </div>
      );
    }

    if (page === 'drivers') {
      const driver = data.drivers.find((d) => d.id === rowId);
      if (!driver) return null;
      return (
        <div className="admin-actions-cell">
          <button
            type="button"
            className="admin-action-btn danger"
            onClick={() =>
              setPendingAction({
                title: 'מחיקת פרופיל נהג',
                message: `האם למחוק את פרופיל הנהג של "${driver.name}" (#${driver.id})?`,
                confirmText: 'מחק פרופיל נהג',
                variant: 'danger',
                successMessage: `פרופיל הנהג של "${driver.name}" נמחק בהצלחה.`,
                run: () => deleteAdminDriver(driver.id),
              })
            }
          >
            <Trash2 size={14} />
            מחק נהג
          </button>
        </div>
      );
    }

    if (page === 'owners') {
      const owner = data.owners.find((o) => o.id === rowId);
      if (!owner) return null;
      return (
        <div className="admin-actions-cell">
          <button
            type="button"
            className="admin-action-btn danger"
            onClick={() =>
              setPendingAction({
                title: 'מחיקת פרופיל בעל תחנה',
                message: `האם למחוק את פרופיל בעל התחנה "${owner.name}" (#${owner.id})?`,
                confirmText: 'מחק בעלים',
                variant: 'danger',
                successMessage: `פרופיל בעל התחנה "${owner.name}" נמחק בהצלחה.`,
                run: () => deleteAdminOwner(owner.id),
              })
            }
          >
            <Trash2 size={14} />
            מחק בעלים
          </button>
        </div>
      );
    }

    if (page === 'stations') {
      const station = data.stations.find((s) => s.id === rowId);
      if (!station) return null;
      return (
        <div className="admin-actions-cell">
          <button
            type="button"
            className="admin-action-btn"
            onClick={() => setDetailsStation(station)}
          >
            <Eye size={14} />
            פרטים
          </button>
          {station.approvalStatus !== 'Approved' && (
            <button
              type="button"
              className="admin-action-btn"
              style={{
                borderColor: '#86efac',
                background: '#f0fdf4',
                color: '#166534',
              }}
              onClick={() => requestApproveStation(station)}
            >
              <CheckCircle2 size={14} />
              אשר
            </button>
          )}
          {station.approvalStatus !== 'Rejected' && (
            <button
              type="button"
              className="admin-action-btn danger"
              onClick={() => openRejectDialog(station)}
            >
              <XCircle size={14} />
              דחה
            </button>
          )}
        </div>
      );
    }

    if (page === 'reviews') {
      const review = data.reviews.find((r) => r.id === rowId);
      if (!review) return null;
      return (
        <div className="admin-actions-cell">
          <button
            type="button"
            className="admin-action-btn danger"
            onClick={() =>
              setPendingAction({
                title: 'מחיקת ביקורת',
                message: `האם למחוק את הביקורת של "${review.driverName}" על "${review.stationName}"?`,
                confirmText: 'מחק ביקורת',
                variant: 'danger',
                successMessage: `הביקורת #${review.id} נמחקה בהצלחה.`,
                run: () => deleteAdminReview(review.id),
              })
            }
          >
            <Trash2 size={14} />
            מחק ביקורת
          </button>
        </div>
      );
    }

    if (page === 'logs') {
      const log = data.logs.find((l) => l.id === rowId);
      if (!log) return null;
      return (
        <div className="admin-actions-cell">
          <button
            type="button"
            className="admin-action-btn danger"
            onClick={() =>
              setPendingAction({
                title: 'מחיקת רשומת יומן',
                message: `האם למחוק את רשומת היומן #${log.id} (${log.stationName})?`,
                confirmText: 'מחק רשומה',
                variant: 'danger',
                successMessage: `רשומת יומן #${log.id} נמחקה בהצלחה.`,
                run: () => deleteAdminStatusLog(log.id),
              })
            }
          >
            <Trash2 size={14} />
            מחק
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="admin-layout" dir="rtl">
      <aside className="admin-sidebar" aria-label="תפריט ניהול">
        <div className="admin-brand">
          <ShieldCheck size={28} />
          <div>
            <strong>מרכז ניהול</strong>
            <small>מנהל מערכת · {name}</small>
          </div>
        </div>
        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={page === item.id ? 'selected' : ''}
                onClick={() => changePage(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <ShieldCheck size={16} />
          <span>הרשאות מנהל מלאות</span>
        </div>
      </aside>

      <main className="admin-content">
        <PageHeader
          title={currentPage.label}
          description="ניטור, ניהול ובקרה בזמן אמת על נתוני המערכת"
          icon={currentPage.icon}
          actions={
            <button
              type="button"
              className="ev-btn ev-btn-secondary ev-btn-auto"
              disabled={loading}
              onClick={() => setRefresh((v) => v + 1)}
            >
              <RefreshCw size={18} />
              רענון נתונים
            </button>
          }
        />

        {loading && (
          <div className="admin-notice" role="status">
            טוען נתונים מהשרת...
          </div>
        )}

        {!loading && Object.keys(errors).length > 0 && (
          <div className="ev-alert-error" role="alert">
            חלק ממקורות הנתונים לא נטענו.
            {Object.entries(errors).map(([key, message]) => (
              <div key={key}>
                {navigation.find((n) => n.id === key)?.label}: {message}
              </div>
            ))}
          </div>
        )}

        {actionError && (
          <div className="ev-alert-error" role="alert" style={{ marginBottom: '14px' }}>
            {actionError}
          </div>
        )}

        {actionSuccess && (
          <div className="admin-feedback-success" role="status" style={{ marginBottom: '14px' }}>
            {actionSuccess}
          </div>
        )}

        {page === 'overview' ? (
          <>
            <div className="admin-stats">
              <StatCard
                title="ממתינות לאישור"
                value={metricValue('stations', pendingStations.length)}
                icon={Clock}
                tone={pendingStations.length > 0 ? 'orange' : 'green'}
                onClick={() => changePage('stations', { stationFilter: 'pending' })}
              />
              <StatCard
                title="משתמשים"
                value={metricValue('users', data.users.length)}
                icon={Users}
                tone="blue"
                onClick={() => changePage('users')}
              />
              <StatCard
                title="נהגים"
                value={metricValue('drivers', data.drivers.length)}
                icon={CarFront}
                tone="green"
                onClick={() => changePage('drivers')}
              />
              <StatCard
                title="בעלי תחנות"
                value={metricValue('owners', activeOwners.length)}
                icon={Building2}
                tone="blue"
                onClick={() => changePage('owners')}
              />
              <StatCard
                title="עמדות טעינה"
                value={metricValue('stations', data.stations.length)}
                icon={Zap}
                tone="orange"
                onClick={() => changePage('stations')}
              />
              <StatCard
                title="הזמנות פעילות"
                value={metricValue('bookings', activeBookings)}
                icon={CalendarDays}
                tone="green"
                onClick={() => changePage('bookings', { onlyActiveBookings: true })}
              />
              <StatCard
                title="עמדות תקולות"
                value={metricValue('stations', faultyStations)}
                icon={TriangleAlert}
                tone="red"
                onClick={() => changePage('stations', { stationFilter: 'faulty' })}
              />
              <StatCard
                title="רכבים רשומים"
                value={metricValue('vehicles', data.vehicles.length)}
                icon={Car}
                tone="blue"
                onClick={() => changePage('vehicles')}
              />
              <StatCard
                title="ביקורות"
                value={metricValue('reviews', data.reviews.length)}
                icon={Star}
                tone="orange"
                onClick={() => changePage('reviews')}
              />
            </div>

            <div className="admin-overview-grid" style={{ marginTop: '22px' }}>
              <section className="admin-panel">
                <h2>תור אימות ואישור עמדות ({pendingStations.length})</h2>
                {loading || errors.stations ? (
                  <p style={{ color: '#64748b' }}>הנתונים אינם זמינים כרגע.</p>
                ) : pendingStations.length === 0 ? (
                  <p style={{ color: '#047857', fontWeight: 600, margin: 0 }}>
                    אין כרגע עמדות חדשות הממתינות לאימות.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {pendingStations.map((station) => (
                      <div
                        key={station.id}
                        style={{
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: '14px',
                          padding: '14px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px',
                        }}
                      >
                        <div style={{ flex: '1 1 280px' }}>
                          <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                            {station.name}{' '}
                            <span style={{ color: '#64748b', fontWeight: 500, fontSize: '13px' }}>
                              (#{station.id})
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>
                            {station.address} · {station.chargerType} · {station.maxKw} kW · ₪
                            {station.pricePerKwh.toFixed(2)}/kWh
                          </div>
                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                            <strong>פרטי בעלים לאימות:</strong>{' '}
                            {station.ownerName ?? `בעלים #${station.ownerId}`}
                            {station.ownerEmail ? ` · ${station.ownerEmail}` : ''}
                            {station.ownerPhone ? ` · ${station.ownerPhone}` : ''}
                          </div>
                        </div>

                        <div className="admin-actions-cell">
                          <a
                            href={getMapsUrl(station.latitude, station.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-action-btn"
                            style={{ textDecoration: 'none' }}
                          >
                            <MapPin size={14} />
                            בדוק במפה
                          </a>
                          <button
                            type="button"
                            className="admin-action-btn"
                            style={{
                              borderColor: '#86efac',
                              background: '#f0fdf4',
                              color: '#166534',
                            }}
                            onClick={() => requestApproveStation(station)}
                          >
                            <CheckCircle2 size={14} />
                            אשר עמדה
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn danger"
                            onClick={() => openRejectDialog(station)}
                          >
                            <XCircle size={14} />
                            דחה עמדה
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="admin-panel">
                <h2>מצב עמדות הטעינה</h2>
                {loading || errors.stations ? (
                  <p>הנתונים אינם זמינים כרגע.</p>
                ) : (
                  stationGroups.map((group) => (
                    <div className="admin-chart-row" key={group.label}>
                      <div className="admin-chart-label">
                        <span>{group.label}</span>
                        <strong>{group.count}</strong>
                      </div>
                      <div className="admin-chart-track">
                        <div
                          style={{
                            width: `${
                              (group.count / Math.max(data.stations.length, 1)) * 100
                            }%`,
                            background: group.color,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>
          </>
        ) : (
          <section className="admin-panel">
            <div className="admin-toolbar">
              <div className="admin-search">
                <Search size={19} />
                <input
                  type="search"
                  aria-label="חיפוש בטבלה"
                  placeholder="חיפוש בטבלה..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPageNumber(1);
                  }}
                />
              </div>

              {page === 'stations' && (
                <div className="admin-actions-cell">
                  <button
                    type="button"
                    className="admin-action-btn"
                    style={
                      stationFilter === 'all'
                        ? { background: '#0f172a', color: '#fff', borderColor: '#0f172a' }
                        : undefined
                    }
                    onClick={() => {
                      setStationFilter('all');
                      setPageNumber(1);
                    }}
                  >
                    הכל
                  </button>
                  <button
                    type="button"
                    className="admin-action-btn"
                    style={
                      stationFilter === 'pending'
                        ? { background: '#ea580c', color: '#fff', borderColor: '#ea580c' }
                        : undefined
                    }
                    onClick={() => {
                      setStationFilter('pending');
                      setPageNumber(1);
                    }}
                  >
                    ממתינות לאישור ({pendingStations.length})
                  </button>
                  <button
                    type="button"
                    className="admin-action-btn"
                    style={
                      stationFilter === 'faulty'
                        ? { background: '#dc2626', color: '#fff', borderColor: '#dc2626' }
                        : undefined
                    }
                    onClick={() => {
                      setStationFilter('faulty');
                      setPageNumber(1);
                    }}
                  >
                    תקולות ({faultyStations})
                  </button>
                </div>
              )}

              {page === 'bookings' && (
                <label className="admin-filter">
                  <input
                    type="checkbox"
                    checked={onlyActiveBookings}
                    onChange={(event) => {
                      setOnlyActiveBookings(event.target.checked);
                      setPageNumber(1);
                    }}
                  />
                  הזמנות פעילות בלבד
                </label>
              )}

              {page === 'logs' && (
                <label className="admin-filter">
                  <input
                    type="checkbox"
                    checked={onlyFaults}
                    onChange={(event) => {
                      setOnlyFaults(event.target.checked);
                      setPageNumber(1);
                    }}
                  />
                  דיווחי תקלה בלבד
                </label>
              )}

              <span className="admin-result-count">
                {filteredRows.length} רשומות
              </span>
            </div>

            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    {table.headers.map((header) => (
                      <th key={header} scope="col">
                        {header}
                      </th>
                    ))}
                    {table.hasActions && <th scope="col">פעולות</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      {row.cells.map((cell, index) => (
                        <td key={index}>
                          {index === table.statusColumn ? (
                            <StatusBadge
                              status={cell === null ? null : String(cell)}
                            />
                          ) : index === table.approvalColumn ? (
                            (() => {
                              const meta = getApprovalMeta(
                                cell === null ? null : String(cell)
                              );
                              return (
                                <span className={`dash-status tone-${meta.tone}`}>
                                  <span className="dash-status-dot" />
                                  {meta.label}
                                </span>
                              );
                            })()
                          ) : typeof cell === 'boolean' ? (
                            cell ? 'כן' : 'לא'
                          ) : (
                            cell ?? '—'
                          )}
                        </td>
                      ))}
                      {table.hasActions && (
                        <td>{renderRowActions(row.id)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loading && visibleRows.length === 0 && (
              <div className="admin-empty">
                {errors[page]
                  ? 'טעינת הנתונים נכשלה'
                  : 'לא נמצאו רשומות מתאימות'}
              </div>
            )}

            <div className="admin-pagination">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPageNumber(safePage - 1)}
              >
                <ChevronRight size={18} />
                הקודם
              </button>
              <span>
                עמוד {safePage} מתוך {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount}
                onClick={() => setPageNumber(safePage + 1)}
              >
                הבא
                <ChevronLeft size={18} />
              </button>
            </div>
          </section>
        )}
      </main>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.title ?? ''}
        message={pendingAction?.message ?? ''}
        confirmText={pendingAction?.confirmText ?? 'אישור'}
        variant={pendingAction?.variant ?? 'danger'}
        loading={actionLoading}
        onConfirm={() => void executePendingAction()}
        onCancel={() => {
          if (!actionLoading) setPendingAction(null);
        }}
      />

      <dialog
        ref={detailsDialogRef}
        className="smart-dialog"
        style={{ width: 'min(620px, calc(100% - 32px))' }}
        dir="rtl"
        onCancel={(event) => {
          event.preventDefault();
          setDetailsStation(null);
        }}
      >
        {detailsStation && (() => {
          const approvalMeta = getApprovalMeta(detailsStation.approvalStatus);
          return (
            <>
              <div className="smart-dialog-header">
                <div className="smart-dialog-icon">
                  <Zap size={26} />
                </div>
                <button
                  type="button"
                  className="smart-dialog-close"
                  aria-label="סגירה"
                  onClick={() => setDetailsStation(null)}
                >
                  <X size={21} />
                </button>
              </div>

              <h2 style={{ marginBottom: '6px' }}>
                {detailsStation.name}{' '}
                <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 600 }}>
                  (#{detailsStation.id})
                </span>
              </h2>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '18px',
                }}
              >
                <StatusBadge
                  status={detailsStation.isActive ? detailsStation.currentStatus : 'Inactive'}
                />
                <span className={`dash-status tone-${approvalMeta.tone}`}>
                  <span className="dash-status-dot" />
                  {approvalMeta.label}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '16px',
                  fontSize: '13.5px',
                }}
              >
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>כתובת</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{detailsStation.address}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>בעלים</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    {detailsStation.ownerName
                      ? `${detailsStation.ownerName} (#${detailsStation.ownerId})`
                      : `בעלים #${detailsStation.ownerId}`}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>דוא״ל בעלים</div>
                  <div style={{ fontWeight: 600, color: '#0f172a', overflowWrap: 'anywhere' }}>
                    {detailsStation.ownerEmail || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>טלפון בעלים</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    {detailsStation.ownerPhone || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>סוג מחבר והספק</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    {detailsStation.chargerType} · {detailsStation.maxKw} kW
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>מחיר לקוט״ש</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    ₪{detailsStation.pricePerKwh.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>דירוג</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    {detailsStation.averageRating != null
                      ? `${detailsStation.averageRating.toFixed(1)} (${detailsStation.reviewsCount} ביקורות)`
                      : 'טרם דורגה'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>קואורדינטות</div>
                  <div className="font-mono-num" style={{ fontWeight: 600, color: '#0f172a' }}>
                    {detailsStation.latitude.toFixed(5)}, {detailsStation.longitude.toFixed(5)}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>שעות השבתה קבועות</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    {formatBlockedHours(detailsStation.blockedHours)}
                  </div>
                </div>
              </div>

              {detailsStation.approvalStatus === 'Rejected' && detailsStation.rejectionReason && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '13px',
                  }}
                >
                  <strong>סיבת הדחייה:</strong> {detailsStation.rejectionReason}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  paddingTop: '18px',
                  marginTop: '18px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <a
                    href={getMapsUrl(detailsStation.latitude, detailsStation.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-action-btn"
                    style={{ textDecoration: 'none', padding: '8px 14px' }}
                  >
                    <MapPin size={15} />
                    פתח ב-Google Maps
                  </a>
                  {detailsStation.approvalStatus !== 'Approved' && (
                    <button
                      type="button"
                      className="admin-action-btn"
                      style={{
                        borderColor: '#86efac',
                        background: '#f0fdf4',
                        color: '#166534',
                        padding: '8px 14px',
                      }}
                      onClick={() => {
                        const target = detailsStation;
                        setDetailsStation(null);
                        requestApproveStation(target);
                      }}
                    >
                      <CheckCircle2 size={15} />
                      אשר עמדה
                    </button>
                  )}
                  {detailsStation.approvalStatus !== 'Rejected' && (
                    <button
                      type="button"
                      className="admin-action-btn danger"
                      style={{ padding: '8px 14px' }}
                      onClick={() => {
                        const target = detailsStation;
                        setDetailsStation(null);
                        openRejectDialog(target);
                      }}
                    >
                      <XCircle size={15} />
                      דחה עמדה
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="smart-dialog-cancel"
                  style={{ minHeight: '40px', padding: '8px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
                  onClick={() => setDetailsStation(null)}
                >
                  סגור
                </button>
              </div>
            </>
          );
        })()}
      </dialog>

      <dialog
        ref={rejectDialogRef}
        className="smart-dialog dialog-danger"
        dir="rtl"
        onCancel={(event) => {
          event.preventDefault();
          if (!rejectLoading) setRejectTarget(null);
        }}
      >
        <div className="smart-dialog-header">
          <div className="smart-dialog-icon">
            <XCircle size={28} />
          </div>
          <button
            type="button"
            className="smart-dialog-close"
            aria-label="סגירה"
            disabled={rejectLoading}
            onClick={() => setRejectTarget(null)}
          >
            <X size={21} />
          </button>
        </div>
        <h2>דחיית עמדה</h2>
        <p>
          דחיית העמדה <strong>{rejectTarget?.name}</strong> תסתיר אותה ממפת הנהגים ותציג את הסיבה לבעל התחנה.
        </p>
        <div style={{ marginTop: '12px', textAlign: 'right' }}>
          <label
            htmlFor="admin-reject-reason"
            style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}
          >
            סיבת הדחייה
          </label>
          <textarea
            id="admin-reject-reason"
            rows={3}
            className="form-control"
            placeholder="לדוגמה: הכתובת שגויה או שלא ניתן לאמת עמדה קיימת במיקום זה..."
            value={rejectReason}
            disabled={rejectLoading}
            onChange={(e) => {
              setRejectReason(e.target.value);
              if (rejectValidationError) setRejectValidationError(null);
            }}
          />
          {rejectValidationError && (
            <div style={{ color: '#b91c1c', fontSize: '12px', marginTop: '6px' }}>
              {rejectValidationError}
            </div>
          )}
        </div>
        <div className="smart-dialog-actions" style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="smart-dialog-cancel"
            disabled={rejectLoading}
            onClick={() => setRejectTarget(null)}
          >
            ביטול
          </button>
          <button
            type="button"
            className="smart-dialog-confirm"
            disabled={rejectLoading}
            onClick={() => void handleConfirmReject()}
          >
            {rejectLoading ? 'שומר דחייה...' : 'אשר דחייה'}
          </button>
        </div>
      </dialog>
    </div>
  );
}