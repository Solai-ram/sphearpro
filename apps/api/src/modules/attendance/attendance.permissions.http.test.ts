import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { createHttpApp, defaultTestUser, http } from '../../test/http-app';

describe('AttendanceController (HTTP)', () => {
  const attendanceService = {
    getToday: vi.fn().mockResolvedValue({ date: '2026-09-10', attendance: null }),
    createChallenge: vi.fn().mockResolvedValue({ challengeId: 'ch1', challenge: 'abc' }),
    checkIn: vi.fn().mockResolvedValue({ id: 'att1', status: 'PRESENT' }),
    checkOut: vi.fn().mockResolvedValue({ id: 'att1' }),
    dashboard: vi.fn().mockResolvedValue({ counts: {} }),
    listForClinic: vi.fn().mockResolvedValue({ data: [] }),
    monthlyReport: vi.fn().mockResolvedValue({ year: 2026, month: 9, data: [] }),
    monthlyReportCsv: vi.fn().mockResolvedValue('Employee,Present\n'),
    getSettings: vi.fn().mockResolvedValue({ enabled: false }),
    updateSettings: vi.fn().mockResolvedValue({ enabled: true }),
    myHistory: vi.fn().mockResolvedValue({ data: [] }),
    myDeviceStatus: vi.fn().mockResolvedValue({ registered: false }),
    registerDevice: vi.fn().mockResolvedValue({ id: 'd1' }),
    listDevices: vi.fn().mockResolvedValue([]),
    revokeDevice: vi.fn().mockResolvedValue({ id: 'd1' }),
    listShifts: vi.fn().mockResolvedValue([]),
    listShiftAssignments: vi.fn().mockResolvedValue([]),
    createShift: vi.fn().mockResolvedValue({ id: 's1' }),
    assignShift: vi.fn().mockResolvedValue({ id: 'a1' }),
    manualUpsert: vi.fn().mockResolvedValue({ id: 'att1' }),
    webauthnRegistrationOptions: vi.fn().mockResolvedValue({ challengeId: 'ch1', options: {} }),
    webauthnAuthenticationOptions: vi.fn().mockResolvedValue({ challengeId: 'ch1', options: {} }),
    listHolidays: vi.fn().mockResolvedValue([]),
    createHoliday: vi.fn().mockResolvedValue({ id: 'h1' }),
    deleteHoliday: vi.fn().mockResolvedValue({ id: 'h1' }),
    requestLeave: vi.fn().mockResolvedValue({ id: 'lv1' }),
    myLeaveRequests: vi.fn().mockResolvedValue([]),
    listLeaveRequests: vi.fn().mockResolvedValue([]),
    reviewLeave: vi.fn().mockResolvedValue({ id: 'lv1', status: 'APPROVED' }),
    cancelMyLeave: vi.fn().mockResolvedValue({ id: 'lv1', status: 'CANCELLED' }),
  };

  let app: INestApplication;

  beforeAll(async () => {
    app = await createHttpApp({
      controllers: [AttendanceController],
      providers: [{ provide: AttendanceService, useValue: attendanceService }],
      user: {
        ...defaultTestUser,
        permissions: [
          'attendance.view_own',
          'attendance.check_in',
          'attendance.check_out',
          'attendance.view_all',
          'attendance.reports',
          'attendance.correct',
          'attendance.manage_settings',
          'attendance.manage_devices',
          'attendance.request_leave',
          'attendance.approve_leave',
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /attendance/today uses auth clinic + user', async () => {
    const res = await http(app).get('/attendance/today');
    expect(res.status).toBe(200);
    expect(attendanceService.getToday).toHaveBeenCalledWith('clinic_a', 'user_admin_1');
  });

  it('POST /attendance/check-in ignores client employeeId and clinicId', async () => {
    attendanceService.checkIn.mockClear();
    const res = await http(app)
      .post('/attendance/check-in')
      .send({
        challengeId: 'ch1',
        deviceKey: 'key',
        latitude: 13.0,
        longitude: 80.0,
        employeeId: 'victim_user',
        clinicId: 'other_clinic',
      });
    expect(res.status).toBe(201);
    expect(attendanceService.checkIn).toHaveBeenCalledWith(
      'clinic_a',
      'user_admin_1',
      expect.not.objectContaining({ employeeId: expect.anything(), clinicId: expect.anything() }),
    );
    const body = attendanceService.checkIn.mock.calls[0][2];
    expect(body.employeeId).toBeUndefined();
    expect(body.clinicId).toBeUndefined();
    expect(body.challengeId).toBe('ch1');
  });

  it('GET /attendance/dashboard scopes to clinic', async () => {
    const res = await http(app).get('/attendance/dashboard?date=2026-09-10');
    expect(res.status).toBe(200);
    expect(attendanceService.dashboard).toHaveBeenCalledWith('clinic_a', '2026-09-10');
  });
});

describe('AttendanceController RBAC', () => {
  it('returns 403 for dashboard without attendance.view_all', async () => {
    let app: INestApplication | undefined;
    try {
      app = await createHttpApp({
        controllers: [AttendanceController],
        providers: [
          {
            provide: AttendanceService,
            useValue: { dashboard: vi.fn() },
          },
        ],
        user: {
          ...defaultTestUser,
          roles: ['DOCTOR'],
          permissions: ['attendance.view_own', 'attendance.check_in'],
        },
        enforcePermissions: true,
      });
      const res = await http(app).get('/attendance/dashboard');
      expect(res.status).toBe(403);
    } finally {
      await app?.close();
    }
  });

  it('returns 403 for manual correct without attendance.correct', async () => {
    let app: INestApplication | undefined;
    try {
      app = await createHttpApp({
        controllers: [AttendanceController],
        providers: [{ provide: AttendanceService, useValue: { manualUpsert: vi.fn() } }],
        user: {
          ...defaultTestUser,
          roles: ['RECEPTIONIST'],
          permissions: ['attendance.view_own', 'attendance.check_in', 'attendance.check_out'],
        },
        enforcePermissions: true,
      });
      const res = await http(app).post('/attendance/manual').send({
        userId: 'u1',
        date: '2026-09-10',
        status: 'PRESENT',
        remarks: 'fix',
      });
      expect(res.status).toBe(403);
    } finally {
      await app?.close();
    }
  });

  it('returns 403 for leave review without attendance.approve_leave', async () => {
    let app: INestApplication | undefined;
    try {
      app = await createHttpApp({
        controllers: [AttendanceController],
        providers: [{ provide: AttendanceService, useValue: { reviewLeave: vi.fn() } }],
        user: {
          ...defaultTestUser,
          roles: ['DOCTOR'],
          permissions: ['attendance.view_own', 'attendance.request_leave'],
        },
        enforcePermissions: true,
      });
      const res = await http(app).post('/attendance/leave/lv1/review').send({ decision: 'APPROVED' });
      expect(res.status).toBe(403);
    } finally {
      await app?.close();
    }
  });
});
