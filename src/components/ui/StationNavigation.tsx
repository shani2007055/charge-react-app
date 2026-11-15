import { Navigation } from 'lucide-react';
import './DriverDashboard.css';

interface StationNavigationProps {
  latitude: number;
  longitude: number;
}

export default function StationNavigation({
  latitude,
  longitude
}: StationNavigationProps) {

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  const coordinates = `${latitude},${longitude}`;

  const wazeUrl =
    `https://waze.com/ul?ll=${coordinates}&navigate=yes`;

  const googleMapsUrl =
    `https://www.google.com/maps/dir/?api=1&destination=${coordinates}`;

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