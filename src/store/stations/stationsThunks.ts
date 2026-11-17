import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../../api/apiClient';
import type { RankedStationResult, RouteRecommendationResponse, Station } from './stationsState';

export interface DriverPreferenceRequest {
  driverLatitude: number;
  driverLongitude: number;
  batteryPercentage: number;
  availableTimeMinutes: number;
  requiredChargerType?: string | null;
  minRating?: number | null;
  weightDistance: number;
  weightRating: number;
  weightPrice: number;
  weightSpeed: number;

  // === מצב מסלול (אופציונלי) ===
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  batteryCapacityKwh?: number | null;   // קיבולת הסוללה של הרכב שנבחר (ברירת מחדל בשרת: 60)
}

export const fetchStations = createAsyncThunk<Station[]>(
  'stations/fetchStations',
  async () => {
    return await apiFetch<Station[]>('/ChargingStations');
  }
);

export const recommendStations = createAsyncThunk<RankedStationResult[], DriverPreferenceRequest>(
  'stations/recommendStations',
  async (preferences) => {
    return await apiFetch<RankedStationResult[]>('/ChargingStations/recommend', {
      method: 'POST',
      body: JSON.stringify(preferences),
    });
  }
);

// מצב מסלול: איפה הכי משתלם לעצור בדרך מהמוצא ליעד
export const recommendRoute = createAsyncThunk<RouteRecommendationResponse, DriverPreferenceRequest>(
  'stations/recommendRoute',
  async (preferences) => {
    return await apiFetch<RouteRecommendationResponse>('/ChargingStations/recommend-route', {
      method: 'POST',
      body: JSON.stringify(preferences),
    });
  }
);