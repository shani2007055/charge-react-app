
import type { Station } from '../../store/stations/stationsState';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  access: string;
  driverId: number | null;
  ownerId: number | null;
}

export interface AdminVehicle {
  id: number;
  driverId: number;
  model: string;
  batteryCapacityKwh: number;
  currentBattery: number;
  supportedChargerType: string;
}

export interface AdminDriver {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  totalBookings: number;
  vehicles: AdminVehicle[];
}

export interface AdminOwner {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  stationsCount: number;
}

export interface AdminBooking {
  id: number;
  stationId: number;
  stationName: string;
  stationAddress: string;
  driverId: number;
  vehicleId: number;
  vehicleModel: string;
  status: string;
  currentBatteryPercent: number;
  targetBatteryPercent: number;
  estimatedArrivalTime: string;
  createdAt: string;
  hasReview: boolean;
}

export interface AdminReview {
  id: number;
  chargeBookingId: number;
  stationId: number;
  stationName: string;
  driverId: number;
  driverName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface AdminStatusLog {
  id: number;
  stationId: number;
  stationName: string;
  status: string;
  currentDriverId: number | null;
  currentDriverName: string | null;
  updatedAt: string;
}

export interface AdminData {
  users: AdminUser[];
  drivers: AdminDriver[];
  owners: AdminOwner[];
  stations: Station[];
  vehicles: AdminVehicle[];
  bookings: AdminBooking[];
  reviews: AdminReview[];
  logs: AdminStatusLog[];
}

export type AdminSection = keyof AdminData;

export type AdminPage =
  | 'overview'
  | AdminSection;

export const emptyAdminData: AdminData = {
  users: [],
  drivers: [],
  owners: [],
  stations: [],
  vehicles: [],
  bookings: [],
  reviews: [],
  logs: []
};
