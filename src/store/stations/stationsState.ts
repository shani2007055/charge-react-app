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
  blockedHours?: number[];
  isClosedBySchedule?: boolean;
  nextOpenHour?: number | null;
  averageRating: number | null;
  reviewsCount: number;
  currentStatus: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string | null;
}

export interface RankedStationResult {
  station: Station;
  distanceKm: number;
  matchPercentage: number;
  matchReason: string;
  isEmergencyMode: boolean;
}

export interface DriverCoords {
  lat: number;
  lng: number;
}

export interface StationsState {
  selectedVehicleId: number | null;
  items: Station[];
  recommendations: RankedStationResult[];
  hasSearched: boolean;
  currentBatteryPercent: number;
  targetBatteryPercent: number;
  driverLocation: DriverCoords | null;
  loading: boolean;
  error: string | null;
}

export const initialState: StationsState = {
  selectedVehicleId: null,
  items: [],
  recommendations: [],
  hasSearched: false,
  currentBatteryPercent: 50,
  targetBatteryPercent: 80,
  driverLocation: null,
  loading: false,
  error: null,
};