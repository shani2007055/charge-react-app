export interface Station {
  id: number;
  ownerId: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  chargerType: string;
  maxKw: number;
  pricePerKwh: number;
  isActive: boolean;
  averageRating: number | null;
  reviewsCount: number;
  currentStatus: string | null;
}

export interface RankedStationResult {
  station: Station;
  distanceKm: number;
  matchPercentage: number;
  matchReason: string;
  isEmergencyMode: boolean;
}

export interface StationsState {
  items: Station[];
  recommendations: RankedStationResult[];
  hasSearched: boolean;
  currentBatteryPercent: number;
  targetBatteryPercent: number;
  loading: boolean;
  error: string | null;
}

export const initialState: StationsState = {
  items: [],
  recommendations: [],
  hasSearched: false,
  currentBatteryPercent: 50,
  targetBatteryPercent: 80,
  loading: false,
  error: null,
};