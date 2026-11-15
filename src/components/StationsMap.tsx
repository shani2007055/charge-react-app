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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
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
        html: '<div style="width:32px;height:32px;border-radius:50%;background:#2563eb;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.5);">🚗</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const driverMarker = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon });
      driverMarker.bindPopup('<div dir="rtl" style="font-weight:bold;">📍 המיקום שלך</div>');
      driverMarker.addTo(layerGroup);
      boundsPoints.push([driverLocation.lat, driverLocation.lng]);
    }

    stations.forEach((item) => {
      const { station, distanceKm, matchPercentage } = item;
      const isFaulty = !station.isActive || station.currentStatus === 'Faulty';
      const bgColor = isFaulty ? '#dc2626' : '#16a34a';
      const symbol = isFaulty ? '⚠️' : '⚡';

      const stationIcon = L.divIcon({
        className: '',
        html: `<div style="width:34px;height:34px;border-radius:50%;background:${bgColor};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.5);">${symbol}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const popupContainer = document.createElement('div');
      popupContainer.setAttribute('dir', 'rtl');
      popupContainer.style.minWidth = '190px';
      popupContainer.style.fontFamily = 'inherit';

      const title = document.createElement('div');
      title.style.fontWeight = 'bold';
      title.style.fontSize = '14px';
      title.style.marginBottom = '4px';
      title.textContent = station.name;
      popupContainer.appendChild(title);

      const addr = document.createElement('div');
      addr.style.fontSize = '12px';
      addr.style.color = '#475569';
      addr.style.marginBottom = '6px';
      addr.textContent = `📍 ${station.address}`;
      popupContainer.appendChild(addr);

      const details = document.createElement('div');
      details.style.fontSize = '12px';
      details.style.marginBottom = '8px';
      const matchText = matchPercentage !== undefined ? `🎯 ${matchPercentage}% התאמה | ` : '';
      const distText = distanceKm !== undefined ? `📏 ${distanceKm} ק"מ | ` : '';
      details.textContent = `${matchText}${distText}🔌 ${station.chargerType} • ₪${station.pricePerKwh}`;
      popupContainer.appendChild(details);

      if (!isFaulty) {
        const reserveBtn = document.createElement('button');
        reserveBtn.type = 'button';
        reserveBtn.textContent =
          reservingId === station.id
            ? 'משריין...'
            : hasActiveBooking
              ? 'קיימת הזמנה פעילה'
              : '⚡ שריין עמדה זו';
        reserveBtn.disabled = hasActiveBooking || reservingId === station.id;
        reserveBtn.style.width = '100%';
        reserveBtn.style.padding = '6px 10px';
        reserveBtn.style.border = 'none';
        reserveBtn.style.borderRadius = '6px';
        reserveBtn.style.background = hasActiveBooking ? '#64748b' : '#16a34a';
        reserveBtn.style.color = 'white';
        reserveBtn.style.fontWeight = 'bold';
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
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40], maxZoom: 14 });
    }
  }, [stations, driverLocation, hasActiveBooking, reservingId, onReserve]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '340px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #334155',
        marginBottom: '16px',
      }}
    />
  );
}