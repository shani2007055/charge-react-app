import {
  useEffect,
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
  type LucideIcon,
} from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import ConfirmDialog from '../ui/ConfirmDialog';
import PageHeader from '../ui/PageHeader';
import StatCard from '../ui/StatCard';
import StatusBadge from '../ui/StatusBadge';
import {
  deleteAdminDriver,
  deleteAdminOwner,
  deleteAdminStatusLog,
  deleteAdminUser,
  fetchAdminData,
} from './adminApi';
import {
  emptyAdminData,
  type AdminData,
  type AdminPage,
  type AdminSection,
} from './adminTypes';
import './AdminDashboard.css';

const PAGE_SIZE = 12;

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
};

interface TableData {
  headers: string[];
  rows: TableRow[];
  statusColumn?: number;
  hasActions?: boolean;
}

interface PendingAdminAction {
  title: string;
  message: string;
  confirmText: string;
  successMessage: string;
  run: () => Promise<void>;
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('he-IL');
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
          'מזהה', 'שם עמדה', 'כתובת',
          'מזהה בעלים', 'מחבר', 'הספק',
          'מחיר לקוט״ש', 'דירוג', 'סטטוס',
        ],
        statusColumn: 8,
        rows: data.stations.map((s) => ({
          id: s.id,
          cells: [
            s.id, s.name, s.address, s.ownerId,
            s.chargerType,
            `${s.maxKw} kW`,
            `₪${s.pricePerKwh.toFixed(2)}`,
            s.averageRating?.toFixed(1) ?? '—',
            s.isActive ? s.currentStatus : 'Inactive',
          ],
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

  const [pendingAction, setPendingAction] =
    useState<PendingAdminAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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

      if (!query) return true;

      return row.cells.some((cell) =>
        String(cell ?? '').toLowerCase().includes(query)
      );
    });
  }, [table.rows, search, page, onlyFaults]);

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
      faulty: 0,
      inactive: 0,
    };

    for (const s of data.stations) {
      if (!s.isActive) {
        counts.inactive += 1;
      } else if (s.currentStatus?.toLowerCase() === 'faulty') {
        counts.faulty += 1;
      } else if (
        s.currentStatus?.toLowerCase() === 'busy' ||
        s.currentStatus?.toLowerCase() === 'occupied'
      ) {
        counts.busy += 1;
      } else {
        counts.available += 1;
      }
    }

    return [
      { label: 'זמינות', count: counts.available, color: '#16a34a' },
      { label: 'תפוסות / משוריינות', count: counts.busy, color: '#ea580c' },
      { label: 'תקולות', count: counts.faulty, color: '#dc2626' },
      { label: 'מושבתות', count: counts.inactive, color: '#64748b' },
    ];
  }, [data.stations]);

  function metricValue(section: AdminSection, value: number): string | number {
    if (loading || errors[section]) return '—';
    return value;
  }

  function changePage(nextPage: AdminPage) {
    setPage(nextPage);
    setSearch('');
    setPageNumber(1);
    setOnlyFaults(false);
    setActionError(null);
    setActionSuccess(null);
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
                title="משתמשים"
                value={metricValue('users', data.users.length)}
                icon={Users}
                tone="blue"
              />
              <StatCard
                title="נהגים"
                value={metricValue('drivers', data.drivers.length)}
                icon={CarFront}
                tone="green"
              />
              <StatCard
                title="בעלי תחנות"
                value={metricValue('owners', activeOwners.length)}
                icon={Building2}
                tone="blue"
              />
              <StatCard
                title="עמדות טעינה"
                value={metricValue('stations', data.stations.length)}
                icon={Zap}
                tone="orange"
              />
              <StatCard
                title="הזמנות פעילות"
                value={metricValue('bookings', activeBookings)}
                icon={CalendarDays}
                tone="green"
              />
              <StatCard
                title="עמדות תקולות"
                value={metricValue('stations', faultyStations)}
                icon={TriangleAlert}
                tone="red"
              />
              <StatCard
                title="רכבים רשומים"
                value={metricValue('vehicles', data.vehicles.length)}
                icon={Car}
                tone="blue"
              />
              <StatCard
                title="ביקורות"
                value={metricValue('reviews', data.reviews.length)}
                icon={Star}
                tone="orange"
              />
            </div>

            <div className="admin-overview-grid">
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

              <section className="admin-panel">
                <h2>מעבר מהיר לניהול</h2>
                <div className="admin-shortcuts">
                  {navigation.slice(1).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => changePage(item.id)}
                      >
                        <Icon size={23} />
                        {item.label}
                        <ChevronLeft size={16} />
                      </button>
                    );
                  })}
                </div>
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
        variant="danger"
        loading={actionLoading}
        onConfirm={() => void executePendingAction()}
        onCancel={() => {
          if (!actionLoading) setPendingAction(null);
        }}
      />
    </div>
  );
}