import { useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DriverCoords, Station } from '../store/stations/stationsState';
import './ui/DriverDashboard.css';

export interface PublicStationMapMeta {
  operator: string | null;
  chargerLabel: string;
  maxKw: number | null;
  feeLabel: string | null;
  openingHours: string | null;
}

export interface MapStationItem {
  station: Station;
  distanceKm?: number;
  matchPercentage?: number;
  etaMinutes?: number;
  isPublic?: boolean;
  publicMeta?: PublicStationMapMeta;
}

interface StationsMapProps {
  stations: MapStationItem[];
  driverLocation: DriverCoords | null;
  hasActiveBooking: boolean;
  reservingId: number | null;
  selectedStationId?: number | null;
  onReserve: (station: Station, distanceKm?: number) => void;
  onOpenDetails?: (station: Station) => void;
}

const DEFAULT_CENTER: L.LatLngTuple = [32.0853, 34.7818];
const DEFAULT_ZOOM = 11;

function isValidCoords(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function getMapStationAvailability(station: Station): {
  isUnavailable: boolean;
  isFaulty: boolean;
  pinLabel: string;
  buttonText: string | null;
} {
  const status = (station.currentStatus ?? '').trim().toLowerCase();
  if (!station.isActive || status === 'faulty') {
    return {
      isUnavailable: true,
      isFaulty: true,
      pinLabel: 'תקלה',
      buttonText: !station.isActive ? 'מושבתת כרגע' : 'תקולה כרגע',
    };
  }
  if (station.isClosedBySchedule) {
    const nextOpen =
      station.nextOpenHour != null ? `${String(station.nextOpenHour).padStart(2, '0')}:00` : null;
    const text = nextOpen ? `סגורה · תיפתח ב-${nextOpen}` : 'סגורה לפי לו״ז';
    return {
      isUnavailable: true,
      isFaulty: false,
      pinLabel: 'סגורה',
      buttonText: text,
    };
  }
  if (status === 'occupied' || status === 'busy') {
    return {
      isUnavailable: true,
      isFaulty: false,
      pinLabel: 'תפוסה',
      buttonText: 'תפוסה כרגע',
    };
  }
  if (status === 'reserved') {
    return {
      isUnavailable: true,
      isFaulty: false,
      pinLabel: 'שמורה',
      buttonText: 'משוריינת כרגע',
    };
  }
  return {
    isUnavailable: false,
    isFaulty: false,
    pinLabel: `${station.maxKw}kW`,
    buttonText: null,
  };
}

function spreadOverlappingStations(items: MapStationItem[]): Array<{
  item: MapStationItem;
  lat: number;
  lng: number;
}> {
  const groups = new Map<string, MapStationItem[]>();
  const validItems: MapStationItem[] = [];

  items.forEach((item) => {
    const { latitude, longitude } = item.station;
    if (!isValidCoords(latitude, longitude)) return;
    validItems.push(item);
    const key = `${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });

  const groupIndex = new Map<string, number>();

  return validItems.map((item) => {
    const { latitude, longitude } = item.station;
    const key = `${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
    const group = groups.get(key) ?? [item];
    if (group.length <= 1) {
      return { item, lat: latitude, lng: longitude };
    }

    const idx = groupIndex.get(key) ?? 0;
    groupIndex.set(key, idx + 1);
    const angle = (2 * Math.PI * idx) / group.length;
    const radius = 0.00045;
    return {
      item,
      lat: latitude + Math.sin(angle) * radius,
      lng: longitude + Math.cos(angle) * radius,
    };
  });
}

function buildNavLink(href: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  link.style.flex = '1';
  link.style.textAlign = 'center';
  link.style.padding = '7px 10px';
  link.style.borderRadius = '8px';
  link.style.border = '1px solid #CBD5E1';
  link.style.background = '#FFFFFF';
  link.style.color = '#0F172A';
  link.style.fontWeight = '600';
  link.style.fontSize = '12px';
  link.style.textDecoration = 'none';
  link.style.fontFamily = 'Heebo, system-ui, sans-serif';
  return link;
}

export default function StationsMap({
  stations,
  driverLocation,
  hasActiveBooking,
  reservingId,
  selectedStationId = null,
  onReserve,
  onOpenDetails,
}: StationsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Map<number, L.Marker>>(new Map());
  const lastBoundsKeyRef = useRef<string>('');
  const onReserveRef = useRef(onReserve);
  const onOpenDetailsRef = useRef(onOpenDetails);

  useEffect(() => {
    onReserveRef.current = onReserve;
  }, [onReserve]);

  useEffect(() => {
    onOpenDetailsRef.current = onOpenDetails;
  }, [onOpenDetails]);

  const computeBoundsPoints = useCallback((): L.LatLngTuple[] => {
    const points: L.LatLngTuple[] = [];
    if (driverLocation && isValidCoords(driverLocation.lat, driverLocation.lng)) {
      points.push([driverLocation.lat, driverLocation.lng]);
    }
    spreadOverlappingStations(stations).forEach(({ lat, lng }) => {
      points.push([lat, lng]);
    });
    return points;
  }, [stations, driverLocation]);

  const fitMapToPoints = useCallback((points: L.LatLngTuple[], animate = false) => {
    const map = mapRef.current;
    if (!map) return;

    map.invalidateSize({ animate: false });

    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate });
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 14, { animate });
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [42, 42],
      maxZoom: 15,
      animate,
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    const primaryTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    let fallbackApplied = false;
    primaryTiles.on('tileerror', () => {
      if (fallbackApplied) return;
      fallbackApplied = true;
      map.removeLayer(primaryTiles);
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 19,
        }
      ).addTo(map);
    });

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    const invalidate = () => {
      map.invalidateSize({ animate: false });
    };

    const rafId = window.requestAnimationFrame(invalidate);
    const timerId = window.setTimeout(invalidate, 200);
    const handleWindowResize = () => invalidate();
    window.addEventListener('resize', handleWindowResize);

    const resizeObserver = new ResizeObserver(() => {
      invalidate();
    });
    resizeObserver.observe(container);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      markersByIdRef.current.clear();
      lastBoundsKeyRef.current = '';
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markersByIdRef.current.clear();

    const boundsPoints: L.LatLngTuple[] = [];

    if (driverLocation && isValidCoords(driverLocation.lat, driverLocation.lng)) {
      const driverIcon = L.divIcon({
        className: 'ev-map-pin-anchor',
        html: '<div class="ev-map-driver-pin">אני</div>',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const driverMarker = L.marker([driverLocation.lat, driverLocation.lng], {
        icon: driverIcon,
        zIndexOffset: 500,
      });
      driverMarker.bindPopup(
        '<div dir="rtl" style="font-weight:600;color:#0F172A;">המיקום שלך</div>'
      );
      driverMarker.addTo(layerGroup);
      boundsPoints.push([driverLocation.lat, driverLocation.lng]);
    }

    const spreadStations = spreadOverlappingStations(stations);

    spreadStations.forEach(({ item, lat, lng }) => {
      const { station, distanceKm, matchPercentage, etaMinutes, isPublic, publicMeta } = item;
      const isSelected = selectedStationId === station.id;
      const availability = isPublic ? null : getMapStationAvailability(station);

      let bgColor: string;
      let label: string;
      let badgeClasses = 'ev-map-pin-badge';

      if (isPublic) {
        bgColor = isSelected ? '#0F172A' : '#0284C7';
        label = 'ציבורית';
        badgeClasses += ' public-pin';
      } else if (availability?.isFaulty) {
        bgColor = '#DC2626';
        label = availability.pinLabel;
      } else if (availability?.isUnavailable) {
        bgColor = '#64748B';
        label = availability.pinLabel;
      } else {
        bgColor = isSelected ? '#0F172A' : '#EA580C';
        label = availability?.pinLabel ?? `${station.maxKw}kW`;
      }

      if (isSelected) {
        badgeClasses += ' selected';
      }

      const stationIcon = L.divIcon({
        className: 'ev-map-pin-anchor',
        html: `<div class="${badgeClasses}" style="background:${bgColor};">${label}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const popupContainer = document.createElement('div');
      popupContainer.setAttribute('dir', 'rtl');
      popupContainer.style.minWidth = '210px';
      popupContainer.style.color = '#0F172A';

      if (isPublic) {
        const publicTag = document.createElement('div');
        publicTag.textContent = 'עמדה ציבורית · ניווט בלבד';
        publicTag.style.display = 'inline-block';
        publicTag.style.marginBottom = '6px';
        publicTag.style.padding = '2px 7px';
        publicTag.style.borderRadius = '6px';
        publicTag.style.background = '#E0F2FE';
        publicTag.style.color = '#0369A1';
        publicTag.style.fontSize = '11px';
        publicTag.style.fontWeight = '700';
        popupContainer.appendChild(publicTag);
      }

      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.style.fontSize = '14px';
      title.style.marginBottom = '4px';
      title.textContent = station.name;
      popupContainer.appendChild(title);

      const addr = document.createElement('div');
      addr.style.fontSize = '12px';
      addr.style.color = '#475569';
      addr.style.marginBottom = '6px';
      addr.textContent = station.address;
      popupContainer.appendChild(addr);

      if (isPublic) {
        const parts: string[] = [];
        if (distanceKm !== undefined) parts.push(`${distanceKm} ק"מ`);
        if (publicMeta?.chargerLabel) parts.push(publicMeta.chargerLabel);
        if (publicMeta?.maxKw) parts.push(`${publicMeta.maxKw} kW`);
        if (publicMeta?.feeLabel) parts.push(publicMeta.feeLabel);
        if (publicMeta?.openingHours) parts.push(publicMeta.openingHours);

        if (parts.length > 0) {
          const details = document.createElement('div');
          details.style.fontSize = '12px';
          details.style.color = '#0F172A';
          details.style.fontWeight = '500';
          details.style.marginBottom = '10px';
          details.textContent = parts.join(' · ');
          popupContainer.appendChild(details);
        }

        const navRow = document.createElement('div');
        navRow.style.display = 'flex';
        navRow.style.gap = '6px';
        navRow.appendChild(
          buildNavLink(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, 'Waze')
        );
        navRow.appendChild(
          buildNavLink(
            `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&dir_action=navigate`,
            'Google Maps'
          )
        );
        popupContainer.appendChild(navRow);
      } else {
        const details = document.createElement('div');
        details.style.fontSize = '12px';
        details.style.color = '#0F172A';
        details.style.fontWeight = '500';
        details.style.marginBottom = '10px';
        const matchText = matchPercentage !== undefined ? `${matchPercentage}% התאמה · ` : '';
        const distText = distanceKm !== undefined ? `${distanceKm} ק"מ · ` : '';
        details.textContent = `${matchText}${distText}${station.chargerType} · ₪${station.pricePerKwh}`;
        popupContainer.appendChild(details);

        const reserveBtn = document.createElement('button');
        reserveBtn.type = 'button';
        const windowText =
          distanceKm !== undefined && etaMinutes !== undefined
            ? `שמירה ל-${etaMinutes} דק׳`
            : 'שמירה אוטומטית';
        const isDisabled = Boolean(
          availability?.isUnavailable || hasActiveBooking || reservingId === station.id
        );

        reserveBtn.textContent =
          reservingId === station.id
            ? 'משריין...'
            : availability?.isUnavailable && availability.buttonText
              ? availability.buttonText
              : hasActiveBooking
                ? 'קיימת הזמנה פעילה'
                : `שריין עמדה (${windowText})`;
        reserveBtn.disabled = isDisabled;
        reserveBtn.style.width = '100%';
        reserveBtn.style.padding = '8px 12px';
        reserveBtn.style.border = 'none';
        reserveBtn.style.borderRadius = '8px';
        reserveBtn.style.background = isDisabled ? '#94A3B8' : '#0F172A';
        reserveBtn.style.color = '#FFFFFF';
        reserveBtn.style.fontWeight = '600';
        reserveBtn.style.fontSize = '12px';
        reserveBtn.style.fontFamily = 'Heebo, system-ui, sans-serif';
        reserveBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
        if (!isDisabled) {
          reserveBtn.addEventListener('click', () => onReserveRef.current(station, distanceKm));
        }
        popupContainer.appendChild(reserveBtn);

        if (onOpenDetailsRef.current) {
          const detailsBtn = document.createElement('button');
          detailsBtn.type = 'button';
          detailsBtn.textContent = 'פרטי תחנה וביקורות';
          detailsBtn.style.width = '100%';
          detailsBtn.style.marginTop = '6px';
          detailsBtn.style.padding = '7px 12px';
          detailsBtn.style.border = '1px solid #CBD5E1';
          detailsBtn.style.borderRadius = '8px';
          detailsBtn.style.background = '#FFFFFF';
          detailsBtn.style.color = '#0F172A';
          detailsBtn.style.fontWeight = '600';
          detailsBtn.style.fontSize = '12px';
          detailsBtn.style.fontFamily = 'Heebo, system-ui, sans-serif';
          detailsBtn.style.cursor = 'pointer';
          detailsBtn.addEventListener('click', () => onOpenDetailsRef.current?.(station));
          popupContainer.appendChild(detailsBtn);
        }
      }

      const marker = L.marker([lat, lng], {
        icon: stationIcon,
        zIndexOffset: isSelected ? 400 : isPublic ? 50 : 100,
      });
      marker.bindPopup(popupContainer);
      marker.addTo(layerGroup);
      markersByIdRef.current.set(station.id, marker);
      boundsPoints.push([lat, lng]);
    });

    const boundsKey = JSON.stringify({
      driver: driverLocation,
      stations: spreadStations.map((s) => [s.item.station.id, s.lat, s.lng]),
    });

    if (boundsKey !== lastBoundsKeyRef.current) {
      lastBoundsKeyRef.current = boundsKey;
      fitMapToPoints(boundsPoints, false);
    }
  }, [stations, driverLocation, hasActiveBooking, reservingId, selectedStationId, fitMapToPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedStationId === null) return;

    const marker = markersByIdRef.current.get(selectedStationId);
    if (!marker) return;

    map.invalidateSize({ animate: false });
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.45 });
    marker.openPopup();
  }, [selectedStationId]);

  const handleRecenter = () => {
    fitMapToPoints(computeBoundsPoints(), true);
  };

  const hasPublicStations = stations.some((s) => s.isPublic);

  return (
    <div>
      <div className="ev-map-toolbar">
        <div className="ev-map-legend">
          <span className="ev-map-legend-item">
            <span className="ev-map-dot" style={{ background: '#0F172A' }} />
            המיקום שלך
          </span>
          <span className="ev-map-legend-item">
            <span className="ev-map-dot" style={{ background: '#EA580C' }} />
            {hasPublicStations ? 'עמדת האתר' : 'עמדה זמינה'}
          </span>
          {hasPublicStations && (
            <span className="ev-map-legend-item">
              <span
                className="ev-map-dot"
                style={{ background: '#0284C7', width: '8px', height: '8px' }}
              />
              עמדה ציבורית
            </span>
          )}
          <span className="ev-map-legend-item">
            <span className="ev-map-dot" style={{ background: '#DC2626' }} />
            תקלה / לא פעילה
          </span>
        </div>

        <button
          type="button"
          className="ev-btn ev-btn-secondary ev-btn-auto"
          style={{ padding: '5px 10px', fontSize: '0.78rem' }}
          onClick={handleRecenter}
        >
          מרכז מפה
        </button>
      </div>

      <div ref={containerRef} className="ev-map-canvas" />
    </div>
  );
}