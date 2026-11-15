
import {
  useEffect,
  useState,
  useMemo
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
  type LucideIcon
} from 'lucide-react';

import { useAppSelector } from '../../store/hooks';

import PageHeader from '../ui/PageHeader';
import StatCard from '../ui/StatCard';
import StatusBadge from '../ui/StatusBadge';

import { fetchAdminData } from './adminApi';

import {
  emptyAdminData,
  type AdminData,
  type AdminPage,
  type AdminSection
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
    icon: LayoutDashboard
  },
  {
    id: 'users',
    label: 'משתמשים',
    icon: Users
  },
  {
    id: 'drivers',
    label: 'נהגים',
    icon: CarFront
  },
  {
    id: 'owners',
    label: 'בעלי תחנות',
    icon: Building2
  },
  {
    id: 'stations',
    label: 'עמדות טעינה',
    icon: Zap
  },
  {
    id: 'vehicles',
    label: 'רכבים',
    icon: Car
  },
  {
    id: 'bookings',
    label: 'הזמנות',
    icon: CalendarDays
  },
  {
    id: 'reviews',
    label: 'ביקורות',
    icon: Star
  },
  {
    id: 'logs',
    label: 'יומן סטטוסים ותקלות',
    icon: TriangleAlert
  }
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
          'הרשאה', 'נהג', 'בעל תחנה'
        ],
        rows: data.users.map(u => ({
          id: u.id,
          cells: [
            u.id, u.name, u.email, u.phone,
            u.access === 'Admin'
              ? 'מנהל מערכת'
              : 'משתמש',
            u.driverId != null,
            u.ownerId != null
          ]
        }))
      };

    case 'drivers':
      return {
        headers: [
          'מזהה', 'מזהה משתמש', 'שם',
          'דוא״ל', 'טלפון', 'הזמנות', 'רכבים'
        ],
        rows: data.drivers.map(d => ({
          id: d.id,
          cells: [
            d.id, d.userId, d.name,
            d.email, d.phone,
            d.totalBookings, d.vehicles.length
          ]
        }))
      };

    case 'owners':
      return {
        headers: [
          'מזהה', 'מזהה משתמש',
          'שם', 'דוא״ל', 'טלפון', 'עמדות'
        ],
        rows: data.owners.map(o => ({
          id: o.id,
          cells: [
            o.id, o.userId, o.name,
            o.email, o.phone, o.stationsCount
          ]
        }))
      };

    case 'stations':
      return {
        headers: [
          'מזהה', 'שם עמדה', 'כתובת',
          'מזהה בעלים', 'מחבר', 'הספק',
          'מחיר לקוט״ש', 'דירוג', 'סטטוס'
        ],
        statusColumn: 8,
        rows: data.stations.map(s => ({
          id: s.id,
          cells: [
            s.id, s.name, s.address, s.ownerId,
            s.chargerType,
            `${s.maxKw} kW`,
            `₪${s.pricePerKwh.toFixed(2)}`,
            s.averageRating?.toFixed(1) ?? '—',
            s.isActive ? s.currentStatus : 'Inactive'
          ]
        }))
      };

    case 'vehicles':
      return {
        headers: [
          'מזהה', 'מזהה נהג', 'דגם רכב',
          'קיבולת סוללה', 'סוללה נוכחית', 'מחבר'
        ],
        rows: data.vehicles.map(v => ({
          id: v.id,
          cells: [
            v.id, v.driverId, v.model,
            `${v.batteryCapacityKwh} kWh`,
            `${v.currentBattery}%`,
            v.supportedChargerType
          ]
        }))
      };

    case 'bookings':
      return {
        headers: [
          'מזהה', 'עמדה', 'מזהה נהג',
          'רכב', 'סוללה נוכחית', 'יעד טעינה',
          'סטטוס', 'זמן יצירה', 'הגעה משוערת'
        ],
        statusColumn: 6,
        rows: data.bookings.map(b => ({
          id: b.id,
          cells: [
            b.id, b.stationName, b.driverId,
            b.vehicleModel,
            `${b.currentBatteryPercent}%`,
            `${b.targetBatteryPercent}%`,
            b.status,
            formatDate(b.createdAt),
            formatDate(b.estimatedArrivalTime)
          ]
        }))
      };

    case 'reviews':
      return {
        headers: [
          'מזהה', 'הזמנה', 'עמדה', 'נהג',
          'דירוג', 'ביקורת', 'תאריך'
        ],
        rows: data.reviews.map(r => ({
          id: r.id,
          cells: [
            r.id, r.chargeBookingId,
            r.stationName, r.driverName,
            `${r.rating}/5`,
            r.comment, formatDate(r.createdAt)
          ]
        }))
      };

    case 'logs':
      return {
        headers: [
          'מזהה', 'עמדה', 'סטטוס',
          'נהג משויך', 'עדכון אחרון'
        ],
        statusColumn: 2,
        rows: data.logs.map(l => ({
          id: l.id,
          cells: [
            l.id, l.stationName, l.status,
            l.currentDriverName,
            formatDate(l.updatedAt)
          ]
        }))
      };

    default:
      return { headers: [], rows: [] };
  }
}

export default function AdminDashboard() {

  const { name, token } = useAppSelector(
    state => state.user
  );

  const [page, setPage] =
    useState<AdminPage>('overview');

  const [data, setData] =
    useState<AdminData>(emptyAdminData);

  const [errors, setErrors] = useState<
    Partial<Record<AdminSection, string>>
  >({});

  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);

  const [onlyFaults, setOnlyFaults] =
    useState(false);

  useEffect(() => {

    const controller = new AbortController();

    setLoading(true);
    setErrors({});
    setData(emptyAdminData);

    fetchAdminData(controller.signal)
      .then(result => {

        if (controller.signal.aborted) return;

        setData(result.data);
        setErrors(result.errors);
        setLoading(false);
      });

    return () => controller.abort();

  }, [refresh, token]);

  const currentPage = navigation.find(
    item => item.id === page
  )!;

  const table = useMemo(
    () => getTable(page, data),
    [page, data]
  );

  const filteredRows = useMemo(() => {

    const query = search.toLowerCase().trim();

    return table.rows.filter(row => {

      if (
        page === 'logs' &&
        onlyFaults &&
        row.cells[2] !== 'Faulty'
      ) {
        return false;
      }

      return row.cells.some(value => {

        const text = typeof value === 'boolean'
          ? value ? 'כן' : 'לא'
          : String(value ?? '');

        return text.toLowerCase().includes(query);
      });
    });

  }, [table, search, onlyFaults, page]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE)
  );

  const safePage = Math.min(pageNumber, pageCount);

  const visibleRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const activeBookings = data.bookings.filter(
    b => ['Held', 'Confirmed', 'Charging']
      .includes(b.status)
  ).length;

  const faultyStations = data.stations.filter(
    s => s.currentStatus === 'Faulty'
  ).length;

  const stationGroups = [
    {
      label: 'זמינות',
      color: '#16a34a',
      count: data.stations.filter(
        s => s.isActive &&
          s.currentStatus === 'Available'
      ).length
    },
    {
      label: 'משוריינות',
      color: '#2563eb',
      count: data.stations.filter(
        s => s.isActive &&
          s.currentStatus === 'Reserved'
      ).length
    },
    {
      label: 'תפוסות / בטעינה',
      color: '#ea580c',
      count: data.stations.filter(
        s => s.isActive &&
          ['Occupied', 'Charging']
            .includes(s.currentStatus ?? '')
      ).length
    },
    {
      label: 'תקולות',
      color: '#dc2626',
      count: data.stations.filter(
        s => s.isActive &&
          s.currentStatus === 'Faulty'
      ).length
    },
    {
      label: 'לא פעילות',
      color: '#64748b',
      count: data.stations.filter(
        s => !s.isActive
      ).length
    },
    {
      label: 'סטטוס אחר / לא ידוע',
      color: '#94a3b8',
      count: data.stations.filter(
        s => s.isActive &&
          ![
            'Available', 'Reserved',
            'Occupied', 'Charging', 'Faulty'
          ].includes(s.currentStatus ?? '')
      ).length
    }
  ];

  function changePage(next: AdminPage) {
    setPage(next);
    setSearch('');
    setPageNumber(1);
    setOnlyFaults(false);
  }

  function metricValue(
    section: AdminSection,
    value: number
  ) {
    return loading || errors[section]
      ? '—'
      : value;
  }

  return (

    <div className="admin-layout" dir="rtl">

      <aside className="admin-sidebar">

        <div className="admin-brand">
          <ShieldCheck size={30} />

          <div>
            <strong>Smart EV</strong>
            <small>מרכז ניהול</small>
          </div>
        </div>

        <nav aria-label="ניווט מערכת הניהול">

          {navigation.map(item => {

            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                className={
                  page === item.id ? 'selected' : ''
                }
                aria-current={
                  page === item.id ? 'page' : undefined
                }
                onClick={() => changePage(item.id)}
              >
                <Icon size={19} />
                {item.label}
              </button>
            );
          })}

        </nav>

        <div className="admin-sidebar-footer">
          <ShieldCheck size={17} />
          הרשאת מנהל מערכת
        </div>

      </aside>

      <main className="admin-content dash-page">

        <PageHeader
          title={
            page === 'overview'
              ? 'מרכז הבקרה'
              : currentPage.label
          }
          description={
            page === 'overview'
              ? `שלום, ${name}. סקירת פעילות המערכת`
              : `צפייה וחיפוש בנתוני ${currentPage.label}`
          }
          icon={currentPage.icon}
          actions={
            <button
              type="button"
              className="ev-btn ev-btn-secondary ev-btn-auto"
              disabled={loading}
              onClick={() => setRefresh(v => v + 1)}
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

        {!loading &&
          Object.keys(errors).length > 0 && (
          <div className="ev-alert-error" role="alert">
            חלק ממקורות הנתונים לא נטענו.

            {Object.entries(errors).map(
              ([key, message]) => (
                <div key={key}>
                  {navigation.find(
                    n => n.id === key
                  )?.label}: {message}
                </div>
              )
            )}
          </div>
        )}

        {page === 'overview' ? (

          <>

            <div className="admin-stats">

              <StatCard
                title="משתמשים"
                value={metricValue(
                  'users', data.users.length
                )}
                icon={Users}
                tone="blue"
              />

              <StatCard
                title="נהגים"
                value={metricValue(
                  'drivers', data.drivers.length
                )}
                icon={CarFront}
                tone="green"
              />

              <StatCard
                title="בעלי תחנות"
                value={metricValue(
                  'owners', data.owners.length
                )}
                icon={Building2}
                tone="blue"
              />

              <StatCard
                title="עמדות טעינה"
                value={metricValue(
                  'stations', data.stations.length
                )}
                icon={Zap}
                tone="orange"
              />

              <StatCard
                title="הזמנות פעילות"
                value={metricValue(
                  'bookings', activeBookings
                )}
                icon={CalendarDays}
                tone="green"
              />

              <StatCard
                title="עמדות תקולות"
                value={metricValue(
                  'stations', faultyStations
                )}
                icon={TriangleAlert}
                tone="red"
              />

              <StatCard
                title="רכבים רשומים"
                value={metricValue(
                  'vehicles', data.vehicles.length
                )}
                icon={Car}
                tone="blue"
              />

              <StatCard
                title="ביקורות"
                value={metricValue(
                  'reviews', data.reviews.length
                )}
                icon={Star}
                tone="orange"
              />

            </div>

            <div className="admin-overview-grid">

              <section className="admin-panel">

                <h2>מצב עמדות הטעינה</h2>

                {loading || errors.stations ? (
                  <p>הנתונים אינם זמינים כרגע.</p>
                ) : stationGroups.map(group => (

                  <div
                    className="admin-chart-row"
                    key={group.label}
                  >
                    <div className="admin-chart-label">
                      <span>{group.label}</span>
                      <strong>{group.count}</strong>
                    </div>

                    <div className="admin-chart-track">
                      <div style={{
                        width: `${
                          group.count /
                          Math.max(data.stations.length, 1)
                          * 100
                        }%`,
                        background: group.color
                      }} />
                    </div>
                  </div>

                ))}

              </section>

              <section className="admin-panel">

                <h2>מעבר מהיר לניהול</h2>

                <div className="admin-shortcuts">

                  {navigation.slice(1).map(item => {

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
                  onChange={event => {
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
                    onChange={event => {
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
                    {table.headers.map(header => (
                      <th key={header} scope="col">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {visibleRows.map(row => (
                    <tr key={row.id}>

                      {row.cells.map((cell, index) => (
                        <td key={index}>

                          {index === table.statusColumn
                            ? <StatusBadge
                                status={
                                  cell === null
                                    ? null
                                    : String(cell)
                                }
                              />
                            : typeof cell === 'boolean'
                              ? cell ? 'כן' : 'לא'
                              : cell ?? '—'}

                        </td>
                      ))}

                    </tr>
                  ))}
                </tbody>

              </table>

            </div>

            {!loading &&
              visibleRows.length === 0 && (
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
                onClick={() =>
                  setPageNumber(safePage - 1)
                }
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
                onClick={() =>
                  setPageNumber(safePage + 1)
                }
              >
                הבא
                <ChevronLeft size={18} />
              </button>

            </div>

          </section>

        )}

      </main>

    </div>
  );
}
