import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../../api/apiClient';
import type { RankedStationResult, Station } from './stationsState';

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