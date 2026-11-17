import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plug, Zap, Clock, Info, Star, Wallet } from 'lucide-react';
import { apiFetch } from '../api/apiClient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSelectedVehicle } from '../store/stations/stationsSlice';
import type { Station } from '../store/stations/stationsState';
import { fetchStations } from '../store/stations/stationsThunks';
import type { Vehicle } from '../types/Vehicle';
import { fetchNearbyPublicStations, type PublicStation } from '../utils/publicStations';
import StationsMap, { type MapStationItem } from './StationsMap';
import PageHeader from './ui/PageHeader';
import StationNavigation from './ui/StationNavigation';
import RouteStopMetrics from './ui/RouteStopMetrics';
import StatusBadge from './ui/StatusBadge';
import './ui/DriverDashboard.css';

interface BookingStatusOnly {
  status: string;
}

type QuickFilter = 'all' | 'available' | 'fast';
type SourceFilter = 'all' | 'private' | 'public';
type SortBy = 'recommended' | 'cheapest' | 'closest' | 'fastest';

const ACTIVE_STATUSES = ['Held', 'Confirmed', 'Charging'];
const DEFAULT_PUBLIC_CENTER = { lat: 32.0853, lng: 34.7818 };

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(r * c * 10) / 10;
}

function estimateReservationWindow(distanceKm: number | null): {
  travelMinutes: number;
  bufferMinutes: number;
  totalMinutes: number;
} {
  const bufferMinutes = 5;
  const travelMinutes = distanceKm !== null ? Math.max(3, Math.round(distanceKm * 1.8)) : 10;
  const totalMinutes = Math.min(30, Math.max(10, travelMinutes + bufferMinutes));
  return { travelMinutes, bufferMinutes, totalMinutes };
}

function getStationAvailability(station: Station): {
  canReserve: boolean;
  closedLabel: string | null;
  disabledButtonText: string | null;
} {
  if (!station.isActive) {
    return {
      canReserve: false,
      closedLabel: null,
      disabledButtonText: 'מושבתת כרגע',
    };
  }

  if (station.isClosedBySchedule) {
    const nextOpen =
      station.nextOpenHour != null ? `${String(station.nextOpenHour).padStart(2, '0')}:00` : null;
    const label = nextOpen ? `סגורה · תיפתח ב-${nextOpen}` : 'סגורה לפי לו״ז';
    return {
      canReserve: false,
      closedLabel: label,
      disabledButtonText: label,
    };
  }

  const normalizedStatus = (station.currentStatus ?? '').trim().toLowerCase();
  if (normalizedStatus === 'faulty') {
    return { canReserve: false, closedLabel: null, disabledButtonText: 'תקולה כרגע' };
  }
  if (normalizedStatus === 'occupied' || normalizedStatus === 'busy') {
    return { canReserve: false, closedLabel: null, disabledButtonText: 'תפוסה כרגע' };
  }
  if (normalizedStatus === 'reserved') {
    return { canReserve: false, closedLabel: null, disabledButtonText: 'משוריינת כרגע' };
  }

  return { canReserve: true, closedLabel: null, disabledButtonText: null };
}

function isValidCoordPair(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function publicStationToMapItem(
  pub: PublicStation,
  showDistance: boolean
): MapStationItem {
  return {
    station: {
      id: pub.id,
      ownerId: 0,
      name: pub.name,
      address: pub.address,
      latitude: pub.latitude,
      longitude: pub.longitude,
      chargerType: pub.chargerLabel,
      maxKw: pub.maxKw ?? 0,
      pricePerKwh: 0,
      isActive: true,
      averageRating: null,
      reviewsCount: 0,
      currentStatus: null,
    },
    distanceKm: showDistance ? pub.distanceKm : undefined,
    isPublic: true,
    publicMeta: {
      operator: pub.operator,
      chargerLabel: pub.chargerLabel,
      maxKw: pub.maxKw,
      feeLabel: pub.feeLabel,
      openingHours: pub.openingHours,
    },
  };
}

export default function StationResultsScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    items,
    recommendations,
    hasSearched,
    currentBatteryPercent,
    targetBatteryPercent,
    driverLocation,
    selectedVehicleId,
    loading,
    error,
    routeResult,
    destination,
  } = useAppSelector((state) => state.stations);

  // מצב מסלול פעיל = החיפוש האחרון היה עם יעד (ועדיין מוצגות תוצאות החיפוש)
  const isRouteMode = hasSearched && routeResult !== null;
  const arrivalPercent = routeResult?.arrivalPercentAtDestination ?? null;
  const isLowArrivalWarning = Boolean(
    isRouteMode &&
    routeResult?.noChargeNeeded &&
    arrivalPercent !== null &&
    arrivalPercent < 20
  );

  const [bookingError, setBookingError] = useState<{
    stationId: number;
    message: string;
  } | null>(null);
  const [hasActiveBooking, setHasActiveBooking] = useState<boolean>(false);
  const [reservingId, setReservingId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recommended');
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  const [showStationsAnyway, setShowStationsAnyway] = useState<boolean>(false);
  const [fallbackSiteStations, setFallbackSiteStations] = useState<Station[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState<boolean>(false);

  const [publicStations, setPublicStations] = useState<PublicStation[]>([]);
  const [publicLoading, setPublicLoading] = useState<boolean>(false);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [publicRetryCounter, setPublicRetryCounter] = useState<number>(0);

  useEffect(() => {
    setShowStationsAnyway(false);
    setBookingError(null);
  }, [routeResult]);

  useEffect(() => {
    if (!hasSearched) {
      void dispatch(fetchStations());
    }

    async function checkActiveBooking() {
      try {
        const myBookings = await apiFetch<BookingStatusOnly[]>('/ChargeBooking/my');
        setHasActiveBooking(myBookings.some((b) => ACTIVE_STATUSES.includes(b.status)));
      } catch {
        // המשתמש אינו נהג
      }
    }
    void checkActiveBooking();
  }, [dispatch, hasSearched]);

  const shouldUseFallbackSiteStations = Boolean(
    isRouteMode &&
    routeResult?.noChargeNeeded &&
    recommendations.length === 0 &&
    (isLowArrivalWarning || showStationsAnyway)
  );

  useEffect(() => {
    if (!shouldUseFallbackSiteStations || items.length > 0 || fallbackSiteStations.length > 0) {
      return;
    }

    let cancelled = false;

    async function loadFallbackStations() {
      setFallbackLoading(true);
      try {
        const list = await apiFetch<Station[]>('/ChargingStations');
        if (!cancelled) {
          setFallbackSiteStations(list);
        }
      } catch {
        // נתמודד בשקט אם הרשת נכשלה
      } finally {
        if (!cancelled) {
          setFallbackLoading(false);
        }
      }
    }

    void loadFallbackStations();

    return () => {
      cancelled = true;
    };
  }, [shouldUseFallbackSiteStations, items.length, fallbackSiteStations.length]);

  const publicSearchCenter = useMemo(() => {
    if (
      driverLocation &&
      isValidCoordPair(driverLocation.lat, driverLocation.lng)
    ) {
      return driverLocation;
    }

    const firstRec = recommendations.find((r) =>
      isValidCoordPair(r.station.latitude, r.station.longitude)
    );
    if (firstRec) {
      return {
        lat: firstRec.station.latitude,
        lng: firstRec.station.longitude,
      };
    }

    const firstItem = items.find((s) =>
      isValidCoordPair(s.latitude, s.longitude)
    );
    if (firstItem) {
      return {
        lat: firstItem.latitude,
        lng: firstItem.longitude,
      };
    }

    return DEFAULT_PUBLIC_CENTER;
  }, [driverLocation, recommendations, items]);

  useEffect(() => {
    if (loading) return;

    const controller = new AbortController();
    let cancelled = false;

    async function loadPublic() {
      setPublicLoading(true);
      setPublicError(null);
      try {
        const list = await fetchNearbyPublicStations(
          publicSearchCenter.lat,
          publicSearchCenter.lng,
          15000,
          controller.signal
        );
        if (!cancelled) {
          setPublicStations(list);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) {
          setPublicStations([]);
          setPublicError(
            err instanceof Error
              ? err.message
              : 'לא ניתן לטעון עמדות ציבוריות כרגע'
          );
        }
      } finally {
        if (!cancelled) {
          setPublicLoading(false);
        }
      }
    }

    void loadPublic();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    loading,
    publicSearchCenter.lat,
    publicSearchCenter.lng,
    publicRetryCounter,
  ]);

  const handleReserveStation = useCallback(
    async (station: Station, explicitDistanceKm?: number) => {
      setBookingError(null);
      setReservingId(station.id);

      try {
        const availability = getStationAvailability(station);
        if (!availability.canReserve) {
          throw new Error(availability.disabledButtonText ?? 'העמדה אינה פנויה לשריון כרגע.');
        }

        const vehicles = await apiFetch<Vehicle[]>('/UsersVehicles/my');
        let vehicle = vehicles.find((v) => v.id === selectedVehicleId);

        if (!vehicle && selectedVehicleId === null) {
          const compatible = vehicles.filter(
            (v) =>
              v.supportedChargerType.trim().toLowerCase() ===
              station.chargerType.trim().toLowerCase()
          );
          if (compatible.length === 1) {
            vehicle = compatible[0];
            dispatch(setSelectedVehicle(vehicle.id));
          } else if (vehicles.length === 1) {
            vehicle = vehicles[0];
            dispatch(setSelectedVehicle(vehicle.id));
          }
        }

        if (!vehicle) {
          throw new Error(
            vehicles.length === 0
              ? 'לא נמצא רכב רשום. יש להוסיף רכב בפרופיל האישי לפני השריון.'
              : 'יש לבחור רכב במסך החיפוש או במסך פרטי התחנה לפני השריון.'
          );
        }

        if (
          vehicle.supportedChargerType.trim().toLowerCase() !==
          station.chargerType.trim().toLowerCase()
        ) {
          throw new Error(
            `סוג מחבר העמדה (${station.chargerType}) אינו תואם למחבר הרכב הנבחר (${vehicle.supportedChargerType}).`
          );
        }

        const currentBattery = currentBatteryPercent;
        const targetBattery = targetBatteryPercent;

        if (
          !Number.isFinite(currentBattery) ||
          !Number.isFinite(targetBattery) ||
          currentBattery < 0 ||
          currentBattery >= 100 ||
          targetBattery <= currentBattery ||
          targetBattery > 100
        ) {
          throw new Error('נתוני הסוללה אינם תקינים.');
        }

        const distanceKm =
          typeof explicitDistanceKm === 'number'
            ? explicitDistanceKm
            : driverLocation
              ? calculateDistanceKm(
                  driverLocation.lat,
                  driverLocation.lng,
                  station.latitude,
                  station.longitude
                )
              : null;

        const { totalMinutes } = estimateReservationWindow(distanceKm);
        // שליחה ב-UTC (עם Z) כדי שהשרת ימיר במדויק לשעון המקומי שלו ולא יחתוך תמיד ל-30 דק'
        const arrivalTime = new Date(Date.now() + totalMinutes * 60 * 1000).toISOString();

        await apiFetch('/ChargeBooking', {
          method: 'POST',
          body: JSON.stringify({
            stationId: station.id,
            vehicleId: vehicle.id,
            currentBatteryPercent: currentBattery,
            targetBatteryPercent: targetBattery,
            estimatedArrivalTime: arrivalTime,
          }),
        });
        navigate('/active');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'שגיאה בשריון העמדה';
        if (msg.includes('הזמנה פעילה')) {
          setHasActiveBooking(true);
        }
        const friendlyMessage = msg.includes('403')
          ? 'כדי לשריין עמדה צריך להתחבר ממסך הכניסה בתפקיד נהג (Driver).'
          : msg;
        setBookingError({ stationId: station.id, message: friendlyMessage });
        document
          .getElementById(`station-card-${station.id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } finally {
        setReservingId(null);
      }
    },
    [
      selectedVehicleId,
      currentBatteryPercent,
      targetBatteryPercent,
      driverLocation,
      dispatch,
      navigate,
    ]
  );

  const matchesQuickFilter = useCallback(
    (station: Station) => {
      if (quickFilter === 'available') {
        return getStationAvailability(station).canReserve;
      }
      if (quickFilter === 'fast') {
        return station.maxKw >= 50;
      }
      return true;
    },
    [quickFilter]
  );

  const showPrivate = sourceFilter === 'all' || sourceFilter === 'private';
  const showPublic = sourceFilter === 'all' || sourceFilter === 'public';

  const filteredRecommendations = useMemo(() => {
    if (!showPrivate) return [];
    const list = recommendations.filter((rec) => matchesQuickFilter(rec.station));

    if (sortBy === 'recommended') {
      return list;
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'cheapest') {
        return a.station.pricePerKwh - b.station.pricePerKwh;
      }
      if (sortBy === 'closest') {
        return a.distanceKm - b.distanceKm;
      }
      return b.station.maxKw - a.station.maxKw;
    });
  }, [showPrivate, recommendations, matchesQuickFilter, sortBy]);

  const siteStationsSource = items.length > 0 ? items : fallbackSiteStations;

  const filteredItems = useMemo(() => {
    if (!showPrivate) return [];
    const list = siteStationsSource.filter((station) => matchesQuickFilter(station));

    if (sortBy === 'recommended' && !shouldUseFallbackSiteStations) {
      return list;
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'cheapest') {
        return a.pricePerKwh - b.pricePerKwh;
      }
      if (sortBy === 'fastest') {
        return b.maxKw - a.maxKw;
      }
      if (!driverLocation) {
        return 0;
      }
      const distA = calculateDistanceKm(
        driverLocation.lat,
        driverLocation.lng,
        a.latitude,
        a.longitude
      );
      const distB = calculateDistanceKm(
        driverLocation.lat,
        driverLocation.lng,
        b.latitude,
        b.longitude
      );
      return distA - distB;
    });
  }, [
    showPrivate,
    siteStationsSource,
    matchesQuickFilter,
    sortBy,
    driverLocation,
    shouldUseFallbackSiteStations,
  ]);

  const filteredPublicStations = useMemo(() => {
    if (!showPublic || quickFilter === 'available') return [];
    const list = publicStations.filter((pub) => {
      if (quickFilter === 'fast') {
        return (pub.maxKw ?? 0) >= 50;
      }
      return true;
    });

    if (sortBy === 'fastest') {
      return [...list].sort((a, b) => (b.maxKw ?? 0) - (a.maxKw ?? 0));
    }

    return [...list].sort((a, b) => a.distanceKm - b.distanceKm);
  }, [showPublic, publicStations, quickFilter, sortBy]);

  const showRankedRecommendations = hasSearched && !shouldUseFallbackSiteStations;

  const mapStations = useMemo<MapStationItem[]>(() => {
    const privateMapItems: MapStationItem[] = showRankedRecommendations
      ? filteredRecommendations.map((rec) => ({
          station: rec.station,
          distanceKm: rec.distanceKm,
          matchPercentage: rec.matchPercentage,
          etaMinutes: estimateReservationWindow(rec.distanceKm).totalMinutes,
        }))
      : filteredItems.map((station) => {
          const distanceKm = driverLocation
            ? calculateDistanceKm(
                driverLocation.lat,
                driverLocation.lng,
                station.latitude,
                station.longitude
              )
            : undefined;
          return {
            station,
            distanceKm,
            etaMinutes:
              distanceKm !== undefined
                ? estimateReservationWindow(distanceKm).totalMinutes
                : undefined,
          };
        });

    const publicMapItems: MapStationItem[] = filteredPublicStations.map((pub) =>
      publicStationToMapItem(pub, driverLocation !== null)
    );

    return [...privateMapItems, ...publicMapItems];
  }, [
    showRankedRecommendations,
    filteredRecommendations,
    filteredItems,
    filteredPublicStations,
    driverLocation,
  ]);

  const handleFocusOnMap = (stationId: number) => {
    setShowMap(true);
    setSelectedStationId(stationId);
  };

  if (loading) {
    return (
      <div className="container" dir="rtl">
        <div className="ev-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ margin: 0, color: 'var(--ev-ink-muted)', fontWeight: 500 }}>
            טוען עמדות טעינה מהשרת...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" dir="rtl">
        <div className="ev-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="ev-alert-error" style={{ marginBottom: 0 }}>
            שגיאה בטעינת העמדות: {error}
          </div>
        </div>
      </div>
    );
  }

  const privateCount = showRankedRecommendations
    ? filteredRecommendations.length
    : filteredItems.length;
  const publicCount = filteredPublicStations.length;
  const canRenderMap = showMap && (mapStations.length > 0 || driverLocation !== null);

  const countSummary =
    sourceFilter === 'public'
      ? `מציג ${publicCount} עמדות ציבוריות בסביבה`
      : sourceFilter === 'private'
        ? `מציג ${privateCount} עמדות באתר`
        : publicCount > 0
          ? `מציג ${privateCount} עמדות באתר + ${publicCount} עמדות ציבוריות`
          : `מציג ${privateCount} עמדות באתר`;

  const renderCompactSpecs = (station: Station) => (
    <div
      className="tabular-nums"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px',
        marginTop: '10px',
        padding: '8px 12px',
        borderRadius: '10px',
        background: '#F8FAFC',
        border: '1px solid var(--ev-border)',
        fontSize: '0.82rem',
        color: 'var(--ev-ink)',
        fontWeight: 600,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Zap size={14} style={{ color: 'var(--ev-brand)' }} />
        {station.maxKw} kW
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Plug size={14} style={{ color: 'var(--ev-brand)' }} />
        {station.chargerType}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Wallet size={14} style={{ color: 'var(--ev-brand)' }} />
        ₪{station.pricePerKwh.toFixed(2)} לקוט&quot;ש
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--ev-ink-muted)' }}>
        <Star size={14} style={{ color: '#F59E0B' }} />
        {station.averageRating != null
          ? `${station.averageRating.toFixed(1)} (${station.reviewsCount})`
          : 'טרם דורגה'}
      </span>
    </div>
  );

  return (
    <div className="dash-page" dir="rtl">
      <PageHeader
        title="עמדות טעינה"
        description={
          hasSearched
            ? 'עמדות טעינה המותאמות לנתוני החיפוש שלך יחד עם עמדות ציבוריות בסביבה'
            : 'גלו את עמדות הטעינה הזמינות במערכת ועמדות ציבוריות באזור'
        }
        icon={MapPin}
      />

      {/* סרגל פעולות ופילטרים מהירים */}
      <div
        className="ev-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            onClick={() => navigate('/search')}
          >
            חזרה לחיפוש
          </button>

          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ev-ink)' }}>
              {isRouteMode
                ? 'עצירות מומלצות בדרך'
                : hasSearched
                  ? 'המלצות מותאמות אישית'
                  : 'כל עמדות הטעינה'}
            </div>
            <div className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)' }}>
              {countSummary}
              {publicLoading && ' · מאתר עמדות ציבוריות...'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* סינון מקור: הכול / עמדות האתר / ציבוריות */}
          <div className="auth-toggle" style={{ marginBottom: 0 }}>
            {(
              [
                { id: 'all', label: 'הכול' },
                { id: 'private', label: 'עמדות האתר' },
                { id: 'public', label: 'ציבוריות' },
              ] as const
            ).map((src) => (
              <button
                key={src.id}
                type="button"
                className={`auth-toggle-btn ${sourceFilter === src.id ? 'active' : ''}`}
                style={{ padding: '6px 11px', fontSize: '0.8rem' }}
                onClick={() => setSourceFilter(src.id)}
              >
                {src.label}
              </button>
            ))}
          </div>

          <div className="auth-toggle" style={{ marginBottom: 0 }}>
            {(
              [
                { id: 'all', label: 'כל המצבים' },
                { id: 'available', label: 'פנויות' },
                { id: 'fast', label: 'מהירות 50kW+' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`auth-toggle-btn ${quickFilter === tab.id ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => setQuickFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label
              htmlFor="results-sort-by"
              style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ev-ink-muted)', margin: 0 }}
            >
              מיון לפי:
            </label>
            <select
              id="results-sort-by"
              className="form-control"
              style={{
                width: 'auto',
                minWidth: '140px',
                padding: '6px 10px',
                fontSize: '0.8rem',
              }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <option value="recommended">
                {showRankedRecommendations ? 'התאמה מומלצת' : 'ברירת מחדל'}
              </option>
              <option value="cheapest">הכי זול</option>
              <option value="closest">הכי קרוב</option>
              <option value="fastest">הכי מהיר</option>
            </select>
          </div>

          {hasSearched && (
            <button
              type="button"
              className="ev-btn ev-btn-secondary ev-btn-auto"
              onClick={() => {
                setQuickFilter('all');
                setSourceFilter('all');
                setSortBy('recommended');
                setSelectedStationId(null);
                setShowStationsAnyway(false);
                void dispatch(fetchStations());
              }}
            >
              כל העמדות
            </button>
          )}

          <button
            type="button"
            className="ev-btn ev-btn-secondary ev-btn-auto"
            onClick={() => setShowMap((prev) => !prev)}
          >
            {showMap ? 'הסתר מפה' : 'הצג מפה'}
          </button>
        </div>
      </div>

      {/* באנר מצב מסלול: אזהרת סוללה נמוכה (<20%) / "אין צורך בטעינה" / סיכום מסלול / שגיאה */}
      {isRouteMode && routeResult && (
        <div
          className={
            isLowArrivalWarning
              ? 'ev-alert-error'
              : routeResult.noChargeNeeded || routeResult.stations.length > 0
                ? 'ev-alert-brand'
                : 'ev-alert-error'
          }
          style={{ marginBottom: 0 }}
        >
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>
            {isLowArrivalWarning
              ? `⚠️ צפי הגעה ליעד עם ~${arrivalPercent}% סוללה בלבד — מומלץ לעצור לטעינה`
              : routeResult.noChargeNeeded
                ? '✅ אין צורך בטעינה'
                : routeResult.stations.length > 0
                  ? '🔌 מומלץ לעצור לטעינה בדרך'
                  : '⚠️ לא נמצאה עצירה מתאימה בדרך'}
          </div>
          <div className="tabular-nums" style={{ fontSize: '0.86rem', marginTop: '4px' }}>
            {destination ? `יעד: ${destination.label} · ` : ''}
            נסיעה ~{routeResult.tripKm} ק&quot;מ · טווח הסוללה (אחרי רזרבה) ~{routeResult.rangeKm} ק&quot;מ
          </div>
          {(isLowArrivalWarning || routeResult.noChargeNeeded || routeResult.stations.length === 0) && (
            <div style={{ fontSize: '0.86rem', marginTop: '4px' }}>
              {isLowArrivalWarning
                ? `על אף שטכנית הסוללה מספיקה לנסיעה, הגעה ליעד עם ~${arrivalPercent}% משאירה מרווח ביטחון נמוך. מציג עבורך עמדות זמינות באתר:`
                : routeResult.message}
            </div>
          )}

          {routeResult.noChargeNeeded && !isLowArrivalWarning && recommendations.length === 0 && (
            <div style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="ev-btn ev-btn-secondary ev-btn-auto"
                onClick={() => setShowStationsAnyway((prev) => !prev)}
              >
                {showStationsAnyway
                  ? 'הסתר עמדות באתר'
                  : 'אני רוצה להטעין בכל זאת — הצג עמדות'}
              </button>
            </div>
          )}
        </div>
      )}

      {hasActiveBooking && (
        <div
          className="ev-alert-brand"
          style={{
            marginBottom: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span style={{ fontWeight: 500 }}>
            קיימת עבורך הזמנה פתוחה במערכת. לא ניתן לשריין עמדה נוספת במקביל.
          </span>
          <button
            type="button"
            className="ev-btn ev-btn-accent ev-btn-auto"
            onClick={() => navigate('/active')}
          >
            עבור להזמנה הפעילה שלי
          </button>
        </div>
      )}

      {bookingError && !showPrivate && (
        <div className="ev-alert-error" style={{ marginBottom: 0 }}>
          {bookingError.message}
        </div>
      )}

      {/* פריסת Split-View: רשימת עמדות + מפה בהירה */}
      <div className={`results-grid ${canRenderMap ? 'has-map' : ''}`}>
        {/* רשימת עמדות */}
        <div className="results-list">
          {showPrivate && (
            <>
              {showRankedRecommendations ? (
                filteredRecommendations.length === 0 ? (
                  // במצב מסלול הבאנר כבר מסביר למה אין עמדות – לא מציגים הודעה כפולה
                  !isRouteMode && (sourceFilter === 'private' || publicCount === 0) ? (
                    <div className="ev-card" style={{ textAlign: 'center', padding: '32px' }}>
                      <p style={{ margin: '0 0 12px 0', color: 'var(--ev-ink-muted)', fontSize: '0.9rem' }}>
                        לא נמצאו עמדות מומלצות התואמות לנתוני החיפוש והסינון.
                      </p>
                      {quickFilter !== 'all' && (
                        <button
                          type="button"
                          className="ev-btn ev-btn-secondary ev-btn-auto"
                          onClick={() => setQuickFilter('all')}
                        >
                          נקה פילטר מהיר
                        </button>
                      )}
                    </div>
                  ) : null
                ) : (
                  filteredRecommendations.map((rec) => {
                    const eta = estimateReservationWindow(rec.distanceKm);
                    const isCappedHold = eta.travelMinutes + eta.bufferMinutes > 30;
                    const isSelected = selectedStationId === rec.station.id;
                    const availability = getStationAvailability(rec.station);
                    const isRouteStop = rec.chargeKwh != null;
                    const cardError =
                      bookingError?.stationId === rec.station.id ? bookingError.message : null;

                    return (
                      <div
                        id={`station-card-${rec.station.id}`}
                        key={rec.station.id}
                        className="ev-card station-result-card"
                        style={{
                          padding: '16px 18px',
                          borderColor: isSelected
                            ? 'var(--ev-brand)'
                            : rec.isEmergencyMode
                              ? 'var(--ev-danger-border)'
                              : undefined,
                          background: rec.isEmergencyMode ? 'var(--ev-danger-soft)' : undefined,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '12px',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '8px',
                              }}
                            >
                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: '1.04rem',
                                  fontWeight: 700,
                                  color: 'var(--ev-ink)',
                                }}
                              >
                                {rec.station.name}
                              </h3>

                              {availability.closedLabel ? (
                                <span className="dash-status tone-red">
                                  <span className="dash-status-dot" />
                                  {availability.closedLabel}
                                </span>
                              ) : (
                                <StatusBadge
                                  status={
                                    rec.station.currentStatus ??
                                    (rec.station.isActive ? 'available' : 'inactive')
                                  }
                                  isActive={rec.station.isActive}
                                />
                              )}
                            </div>

                            <div
                              className="tabular-nums"
                              style={{ fontSize: '0.8rem', color: 'var(--ev-ink-muted)', marginTop: '4px' }}
                            >
                              {rec.station.address} · {rec.distanceKm} ק&quot;מ ממך · הגעה ~
                              {eta.travelMinutes} דק&apos;{' '}
                              {isCappedHold
                                ? `(מקסימום שמירה ${eta.totalMinutes} דק')`
                                : `(+${eta.bufferMinutes} דק' מרווח)`}
                            </div>
                          </div>

                          <div
                            style={{
                              background: 'var(--ev-brand-soft)',
                              border: '1px solid var(--ev-brand-border)',
                              borderRadius: '8px',
                              padding: '4px 10px',
                              textAlign: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <div
                              className="font-mono-num"
                              style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--ev-brand)' }}
                            >
                              {rec.matchPercentage}%
                            </div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--ev-ink-soft)' }}>התאמה</div>
                          </div>
                        </div>

                        {/* במצב חיפוש רגיל מציגים שורת סיכום התאמה; במצב מסלול הנתונים כבר מוצגים מסודר בקוביות */}
                        {!isRouteStop && rec.matchReason && (
                          <p
                            style={{
                              margin: '8px 0 0 0',
                              fontSize: '0.82rem',
                              color: 'var(--ev-brand-hover)',
                              fontWeight: 500,
                            }}
                          >
                            {rec.matchReason}
                          </p>
                        )}

                        <RouteStopMetrics rec={rec} />
                        {renderCompactSpecs(rec.station)}
                        <StationNavigation
                          latitude={rec.station.latitude}
                          longitude={rec.station.longitude}
                        />

                        {cardError && (
                          <div className="ev-alert-error" style={{ marginTop: '10px', marginBottom: 0 }}>
                            <div>{cardError}</div>
                            {hasActiveBooking && (
                              <button
                                type="button"
                                className="ev-btn ev-btn-auto"
                                style={{ marginTop: '8px' }}
                                onClick={() => navigate('/active')}
                              >
                                צפה בהזמנה הפעילה / בטל שריון
                              </button>
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            marginTop: '12px',
                            paddingTop: '10px',
                            borderTop: '1px solid var(--ev-surface-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="ev-btn ev-btn-secondary ev-btn-auto"
                              onClick={() => navigate(`/stations/${rec.station.id}`)}
                            >
                              פרטי תחנה
                            </button>
                            <button
                              type="button"
                              className="ev-btn ev-btn-secondary ev-btn-auto"
                              onClick={() => handleFocusOnMap(rec.station.id)}
                            >
                              הצג במפה
                            </button>
                          </div>

                          <button
                            type="button"
                            className="ev-btn ev-btn-auto"
                            disabled={
                              !availability.canReserve ||
                              reservingId === rec.station.id ||
                              hasActiveBooking
                            }
                            onClick={() => void handleReserveStation(rec.station, rec.distanceKm)}
                          >
                            {reservingId === rec.station.id
                              ? 'משריין עמדה...'
                              : !availability.canReserve
                                ? availability.disabledButtonText
                                : hasActiveBooking
                                  ? 'קיימת הזמנה פעילה'
                                  : `שריין עמדה (שמירה ל-${eta.totalMinutes} דק׳)`}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : fallbackLoading && filteredItems.length === 0 ? (
                <div className="ev-card" style={{ textAlign: 'center', padding: '32px' }}>
                  <p style={{ margin: 0, color: 'var(--ev-ink-muted)', fontSize: '0.9rem' }}>
                    טוען עמדות זמינות באתר...
                  </p>
                </div>
              ) : filteredItems.length === 0 ? (
                sourceFilter === 'private' || publicCount === 0 ? (
                  <div className="ev-card" style={{ textAlign: 'center', padding: '32px' }}>
                    <p style={{ margin: '0 0 12px 0', color: 'var(--ev-ink-muted)', fontSize: '0.9rem' }}>
                      {siteStationsSource.length === 0
                        ? 'אין עדיין עמדות רשומות במסד הנתונים.'
                        : 'אין עמדות באתר התואמות לסינון הנוכחי.'}
                    </p>
                    {quickFilter !== 'all' && (
                      <button
                        type="button"
                        className="ev-btn ev-btn-secondary ev-btn-auto"
                        onClick={() => setQuickFilter('all')}
                      >
                        נקה פילטר מהיר
                      </button>
                    )}
                  </div>
                ) : null
              ) : (
                filteredItems.map((station) => {
                  const isSelected = selectedStationId === station.id;
                  const distKm = driverLocation
                    ? calculateDistanceKm(
                        driverLocation.lat,
                        driverLocation.lng,
                        station.latitude,
                        station.longitude
                      )
                    : null;
                  const eta = estimateReservationWindow(distKm);
                  const isCappedHold = eta.travelMinutes + eta.bufferMinutes > 30;
                  const availability = getStationAvailability(station);
                  const cardError =
                    bookingError?.stationId === station.id ? bookingError.message : null;

                  return (
                    <div
                      id={`station-card-${station.id}`}
                      key={station.id}
                      className="ev-card station-result-card"
                      style={{
                        padding: '16px 18px',
                        borderColor: isSelected ? 'var(--ev-brand)' : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: '1.04rem',
                                fontWeight: 700,
                                color: 'var(--ev-ink)',
                              }}
                            >
                              {station.name}
                            </h3>

                            {availability.closedLabel ? (
                              <span className="dash-status tone-red">
                                <span className="dash-status-dot" />
                                {availability.closedLabel}
                              </span>
                            ) : (
                              <StatusBadge
                                status={
                                  station.currentStatus ??
                                  (station.isActive ? 'available' : 'inactive')
                                }
                                isActive={station.isActive}
                              />
                            )}
                          </div>

                          <div
                            className="tabular-nums"
                            style={{ fontSize: '0.8rem', color: 'var(--ev-ink-muted)', marginTop: '4px' }}
                          >
                            {station.address}
                            {distKm !== null &&
                              ` · ${distKm} ק"מ ממך (הגעה ~${eta.travelMinutes} דק'${
                                isCappedHold ? ` · מקסימום שמירה ${eta.totalMinutes} דק'` : ''
                              })`}
                          </div>
                        </div>
                      </div>

                      {renderCompactSpecs(station)}
                      <StationNavigation
                        latitude={station.latitude}
                        longitude={station.longitude}
                      />

                      {cardError && (
                        <div className="ev-alert-error" style={{ marginTop: '10px', marginBottom: 0 }}>
                          <div>{cardError}</div>
                          {hasActiveBooking && (
                            <button
                              type="button"
                              className="ev-btn ev-btn-auto"
                              style={{ marginTop: '8px' }}
                              onClick={() => navigate('/active')}
                            >
                              צפה בהזמנה הפעילה / בטל שריון
                            </button>
                          )}
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '10px',
                          borderTop: '1px solid var(--ev-surface-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="ev-btn ev-btn-secondary ev-btn-auto"
                            onClick={() => navigate(`/stations/${station.id}`)}
                          >
                            פרטי תחנה
                          </button>
                          <button
                            type="button"
                            className="ev-btn ev-btn-secondary ev-btn-auto"
                            onClick={() => handleFocusOnMap(station.id)}
                          >
                            הצג במפה
                          </button>
                        </div>

                        <button
                          type="button"
                          className="ev-btn ev-btn-auto"
                          disabled={
                            !availability.canReserve ||
                            reservingId === station.id ||
                            hasActiveBooking
                          }
                          onClick={() => void handleReserveStation(station, distKm ?? undefined)}
                        >
                          {reservingId === station.id
                            ? 'משריין עמדה...'
                            : !availability.canReserve
                              ? availability.disabledButtonText
                              : hasActiveBooking
                                ? 'קיימת הזמנה פעילה'
                                : distKm !== null
                                  ? `שריין עמדה (שמירה ל-${eta.totalMinutes} דק׳)`
                                  : 'שריין עמדה'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* עמדות ציבוריות (OpenStreetMap) */}
          {showPublic && (
            <>
              {sourceFilter === 'all' && filteredPublicStations.length > 0 && (
                <div
                  style={{
                    marginTop: privateCount > 0 ? '8px' : 0,
                    padding: '4px 4px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0369A1' }}>
                    עמדות ציבוריות בסביבה ({filteredPublicStations.length})
                  </div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>
                    למידע וניווט בלבד · ללא שריון
                  </span>
                </div>
              )}

              {sourceFilter === 'public' && publicLoading && filteredPublicStations.length === 0 && (
                <div className="ev-card" style={{ textAlign: 'center', padding: '28px' }}>
                  <p style={{ margin: 0, color: 'var(--ev-ink-muted)', fontSize: '0.9rem' }}>
                    מחפש עמדות ציבוריות בסביבה...
                  </p>
                </div>
              )}

              {sourceFilter === 'public' && !publicLoading && publicError && (
                <div className="ev-card" style={{ textAlign: 'center', padding: '28px' }}>
                  <p style={{ margin: '0 0 12px 0', color: 'var(--ev-ink-muted)', fontSize: '0.9rem' }}>
                    {publicError}
                  </p>
                  <button
                    type="button"
                    className="ev-btn ev-btn-secondary ev-btn-auto"
                    onClick={() => setPublicRetryCounter((c) => c + 1)}
                  >
                    נסה שוב
                  </button>
                </div>
              )}

              {sourceFilter === 'public' &&
                !publicLoading &&
                !publicError &&
                filteredPublicStations.length === 0 && (
                  <div className="ev-card" style={{ textAlign: 'center', padding: '28px' }}>
                    <p style={{ margin: '0 0 12px 0', color: 'var(--ev-ink-muted)', fontSize: '0.9rem' }}>
                      {quickFilter === 'available'
                        ? 'לעמדות ציבוריות אין סטטוס פנוי בזמן אמת — סננו לפי "כל המצבים" כדי לצפות בהן.'
                        : 'לא נמצאו עמדות ציבוריות תואמות ברדיוס הקרוב.'}
                    </p>
                    {quickFilter !== 'all' && (
                      <button
                        type="button"
                        className="ev-btn ev-btn-secondary ev-btn-auto"
                        onClick={() => setQuickFilter('all')}
                      >
                        הצג את כל העמדות הציבוריות
                      </button>
                    )}
                  </div>
                )}

              {filteredPublicStations.map((pub) => {
                const isSelected = selectedStationId === pub.id;
                return (
                  <div
                    key={pub.id}
                    className="ev-card public-station-card"
                    style={{
                      borderColor: isSelected ? '#0284C7' : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '1.02rem',
                            fontWeight: 700,
                            color: 'var(--ev-ink)',
                          }}
                        >
                          {pub.name}
                        </h3>
                        <div
                          className="tabular-nums"
                          style={{ fontSize: '0.82rem', color: 'var(--ev-ink-muted)', marginTop: '4px' }}
                        >
                          {pub.address}
                          {driverLocation !== null && ` · ${pub.distanceKm} ק"מ ממך`}
                        </div>
                      </div>

                      <span className="public-station-badge">עמדה ציבורית</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        marginTop: '12px',
                        fontSize: '0.82rem',
                        color: 'var(--ev-ink-muted)',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Plug size={14} style={{ color: '#0284C7' }} />
                        {pub.chargerLabel}
                      </span>
                      {pub.maxKw !== null && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Zap size={14} style={{ color: '#0284C7' }} />
                          {pub.maxKw} kW
                        </span>
                      )}
                      {pub.openingHours && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={14} style={{ color: '#0284C7' }} />
                          {pub.openingHours}
                        </span>
                      )}
                      {(pub.feeLabel || pub.capacity !== null) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Info size={14} style={{ color: '#0284C7' }} />
                          {[
                            pub.feeLabel,
                            pub.capacity !== null ? `${pub.capacity} שקעים` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </div>

                    <StationNavigation
                      latitude={pub.latitude}
                      longitude={pub.longitude}
                    />

                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '10px',
                        borderTop: '1px solid #E0F2FE',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <span style={{ fontSize: '0.78rem', color: 'var(--ev-ink-soft)' }}>
                        עמדה חיצונית מהרשת הציבורית — לניווט בלבד
                      </span>

                      <button
                        type="button"
                        className="ev-btn ev-btn-secondary ev-btn-auto"
                        onClick={() => handleFocusOnMap(pub.id)}
                      >
                        הצג במפה
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* מפה בהירה */}
        {canRenderMap && (
          <div className="ev-card results-map-panel">
            <StationsMap
              stations={mapStations}
              driverLocation={driverLocation}
              hasActiveBooking={hasActiveBooking}
              reservingId={reservingId}
              selectedStationId={selectedStationId}
              onReserve={(station, distanceKm) => void handleReserveStation(station, distanceKm)}
              onOpenDetails={(station) => navigate(`/stations/${station.id}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}