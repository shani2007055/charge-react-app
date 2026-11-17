import { apiFetch } from '../../api/apiClient';
import type { Station } from '../../store/stations/stationsState';
import {
  emptyAdminData,
  type AdminData,
  type AdminUser,
  type AdminDriver,
  type AdminOwner,
  type AdminVehicle,
  type AdminBooking,
  type AdminReview,
  type AdminStatusLog,
  type AdminSection,
} from './adminTypes';

export interface AdminLoadResult {
  data: AdminData;
  errors: Partial<Record<AdminSection, string>>;
}

export interface StationApprovalPayload {
  approvalStatus: 'Approved' | 'Rejected';
  rejectionReason?: string | null;
}

export async function fetchAdminData(
  signal?: AbortSignal
): Promise<AdminLoadResult> {
  const data: AdminData = {
    ...emptyAdminData,
  };
  const errors: Partial<Record<AdminSection, string>> = {};

  async function load<K extends AdminSection>(
    key: K,
    request: Promise<AdminData[K]>
  ) {
    try {
      const result = await request;
      if (!Array.isArray(result)) {
        throw new Error('מבנה נתונים לא תקין');
      }
      data[key] = result;
    } catch (error) {
      if (signal?.aborted) return;
      errors[key] =
        error instanceof Error
          ? error.message
          : 'טעינת הנתונים נכשלה';
    }
  }

  await Promise.all([
    load('users', apiFetch<AdminUser[]>('/Users', { signal })),
    load('drivers', apiFetch<AdminDriver[]>('/Drivers', { signal })),
    load('owners', apiFetch<AdminOwner[]>('/Owner', { signal })),
    load('stations', apiFetch<Station[]>('/ChargingStations/admin/all', { signal })),
    load('vehicles', apiFetch<AdminVehicle[]>('/UsersVehicles', { signal })),
    load('bookings', apiFetch<AdminBooking[]>('/ChargeBooking', { signal })),
    load('reviews', apiFetch<AdminReview[]>('/ReviewsToCharge', { signal })),
    load('logs', apiFetch<AdminStatusLog[]>('/StationStatusLogs', { signal })),
  ]);

  return { data, errors };
}

export async function reviewAdminStation(
  stationId: number,
  payload: StationApprovalPayload
): Promise<Station> {
  return apiFetch<Station>(`/ChargingStations/${stationId}/approval`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminUser(userId: number): Promise<void> {
  await apiFetch(`/Users/${userId}`, { method: 'DELETE' });
}

export async function deleteAdminDriver(driverId: number): Promise<void> {
  await apiFetch(`/Drivers/${driverId}`, { method: 'DELETE' });
}

export async function deleteAdminOwner(ownerId: number): Promise<void> {
  await apiFetch(`/Owner/${ownerId}`, { method: 'DELETE' });
}

export async function deleteAdminReview(reviewId: number): Promise<void> {
  await apiFetch(`/ReviewsToCharge/${reviewId}`, { method: 'DELETE' });
}

export async function deleteAdminStatusLog(logId: number): Promise<void> {
  await apiFetch(`/StationStatusLogs/${logId}`, { method: 'DELETE' });
}