import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DriverCoords, Station } from '../store/stations/stationsState';

export interface MapStationItem {
  station: Station;
  distanceKm?: number;
  matchPercentage?: number;
}

interface StationsMapProps {
  stations: MapStationItem[];
  driverLocation: DriverCoords | null;
  hasActiveBooking: boolean;
  reservingId: number | null;
  onReserve: (station: Station) => void;
}

export default function StationsMap({
  stations,
  driverLocation,
  hasActiveBooking,
  reservingId,
  onReserve,
}: StationsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [32.0853, 34.7818],
      zoom: 11,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    const boundsPoints: L.LatLngExpression[] = [];

    if (driverLocation) {
      const driverIcon = L.divIcon({
        className: '',
        html: '<div style="width:28px;height:28px;border-radius:9999px;background:#0F172A;border:3px solid #FFFFFF;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:11px;font-weight:700;box-shadow:0 4px 12px rgba(15,23,42,0.28);font-family:Heebo,sans-serif;">אני</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const driverMarker = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon });
      driverMarker.bindPopup(
        '<div dir="rtl" style="font-weight:600;color:#0F172A;font-family:Heebo,sans-serif;">המיקום שלך</div>'
      );
      driverMarker.addTo(layerGroup);
      boundsPoints.push([driverLocation.lat, driverLocation.lng]);
    }

    stations.forEach((item) => {
      const { station, distanceKm, matchPercentage } = item;
      const isFaulty = !station.isActive || station.currentStatus === 'Faulty';
      const bgColor = isFaulty ? '#DC2626' : '#EA580C';

      const stationIcon = L.divIcon({
        className: '',
        html: `<div style="padding:4px 8px;border-radius:8px;background:${bgColor};border:2px solid #FFFFFF;color:#FFFFFF;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(15,23,42,0.22);font-family:Heebo,sans-serif;">${
          isFaulty ? 'תקלה' : `${station.maxKw}kW`
        }</div>`,
        iconSize: [52, 26],
        iconAnchor: [26, 13],
      });

      const popupContainer = document.createElement('div');
      popupContainer.setAttribute('dir', 'rtl');
      popupContainer.style.minWidth = '200px';
      popupContainer.style.fontFamily = 'Heebo, system-ui, sans-serif';
      popupContainer.style.color = '#0F172A';

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

      const details = document.createElement('div');
      details.style.fontSize = '12px';
      details.style.color = '#0F172A';
      details.style.fontWeight = '500';
      details.style.marginBottom = '10px';
      const matchText = matchPercentage !== undefined ? `${matchPercentage}% התאמה · ` : '';
      const distText = distanceKm !== undefined ? `${distanceKm} ק"מ · ` : '';
      details.textContent = `${matchText}${distText}${station.chargerType} · ₪${station.pricePerKwh}`;
      popupContainer.appendChild(details);

      if (!isFaulty) {
        const reserveBtn = document.createElement('button');
        reserveBtn.type = 'button';
        reserveBtn.textContent =
          reservingId === station.id
            ? 'משריין...'
            : hasActiveBooking
              ? 'קיימת הזמנה פעילה'
              : 'שריין עמדה (15 דק׳)';
        reserveBtn.disabled = hasActiveBooking || reservingId === station.id;
        reserveBtn.style.width = '100%';
        reserveBtn.style.padding = '7px 12px';
        reserveBtn.style.border = 'none';
        reserveBtn.style.borderRadius = '8px';
        reserveBtn.style.background = hasActiveBooking ? '#94A3B8' : '#0F172A';
        reserveBtn.style.color = '#FFFFFF';
        reserveBtn.style.fontWeight = '600';
        reserveBtn.style.fontSize = '12px';
        reserveBtn.style.cursor = hasActiveBooking ? 'not-allowed' : 'pointer';
        reserveBtn.addEventListener('click', () => onReserve(station));
        popupContainer.appendChild(reserveBtn);
      }

      const marker = L.marker([station.latitude, station.longitude], { icon: stationIcon });
      marker.bindPopup(popupContainer);
      marker.addTo(layerGroup);
      boundsPoints.push([station.latitude, station.longitude]);
    });

    if (boundsPoints.length > 0) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [36, 36], maxZoom: 13 });
    }
  }, [stations, driverLocation, hasActiveBooking, reservingId, onReserve]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '440px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--ev-border)',
      }}
    />
  );
}