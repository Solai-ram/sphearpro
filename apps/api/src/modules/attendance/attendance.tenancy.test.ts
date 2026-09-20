import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceException, ATTENDANCE_ERROR } from './attendance.errors';

describe('AttendanceService tenancy + guards', () => {
  let prisma: any;
  let audit: any;
  let svc: AttendanceService;

  beforeEach(() => {
    prisma = {
      setting: { findMany: vi.fn().mockResolvedValue([]) },
      staffAttendance: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      staffShiftAssignment: { findFirst: vi.fn().mockResolvedValue(null) },
      attendanceDevice: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      attendanceChallenge: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      user: { findFirst: vi.fn(), findMany: vi.fn() },
      clinicHoliday: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
      staffLeaveRequest: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    svc = new AttendanceService(prisma as any, audit as any);
  });

  it('getToday scopes attendance by clinicId + userId', async () => {
    prisma.staffAttendance.findUnique.mockResolvedValue(null);
    await svc.getToday('clinic_a', 'user_1');
    expect(prisma.staffAttendance.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clinicId_userId_date: expect.objectContaining({
            clinicId: 'clinic_a',
            userId: 'user_1',
          }),
        },
      }),
    );
  });

  it('revokeDevice refuses unknown device in this clinic', async () => {
    prisma.attendanceDevice.findFirst.mockResolvedValue(null);
    await expect(svc.revokeDevice('clinic_a', 'admin_1', 'dev_other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.attendanceDevice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dev_other', clinicId: 'clinic_a' } }),
    );
  });

  it('manualUpsert refuses employees from another clinic', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      svc.manualUpsert('clinic_a', 'admin_1', {
        userId: 'user_b',
        date: '2026-09-10',
        status: 'PRESENT' as any,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_b', clinicId: 'clinic_a', isSystemSupport: false } }),
    );
  });

  it('checkIn fails when attendance disabled', async () => {
    // empty settings → enabled defaults false
    await expect(
      svc.checkIn('clinic_a', 'user_1', {
        challengeId: 'ch1',
        latitude: 13,
        longitude: 80,
        deviceKey: 'abc',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({ code: ATTENDANCE_ERROR.ATTENDANCE_DISABLED }),
      }),
    });
  });

  it('listDevices always filters by clinicId', async () => {
    prisma.attendanceDevice.findMany.mockResolvedValue([]);
    await svc.listDevices('clinic_a');
    expect(prisma.attendanceDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clinicId: 'clinic_a' } }),
    );
  });

  it('registerDevice blocks second active device', async () => {
    prisma.attendanceDevice.findFirst.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      svc.registerDevice('clinic_a', 'user_1', { deviceKey: 'deadbeef' }),
    ).rejects.toBeInstanceOf(AttendanceException);
  });

  it('checkIn rejects wrong device key when binding enabled', async () => {
    prisma.setting.findMany.mockResolvedValue([
      { key: 'attendance.enabled', value: true },
      { key: 'attendance.gpsEnabled', value: false },
      { key: 'attendance.deviceBindingEnabled', value: true },
      { key: 'attendance.biometricEnabled', value: false },
    ]);
    prisma.attendanceChallenge.findFirst.mockResolvedValue({
      id: 'ch1',
      challenge: 'chal',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.attendanceChallenge.update.mockResolvedValue({});
    prisma.attendanceDevice.findFirst.mockResolvedValue(null);

    await expect(
      svc.checkIn('clinic_a', 'user_1', {
        challengeId: 'ch1',
        deviceKey: 'wrong-key',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({ code: ATTENDANCE_ERROR.DEVICE_NOT_REGISTERED }),
      }),
    });
  });

  it('checkIn rejects biometric when assertion missing', async () => {
    prisma.setting.findMany.mockResolvedValue([
      { key: 'attendance.enabled', value: true },
      { key: 'attendance.gpsEnabled', value: false },
      { key: 'attendance.deviceBindingEnabled', value: true },
      { key: 'attendance.biometricEnabled', value: true },
    ]);
    prisma.attendanceChallenge.findFirst.mockResolvedValue({
      id: 'ch1',
      challenge: 'chal',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.attendanceDevice.findFirst.mockResolvedValue({
      id: 'dev1',
      isActive: true,
      revokedAt: null,
      webauthnCredentialId: 'cred-real',
      webauthnPublicKey: 'aaa',
      webauthnCounter: 0,
    });
    prisma.attendanceDevice.update.mockResolvedValue({});

    await expect(
      svc.checkIn('clinic_a', 'user_1', {
        challengeId: 'ch1',
        deviceKey: 'abc',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({ code: ATTENDANCE_ERROR.BIOMETRIC_REQUIRED }),
      }),
    });
  });

  it('checkIn maps unique constraint to ALREADY_CHECKED_IN', async () => {
    prisma.setting.findMany.mockResolvedValue([
      { key: 'attendance.enabled', value: true },
      { key: 'attendance.gpsEnabled', value: false },
      { key: 'attendance.deviceBindingEnabled', value: false },
      { key: 'attendance.biometricEnabled', value: false },
    ]);
    prisma.attendanceChallenge.findFirst.mockResolvedValue({
      id: 'ch1',
      challenge: 'chal',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.attendanceChallenge.update.mockResolvedValue({});
    prisma.staffAttendance.findUnique.mockResolvedValue(null);
    prisma.staffShiftAssignment.findFirst.mockResolvedValue(null);
    prisma.staffAttendance.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      svc.checkIn('clinic_a', 'user_1', { challengeId: 'ch1' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({ code: ATTENDANCE_ERROR.ALREADY_CHECKED_IN }),
      }),
    });
  });

  it('markAbsentForPreviousDay skips clinics with attendance disabled', async () => {
    prisma.clinic = { findMany: vi.fn().mockResolvedValue([{ id: 'clinic_a' }]) };
    prisma.setting.findMany.mockResolvedValue([]);
    const result = await svc.markAbsentForPreviousDay();
    expect(result.clinicsProcessed).toBe(0);
    expect(result.marked).toBe(0);
  });

  it('markAbsentForPreviousDay converts open punches to HALF_DAY', async () => {
    prisma.clinic = { findMany: vi.fn().mockResolvedValue([{ id: 'clinic_a' }]) };
    prisma.setting.findMany.mockResolvedValue([{ key: 'attendance.enabled', value: true }]);
    prisma.user.findMany.mockResolvedValue([{ id: 'user_1' }, { id: 'user_2' }]);
    prisma.staffAttendance.findMany.mockResolvedValue([
      {
        id: 'att_open',
        userId: 'user_1',
        checkIn: new Date('2026-09-09T03:30:00.000Z'),
        checkOut: null,
        status: 'PRESENT',
        source: 'SELF',
        remarks: null,
      },
    ]);
    prisma.staffAttendance.update = vi.fn().mockResolvedValue({});
    prisma.staffAttendance.create = vi.fn().mockResolvedValue({});

    const result = await svc.markAbsentForPreviousDay();
    expect(result.halfDay).toBe(1);
    expect(prisma.staffAttendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'att_open' },
        data: expect.objectContaining({ status: 'HALF_DAY' }),
      }),
    );
    // user_2 had no row → ABSENT create
    expect(prisma.staffAttendance.create).toHaveBeenCalled();
    expect(result.marked).toBeGreaterThanOrEqual(1);
  });

  it('blocks punch on clinic holiday', async () => {
    prisma.clinicHoliday.findFirst.mockResolvedValue({ id: 'h1', name: 'Diwali' });
    await expect((svc as any).assertPunchAllowed('clinic_a', 'user_1', '2026-09-10')).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({ code: ATTENDANCE_ERROR.CLINIC_HOLIDAY }),
      }),
    });
  });

  it('blocks punch when status is ON_LEAVE', async () => {
    prisma.clinicHoliday.findFirst.mockResolvedValue(null);
    prisma.staffAttendance.findUnique.mockResolvedValue({ status: 'ON_LEAVE' });
    await expect((svc as any).assertPunchAllowed('clinic_a', 'user_1', '2026-09-10')).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({ code: ATTENDANCE_ERROR.ON_LEAVE }),
      }),
    });
  });

  it('approve leave writes ON_LEAVE attendance rows', async () => {
    prisma.staffLeaveRequest.findFirst.mockResolvedValue({
      id: 'lv1',
      clinicId: 'clinic_a',
      userId: 'user_1',
      startDate: new Date('2026-09-10T00:00:00.000Z'),
      endDate: new Date('2026-09-11T00:00:00.000Z'),
      reason: 'Personal',
      status: 'PENDING',
    });
    prisma.staffLeaveRequest.update.mockResolvedValue({ id: 'lv1', status: 'APPROVED' });
    prisma.staffAttendance.findUnique.mockResolvedValue(null);
    prisma.staffAttendance.create.mockResolvedValue({});

    await svc.reviewLeave('clinic_a', 'admin_1', 'lv1', 'APPROVED');

    expect(prisma.staffAttendance.create).toHaveBeenCalledTimes(2);
    expect(prisma.staffAttendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinicId: 'clinic_a',
          userId: 'user_1',
          status: 'ON_LEAVE',
        }),
      }),
    );
  });

  it('createHoliday marks staff without check-in as HOLIDAY', async () => {
    prisma.clinicHoliday.upsert.mockResolvedValue({ id: 'h1', name: 'Republic Day' });
    prisma.user.findMany.mockResolvedValue([{ id: 'user_1' }]);
    prisma.staffAttendance.findUnique.mockResolvedValue(null);
    prisma.staffAttendance.create.mockResolvedValue({});

    await svc.createHoliday('clinic_a', 'admin_1', { date: '2026-01-26', name: 'Republic Day' });

    expect(prisma.staffAttendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'HOLIDAY', source: 'SYSTEM' }),
      }),
    );
  });
});
