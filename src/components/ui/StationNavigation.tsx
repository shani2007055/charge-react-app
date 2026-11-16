import { Navigation } from 'lucide-react';
import './DriverDashboard.css';

interface StationNavigationProps {
  latitude?: number;
  longitude?: number;
  address?: string;
}

export default function StationNavigation({
  latitude,
  longitude,
  address,
}: StationNavigationProps) {
  const hasValidCoordinates =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0);

  const trimmedAddress = address?.trim() ?? '';

  if (!hasValidCoordinates && !trimmedAddress) {
    return null;
  }

  const coordinates = hasValidCoordinates ? `${latitude},${longitude}` : '';
  const encodedAddress = encodeURIComponent(trimmedAddress);

  const wazeUrl = hasValidCoordinates
    ? `https://waze.com/ul?ll=${coordinates}&navigate=yes`
    : `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;

  const googleMapsUrl = hasValidCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${coordinates}&dir_action=navigate`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&dir_action=navigate`;

  return (
    <div className="station-navigation">
      <a
        href={wazeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="station-nav-link"
      >
        <Navigation size={17} />
        Waze
      </a>
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="station-nav-link"
      >
        <Navigation size={17} />
        Google Maps
      </a>
    </div>
  );
}