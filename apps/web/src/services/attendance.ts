import { fetchApi, getAccessToken, API_BASE } from '../lib/api';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser';

const DEVICE_KEY_STORAGE = 'sphear.attendance.deviceKey';

export function getOrCreateDeviceKey(): string {
  let key = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!key) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_KEY_STORAGE, key);
  }
  return key;
}

export async function requestGps(): Promise<{ latitude: number; longitude: number; accuracy?: number }> {
  if (!navigator.geolocation) {
    throw new Error('Location is not supported on this device.');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission required.'));
        } else {
          reject(new Error('Unable to read GPS. Try again outdoors.'));
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

export async function enrollWithServerOptions(
  options: PublicKeyCredentialCreationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  try {
    return await startRegistration({ optionsJSON: options });
  } catch {
    throw new Error('Biometric enrollment was cancelled or failed.');
  }
}

export async function assertWithServerOptions(
  options: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResponseJSON> {
  try {
    return await startAuthentication({ optionsJSON: options });
  } catch {
    throw new Error('Biometric verification was cancelled or failed.');
  }
}

export const attendanceApi = {
  today() {
    return fetchApi<any>('/attendance/today');
  },
  challenge() {
    return fetchApi<{ challengeId: string; challenge: string; expiresAt: string }>('/attendance/challenge', {
      method: 'POST',
      body: '{}',
    });
  },
  webauthnRegistrationOptions() {
    return fetchApi<{
      challengeId: string;
      options: PublicKeyCredentialCreationOptionsJSON;
      expiresAt: string;
    }>('/attendance/webauthn/registration-options', { method: 'POST', body: '{}' });
  },
  webauthnAuthenticationOptions(deviceKey: string) {
    return fetchApi<{
      challengeId: string;
      options?: PublicKeyCredentialRequestOptionsJSON;
      challenge?: string;
      expiresAt: string;
    }>('/attendance/webauthn/authentication-options', {
      method: 'POST',
      body: JSON.stringify({ deviceKey }),
    });
  },
  checkIn(body: Record<string, unknown>) {
    return fetchApi('/attendance/check-in', { method: 'POST', body: JSON.stringify(body) });
  },
  checkOut(body: Record<string, unknown>) {
    return fetchApi('/attendance/check-out', { method: 'POST', body: JSON.stringify(body) });
  },
  history(year?: number, month?: number) {
    const q = new URLSearchParams();
    if (year) q.set('year', String(year));
    if (month) q.set('month', String(month));
    return fetchApi<{ year: number; month: number; data: any[] }>(`/attendance/me/history?${q}`);
  },
  myDevice() {
    return fetchApi<{ registered: boolean; device?: any }>('/attendance/me/device');
  },
  registerDevice(body: Record<string, unknown>) {
    return fetchApi('/attendance/devices/register', { method: 'POST', body: JSON.stringify(body) });
  },
  dashboard(date?: string) {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchApi<any>(`/attendance/dashboard${q}`);
  },
  list(params?: { date?: string; search?: string; status?: string }) {
    const q = new URLSearchParams();
    if (params?.date) q.set('date', params.date);
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    return fetchApi<any>(`/attendance?${q}`);
  },
  getSettings() {
    return fetchApi<any>('/attendance/settings');
  },
  updateSettings(body: Record<string, unknown>) {
    return fetchApi('/attendance/settings', { method: 'PATCH', body: JSON.stringify(body) });
  },
  listDevices() {
    return fetchApi<any[]>('/attendance/devices');
  },
  revokeDevice(id: string) {
    return fetchApi(`/attendance/devices/${id}`, { method: 'DELETE' });
  },
  listShifts() {
    return fetchApi<any[]>('/attendance/shifts');
  },
  listShiftAssignments() {
    return fetchApi<any[]>('/attendance/shifts/assignments');
  },
  createShift(body: { name: string; startTime: string; endTime: string; graceMinutes?: number }) {
    return fetchApi('/attendance/shifts', { method: 'POST', body: JSON.stringify(body) });
  },
  assignShift(body: { userId: string; shiftId: string }) {
    return fetchApi('/attendance/shifts/assign', { method: 'POST', body: JSON.stringify(body) });
  },
  manual(body: Record<string, unknown>) {
    return fetchApi('/attendance/manual', { method: 'POST', body: JSON.stringify(body) });
  },
  monthlyReport(year: number, month: number) {
    return fetchApi<any>(`/attendance/reports/monthly?year=${year}&month=${month}`);
  },
  async downloadMonthlyCsv(year: number, month: number) {
    const token = getAccessToken();
    const response = await fetch(
      `${API_BASE}/attendance/reports/monthly.csv?year=${year}&month=${month}`,
      {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
  listHolidays(year?: number) {
    const q = year ? `?year=${year}` : '';
    return fetchApi<any[]>(`/attendance/holidays${q}`);
  },
  createHoliday(body: { date: string; name: string }) {
    return fetchApi('/attendance/holidays', { method: 'POST', body: JSON.stringify(body) });
  },
  deleteHoliday(id: string) {
    return fetchApi(`/attendance/holidays/${id}`, { method: 'DELETE' });
  },
  requestLeave(body: { startDate: string; endDate: string; reason?: string }) {
    return fetchApi('/attendance/leave', { method: 'POST', body: JSON.stringify(body) });
  },
  myLeave() {
    return fetchApi<any[]>('/attendance/leave/me');
  },
  listLeave(status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchApi<any[]>(`/attendance/leave${q}`);
  },
  reviewLeave(id: string, body: { decision: 'APPROVED' | 'REJECTED'; reviewNote?: string }) {
    return fetchApi(`/attendance/leave/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  cancelLeave(id: string) {
    return fetchApi(`/attendance/leave/${id}/cancel`, { method: 'POST', body: '{}' });
  },
};
