import { useCallback, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setDriverLocation } from '../store/stations/stationsSlice';
import type { DriverCoords } from '../store/stations/stationsState';

interface RequestLocationOptions {
  silent?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}

export function useDriverGps() {
  const dispatch = useAppDispatch();
  const driverLocation = useAppSelector((state) => state.stations.driverLocation);

  const [detectingGps, setDetectingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsDenied, setGpsDenied] = useState<boolean>(false);

  const updateLocation = useCallback(
    (coords: DriverCoords) => {
      dispatch(setDriverLocation(coords));
      setGpsDenied(false);
      setGpsError(null);
    },
    [dispatch]
  );

  const requestLocation = useCallback(
    (options?: RequestLocationOptions): Promise<DriverCoords | null> => {
      const silent = options?.silent ?? false;
      const timeoutMs = options?.timeoutMs ?? 10000;
      const maximumAgeMs = options?.maximumAgeMs ?? 15000;

      if (!('geolocation' in navigator)) {
        setGpsDenied(true);
        if (!silent) {
          setGpsError('הדפדפן אינו תומך בזיהוי מיקום אוטומטי.');
        }
        return Promise.resolve(null);
      }

      setDetectingGps(true);
      if (!silent) {
        setGpsError(null);
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords: DriverCoords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            dispatch(setDriverLocation(coords));
            setGpsDenied(false);
            setGpsError(null);
            setDetectingGps(false);
            resolve(coords);
          },
          () => {
            setGpsDenied(true);
            setDetectingGps(false);
            if (!silent) {
              setGpsError('לא ניתן היה לקרוא את מיקום ה-GPS (יש לאשר הרשאת מיקום בדפדפן).');
            }
            resolve(null);
          },
          {
            enableHighAccuracy: true,
            timeout: timeoutMs,
            maximumAge: maximumAgeMs,
          }
        );
      });
    },
    [dispatch]
  );

  return {
    driverLocation,
    detectingGps,
    gpsError,
    gpsDenied,
    requestLocation,
    updateLocation,
    setGpsDenied,
  };
}