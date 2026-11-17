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

  // === שדות מצב מסלול (מגיעים רק מ-recommend-route, אחרת null/חסרים) ===
  detourKm?: number | null;                    // כמה ק"מ העצירה מוסיפה
  chargeKwh?: number | null;                   // מינימום קוט"ש לטעינה כדי להגיע ליעד
  chargeCost?: number | null;                  // עלות הטעינה המינימלית ב-₪
  chargeMinutes?: number | null;               // זמן הטעינה בדקות
  extraMinutes?: number | null;                // עקיפה + טעינה
  arrivalPercentAtDestination?: number | null; // אחוז סוללה בהגעה ליעד
}

// תשובת השרת במצב מסלול (POST /ChargingStations/recommend-route)
export interface RouteRecommendationResponse {
  noChargeNeeded: boolean;                     // true = הסוללה מספיקה עד היעד
  tripKm: number;
  rangeKm: number;
  arrivalPercentAtDestination: number | null;  // רק כשאין צורך בטעינה
  message: string;
  stations: RankedStationResult[];
}

// יעד שהנהג הזין (כתובת + קואורדינטות מ-Nominatim)
export interface DestinationPoint {
  lat: number;
  lng: number;
  label: string;
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
  destination: DestinationPoint | null;              // null = מצב רדיוס (בלי יעד)
  routeResult: RouteRecommendationResponse | null;   // null = החיפוש האחרון לא היה במצב מסלול
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
  destination: null,
  routeResult: null,
  loading: false,
  error: null,
};