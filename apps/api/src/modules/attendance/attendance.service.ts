import { Injectable, Inject, NotFoundException, BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { StaffAttendanceStatus, StaffLeaveStatus } from '@prisma/client';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { AuditService } from '../audit/audit.service';
import { ATTENDANCE_ERROR, AttendanceException } from './attendance.errors';
import { isInsideGeofence } from './geofence';
import {
  calculateLateMinutes,
  clinicCalendarDate,
  dateOnlyUtc,
  eachDateInclusive,
  formatWorkingHours,
  hashDeviceKey,
  newChallengeValue,
  workingMinutesBetween,
} from './attendance-time';
import { webauthnOrigins, webauthnRpId, webauthnRpName } from './webauthn-config';

type PunchGps = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

type AttendanceSettings = {
  enabled: boolean;
  gpsEnabled: boolean;
  deviceBindingEnabled: boolean;
  biometricEnabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  maxAccuracyMeters: number;
  timezone: string;
  weekOffDays: number[]; // 0=Sun .. 6=Sat
};

const DEFAULT_SETTINGS: AttendanceSettings = {
  enabled: false,
  gpsEnabled: true,
  deviceBindingEnabled: true,
  biometricEnabled: true,
  latitude: null,
  longitude: null,
  radiusMeters: 200,
  maxAccuracyMeters: 80,
  timezone: 'Asia/Kolkata',
  weekOffDays: [0],
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return fallback;
}

function asNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function money(v: unknown) {
  if (v == null) return null;
  return Number(v);
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private audit: AuditService,
  ) {}

  private serialize(row: any) {
    if (!row) return row;
    return {
      ...row,
      checkInLatitude: money(row.checkInLatitude),
      checkInLongitude: money(row.checkInLongitude),
      checkInAccuracyMeters: money(row.checkInAccuracyMeters),
      checkOutLatitude: money(row.checkOutLatitude),
      checkOutLongitude: money(row.checkOutLongitude),
      checkOutAccuracyMeters: money(row.checkOutAccuracyMeters),
      workingHoursDisplay: formatWorkingHours(row.workingMinutes || 0),
    };
  }

  async getSettings(clinicId: string): Promise<AttendanceSettings> {
    const rows = await this.prisma.setting.findMany({
      where: { clinicId, key: { startsWith: 'attendance.' } },
    });
    const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
    let weekOffDays = DEFAULT_SETTINGS.weekOffDays;
    try {
      const raw = map['attendance.weekOffDays'];
      if (Array.isArray(raw)) weekOffDays = raw.map(Number);
      else if (typeof raw === 'string') weekOffDays = JSON.parse(raw);
    } catch {
      /* keep default */
    }
    return {
      enabled: asBool(map['attendance.enabled'], DEFAULT_SETTINGS.enabled),
      gpsEnabled: asBool(map['attendance.gpsEnabled'], DEFAULT_SETTINGS.gpsEnabled),
      deviceBindingEnabled: asBool(
        map['attendance.deviceBindingEnabled'],
        DEFAULT_SETTINGS.deviceBindingEnabled,
      ),
      biometricEnabled: asBool(map['attendance.biometricEnabled'], DEFAULT_SETTINGS.biometricEnabled),
      latitude: map['attendance.latitude'] == null || map['attendance.latitude'] === ''
        ? null
        : asNum(map['attendance.latitude'], NaN),
      longitude: map['attendance.longitude'] == null || map['attendance.longitude'] === ''
        ? null
        : asNum(map['attendance.longitude'], NaN),
      radiusMeters: asNum(map['attendance.radiusMeters'], DEFAULT_SETTINGS.radiusMeters),
      maxAccuracyMeters: asNum(map['attendance.maxAccuracyMeters'], DEFAULT_SETTINGS.maxAccuracyMeters),
      timezone: String(map['attendance.timezone'] || DEFAULT_SETTINGS.timezone),
      weekOffDays,
    };
  }

  async updateSettings(
    clinicId: string,
    actorId: string,
    patch: Partial<{
      enabled: boolean;
      gpsEnabled: boolean;
      deviceBindingEnabled: boolean;
      biometricEnabled: boolean;
      latitude: number;
      longitude: number;
      radiusMeters: number;
      maxAccuracyMeters: number;
      timezone: string;
      weekOffDays: number[];
    }>,
  ) {
    const entries: Array<{ key: string; value: unknown }> = [];
    const map: Record<string, unknown> = {
      'attendance.enabled': patch.enabled,
      'attendance.gpsEnabled': patch.gpsEnabled,
      'attendance.deviceBindingEnabled': patch.deviceBindingEnabled,
      'attendance.biometricEnabled': patch.biometricEnabled,
      'attendance.latitude': patch.latitude,
      'attendance.longitude': patch.longitude,
      'attendance.radiusMeters': patch.radiusMeters,
      'attendance.maxAccuracyMeters': patch.maxAccuracyMeters,
      'attendance.timezone': patch.timezone,
      'attendance.weekOffDays': patch.weekOffDays,
    };
    for (const [key, value] of Object.entries(map)) {
      if (value === undefined) continue;
      entries.push({ key, value });
    }
    for (const item of entries) {
      await this.prisma.setting.upsert({
        where: { clinicId_key: { clinicId, key: item.key } },
        update: { value: item.value, group: 'attendance' },
        create: { clinicId, key: item.key, value: item.value, group: 'attendance' },
      });
    }
    await this.audit.log({
      clinicId,
      actorId,
      actorType: 'user',
      action: 'ATTENDANCE_SETTINGS_UPDATE',
      entityType: 'AttendanceSettings',
      entityId: clinicId,
      result: 'SUCCESS',
      metadata: patch,
    });
    return this.getSettings(clinicId);
  }

  async createChallenge(clinicId: string, userId: string) {
    const challenge = newChallengeValue();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const row = await this.prisma.attendanceChallenge.create({
      data: { clinicId, userId, challenge, expiresAt },
    });
    return { challengeId: row.id, challenge: row.challenge, expiresAt: row.expiresAt };
  }

  async webauthnRegistrationOptions(clinicId: string, userId: string, userName?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, clinicId },
      select: { name: true, email: true },
    });
    const display = userName || user?.name || user?.email || userId;
    const options = await generateRegistrationOptions({
      rpName: webauthnRpName(),
      rpID: webauthnRpId(),
      userName: display,
      userID: new TextEncoder().encode(userId),
      userDisplayName: display,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
    });
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const row = await this.prisma.attendanceChallenge.create({
      data: { clinicId, userId, challenge: options.challenge, expiresAt },
    });
    return { challengeId: row.id, options, expiresAt: row.expiresAt };
  }

  async webauthnAuthenticationOptions(clinicId: string, userId: string, deviceKey: string) {
    const settings = await this.getSettings(clinicId);
    if (!settings.biometricEnabled) {
      return this.createChallenge(clinicId, userId);
    }
    const device = await this.resolveDevice(clinicId, userId, deviceKey, {
      ...settings,
      deviceBindingEnabled: true,
    });
    if (!device?.webauthnCredentialId) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.BIOMETRIC_REQUIRED,
        'Biometric is not set up on this device. Re-register the device with biometric enabled.',
      );
    }
    const options = await generateAuthenticationOptions({
      rpID: webauthnRpId(),
      allowCredentials: [{ id: device.webauthnCredentialId }],
      userVerification: 'required',
    });
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const row = await this.prisma.attendanceChallenge.create({
      data: { clinicId, userId, challenge: options.challenge, expiresAt },
    });
    return { challengeId: row.id, options, expiresAt: row.expiresAt };
  }

  private async loadChallenge(clinicId: string, userId: string, challengeId: string) {
    const row = await this.prisma.attendanceChallenge.findFirst({
      where: { id: challengeId, clinicId, userId },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.CHALLENGE_INVALID,
        'Attendance challenge expired or invalid. Please try again.',
      );
    }
    return row;
  }

  private async consumeChallenge(clinicId: string, userId: string, challengeId: string) {
    const row = await this.loadChallenge(clinicId, userId, challengeId);
    await this.prisma.attendanceChallenge.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return row.challenge as string;
  }

  private async resolveDevice(
    clinicId: string,
    userId: string,
    deviceKey: string,
    settings: AttendanceSettings,
  ) {
    const required = settings.deviceBindingEnabled || settings.biometricEnabled;
    if (!required) return null;
    if (!deviceKey?.trim()) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.DEVICE_NOT_REGISTERED,
        'Your device is not registered for this account.',
      );
    }
    const hash = hashDeviceKey(deviceKey.trim());
    const device = await this.prisma.attendanceDevice.findFirst({
      where: { clinicId, userId, deviceKeyHash: hash },
    });
    if (!device) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.DEVICE_NOT_REGISTERED,
        'Your device is not registered for this account. Contact your administrator.',
      );
    }
    if (!device.isActive || device.revokedAt) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.DEVICE_REVOKED,
        'This device registration was revoked. Contact your administrator.',
      );
    }
    await this.prisma.attendanceDevice.update({
      where: { id: device.id },
      data: { lastUsedAt: new Date() },
    });
    return device;
  }

  /** Cryptographically verify WebAuthn assertion against the device-bound public key. */
  private async verifyWebAuthnAssertion(
    settings: AttendanceSettings,
    device: {
      id: string;
      webauthnCredentialId?: string | null;
      webauthnPublicKey?: string | null;
      webauthnCounter?: number | null;
    } | null,
    challenge: string,
    authenticationResponse?: AuthenticationResponseJSON,
  ) {
    if (!settings.biometricEnabled) return;
    if (!device?.webauthnCredentialId || !device.webauthnPublicKey) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.BIOMETRIC_REQUIRED,
        'Biometric is not set up on this device. Re-register the device with biometric enabled.',
      );
    }
    if (!authenticationResponse) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.BIOMETRIC_REQUIRED,
        'Biometric confirmation is required before attendance.',
      );
    }
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: challenge,
        expectedOrigin: webauthnOrigins(),
        expectedRPID: webauthnRpId(),
        requireUserVerification: true,
        credential: {
          id: device.webauthnCredentialId,
          publicKey: Buffer.from(device.webauthnPublicKey, 'base64url'),
          counter: device.webauthnCounter || 0,
        },
      });
    } catch {
      throw new AttendanceException(
        ATTENDANCE_ERROR.BIOMETRIC_MISMATCH,
        'Biometric verification failed. Use the registered device and try again.',
      );
    }
    if (!verification.verified) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.BIOMETRIC_MISMATCH,
        'Biometric verification failed. Use the registered device and try again.',
      );
    }
    const newCounter = verification.authenticationInfo.newCounter;
    await this.prisma.attendanceDevice.update({
      where: { id: device.id },
      data: { webauthnCounter: newCounter, lastUsedAt: new Date() },
    });
  }

  private assertGps(settings: AttendanceSettings, gps?: PunchGps) {
    if (!settings.gpsEnabled) return;
    if (!gps || !Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.GPS_REQUIRED,
        'Location permission is required for attendance.',
      );
    }
    const accuracy = gps.accuracy == null ? 0 : Number(gps.accuracy);
    if (Number.isFinite(accuracy) && accuracy > settings.maxAccuracyMeters) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.GPS_ACCURACY_TOO_LOW,
        'GPS accuracy is too low. Move outdoors or wait for a better signal and try again.',
      );
    }
    if (settings.latitude == null || settings.longitude == null || !Number.isFinite(settings.latitude)) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.SETTINGS_INCOMPLETE,
        'Clinic attendance location is not configured. Contact your administrator.',
      );
    }
    const geo = isInsideGeofence({
      userLat: gps.latitude,
      userLon: gps.longitude,
      clinicLat: settings.latitude,
      clinicLon: settings.longitude,
      radiusMeters: settings.radiusMeters,
    });
    if (!geo.inside) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.OUTSIDE_GEOFENCE,
        'You are outside the permitted attendance area. Please move closer to the clinic and try again.',
      );
    }
  }

  private async assertPunchAllowed(clinicId: string, userId: string, dateStr: string) {
    const date = dateOnlyUtc(dateStr);
    const holiday = await this.prisma.clinicHoliday.findFirst({
      where: { clinicId, date },
    });
    if (holiday) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.CLINIC_HOLIDAY,
        `Clinic holiday: ${holiday.name}. Check-in is not allowed.`,
      );
    }
    const row = await this.prisma.staffAttendance.findUnique({
      where: { clinicId_userId_date: { clinicId, userId, date } },
    });
    if (row?.status === 'ON_LEAVE') {
      throw new AttendanceException(
        ATTENDANCE_ERROR.ON_LEAVE,
        'You are marked on leave today. Check-in is not allowed.',
      );
    }
    if (row?.status === 'HOLIDAY' || row?.status === 'WEEK_OFF') {
      throw new AttendanceException(
        ATTENDANCE_ERROR.ATTENDANCE_NOT_ALLOWED,
        `Attendance status is ${row.status}. Check-in is not allowed.`,
      );
    }
  }

  private async activeShift(clinicId: string, userId: string, at: Date) {
    const assignment = await this.prisma.staffShiftAssignment.findFirst({
      where: {
        clinicId,
        userId,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
        shift: { isActive: true },
      },
      include: { shift: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    return assignment?.shift || null;
  }

  async getToday(clinicId: string, userId: string) {
    const settings = await this.getSettings(clinicId);
    const now = new Date();
    const dateStr = clinicCalendarDate(now, settings.timezone);
    const date = dateOnlyUtc(dateStr);
    const [row, holiday, pendingLeave] = await Promise.all([
      this.prisma.staffAttendance.findUnique({
        where: { clinicId_userId_date: { clinicId, userId, date } },
      }),
      this.prisma.clinicHoliday.findFirst({ where: { clinicId, date } }),
      this.prisma.staffLeaveRequest.findFirst({
        where: {
          clinicId,
          userId,
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: date },
          endDate: { gte: date },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const shift = await this.activeShift(clinicId, userId, now);
    const punchBlocked =
      Boolean(holiday) ||
      row?.status === 'ON_LEAVE' ||
      row?.status === 'HOLIDAY' ||
      pendingLeave?.status === 'APPROVED';
    return {
      date: dateStr,
      timezone: settings.timezone,
      attendance: row ? this.serialize(row) : null,
      holiday: holiday ? { id: holiday.id, name: holiday.name, date: dateStr } : null,
      leave: pendingLeave
        ? {
            id: pendingLeave.id,
            status: pendingLeave.status,
            startDate: pendingLeave.startDate.toISOString().slice(0, 10),
            endDate: pendingLeave.endDate.toISOString().slice(0, 10),
            reason: pendingLeave.reason,
          }
        : null,
      punchBlocked,
      punchBlockedReason: holiday
        ? `Clinic holiday: ${holiday.name}`
        : row?.status === 'ON_LEAVE' || pendingLeave?.status === 'APPROVED'
          ? 'You are on approved leave today'
          : row?.status === 'HOLIDAY'
            ? 'Marked as holiday'
            : null,
      shift: shift
        ? { id: shift.id, name: shift.name, startTime: shift.startTime, endTime: shift.endTime, graceMinutes: shift.graceMinutes }
        : null,
      settings: {
        enabled: settings.enabled,
        gpsEnabled: settings.gpsEnabled,
        deviceBindingEnabled: settings.deviceBindingEnabled,
        biometricEnabled: settings.biometricEnabled,
        radiusMeters: settings.radiusMeters,
      },
    };
  }

  async checkIn(
    clinicId: string,
    userId: string,
    body: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      deviceKey?: string;
      challengeId?: string;
      authenticationResponse?: AuthenticationResponseJSON;
      webauthnCredentialId?: string;
      biometricVerified?: boolean;
    },
  ) {
    const settings = await this.getSettings(clinicId);
    if (!settings.enabled) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.ATTENDANCE_DISABLED,
        'Staff attendance is disabled for this clinic.',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!body.challengeId) {
      throw new AttendanceException(ATTENDANCE_ERROR.CHALLENGE_INVALID, 'Missing attendance challenge.');
    }
    const challengeRow = await this.loadChallenge(clinicId, userId, body.challengeId);
    this.assertGps(settings, {
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      accuracy: body.accuracy == null ? undefined : Number(body.accuracy),
    });
    const device = await this.resolveDevice(clinicId, userId, body.deviceKey || '', settings);
    await this.verifyWebAuthnAssertion(
      settings,
      device,
      challengeRow.challenge,
      body.authenticationResponse,
    );
    await this.consumeChallenge(clinicId, userId, body.challengeId);

    const now = new Date();
    const dateStr = clinicCalendarDate(now, settings.timezone);
    await this.assertPunchAllowed(clinicId, userId, dateStr);
    const date = dateOnlyUtc(dateStr);
    const existing = await this.prisma.staffAttendance.findUnique({
      where: { clinicId_userId_date: { clinicId, userId, date } },
    });
    if (existing?.checkIn) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.ALREADY_CHECKED_IN,
        'Attendance has already been recorded today.',
      );
    }

    const shift = await this.activeShift(clinicId, userId, now);
    let lateMinutes = 0;
    let status: StaffAttendanceStatus = 'PRESENT';
    if (shift) {
      lateMinutes = calculateLateMinutes({
        checkIn: now,
        shiftStartHm: shift.startTime,
        shiftEndHm: shift.endTime,
        graceMinutes: shift.graceMinutes,
        timeZone: settings.timezone,
      });
      status = lateMinutes > 0 ? 'LATE' : 'PRESENT';
    }

    try {
      const row = await this.prisma.staffAttendance.create({
        data: {
          clinicId,
          userId,
          date,
          checkIn: now,
          status,
          lateMinutes,
          shiftId: shift?.id || null,
          checkInLatitude: settings.gpsEnabled ? body.latitude : null,
          checkInLongitude: settings.gpsEnabled ? body.longitude : null,
          checkInAccuracyMeters: settings.gpsEnabled ? body.accuracy ?? null : null,
          checkInDeviceId: device?.id || null,
          biometricVerifiedAt: settings.biometricEnabled ? now : null,
          source: 'SELF',
        },
      });
      await this.audit.log({
        clinicId,
        actorId: userId,
        actorType: 'user',
        action: 'ATTENDANCE_CHECK_IN',
        entityType: 'StaffAttendance',
        entityId: row.id,
        result: 'SUCCESS',
        metadata: { status, lateMinutes, deviceId: device?.id },
      });
      return this.serialize(row);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new AttendanceException(
          ATTENDANCE_ERROR.ALREADY_CHECKED_IN,
          'Attendance has already been recorded today.',
        );
      }
      throw err;
    }
  }

  async checkOut(
    clinicId: string,
    userId: string,
    body: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      deviceKey?: string;
      challengeId?: string;
      authenticationResponse?: AuthenticationResponseJSON;
      webauthnCredentialId?: string;
      biometricVerified?: boolean;
    },
  ) {
    const settings = await this.getSettings(clinicId);
    if (!settings.enabled) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.ATTENDANCE_DISABLED,
        'Staff attendance is disabled for this clinic.',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!body.challengeId) {
      throw new AttendanceException(ATTENDANCE_ERROR.CHALLENGE_INVALID, 'Missing attendance challenge.');
    }
    const challengeRow = await this.loadChallenge(clinicId, userId, body.challengeId);
    this.assertGps(settings, {
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      accuracy: body.accuracy == null ? undefined : Number(body.accuracy),
    });
    const device = await this.resolveDevice(clinicId, userId, body.deviceKey || '', settings);
    await this.verifyWebAuthnAssertion(
      settings,
      device,
      challengeRow.challenge,
      body.authenticationResponse,
    );
    await this.consumeChallenge(clinicId, userId, body.challengeId);

    const now = new Date();
    const dateStr = clinicCalendarDate(now, settings.timezone);
    const date = dateOnlyUtc(dateStr);
    const existing = await this.prisma.staffAttendance.findUnique({
      where: { clinicId_userId_date: { clinicId, userId, date } },
    });
    if (!existing?.checkIn) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.NOT_CHECKED_IN,
        'You have not checked in today.',
      );
    }
    if (existing.checkOut) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.ALREADY_CHECKED_OUT,
        'You have already checked out today.',
      );
    }

    const workingMinutes = workingMinutesBetween(existing.checkIn, now);
    const row = await this.prisma.staffAttendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        workingMinutes,
        checkOutLatitude: settings.gpsEnabled ? body.latitude : null,
        checkOutLongitude: settings.gpsEnabled ? body.longitude : null,
        checkOutAccuracyMeters: settings.gpsEnabled ? body.accuracy ?? null : null,
        checkOutDeviceId: device?.id || null,
        biometricVerifiedAt: settings.biometricEnabled ? now : existing.biometricVerifiedAt,
      },
    });
    await this.audit.log({
      clinicId,
      actorId: userId,
      actorType: 'user',
      action: 'ATTENDANCE_CHECK_OUT',
      entityType: 'StaffAttendance',
      entityId: row.id,
      result: 'SUCCESS',
      metadata: { workingMinutes, deviceId: device?.id },
    });
    return this.serialize(row);
  }

  async myHistory(
    clinicId: string,
    userId: string,
    opts: { year?: number; month?: number },
  ) {
    const settings = await this.getSettings(clinicId);
    const now = new Date();
    const year = opts.year || Number(clinicCalendarDate(now, settings.timezone).slice(0, 4));
    const month = opts.month || Number(clinicCalendarDate(now, settings.timezone).slice(5, 7));
    const start = dateOnlyUtc(`${year}-${String(month).padStart(2, '0')}-01`);
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const end = dateOnlyUtc(`${endYear}-${String(endMonth).padStart(2, '0')}-01`);
    const rows = await this.prisma.staffAttendance.findMany({
      where: { clinicId, userId, date: { gte: start, lt: end } },
      orderBy: { date: 'desc' },
    });
    return { year, month, data: rows.map((r: any) => this.serialize(r)) };
  }

  async listForClinic(
    clinicId: string,
    opts: { date?: string; search?: string; status?: string; page?: number; limit?: number },
  ) {
    const settings = await this.getSettings(clinicId);
    const dateStr = opts.date || clinicCalendarDate(new Date(), settings.timezone);
    const date = dateOnlyUtc(dateStr);
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 50, 200);
    const users = await this.prisma.user.findMany({
      where: {
        clinicId,
        status: 'ACTIVE',
        isSystemSupport: false,
        ...(opts.search
          ? {
              OR: [
                { name: { contains: opts.search, mode: 'insensitive' } },
                { email: { contains: opts.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, staffType: true },
      orderBy: { name: 'asc' },
    });
    const attendances = await this.prisma.staffAttendance.findMany({
      where: { clinicId, date },
    });
    const byUser = new Map<string, any>(attendances.map((a: any) => [a.userId, a]));
    let rows = users.map((u: any) => {
      const a = byUser.get(u.id);
      return {
        user: u,
        attendance: a ? this.serialize(a) : null,
        status: a?.status || 'NOT_MARKED',
      };
    });
    if (opts.status === 'NOT_MARKED') rows = rows.filter((r: any) => !r.attendance);
    else if (opts.status) rows = rows.filter((r: any) => r.attendance?.status === opts.status);
    const total = rows.length;
    const data = rows.slice((page - 1) * limit, page * limit);
    return { date: dateStr, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async dashboard(clinicId: string, date?: string) {
    const list = await this.listForClinic(clinicId, { date, limit: 5000 });
    const counts = {
      present: 0,
      late: 0,
      absent: 0,
      onLeave: 0,
      notMarked: 0,
      halfDay: 0,
    };
    for (const row of list.data) {
      const s = row.status;
      if (s === 'NOT_MARKED') counts.notMarked += 1;
      else if (s === 'PRESENT') counts.present += 1;
      else if (s === 'LATE') counts.late += 1;
      else if (s === 'ABSENT') counts.absent += 1;
      else if (s === 'ON_LEAVE') counts.onLeave += 1;
      else if (s === 'HALF_DAY') counts.halfDay += 1;
    }
    return { date: list.date, counts, sample: list.data.slice(0, 20) };
  }

  async manualUpsert(
    clinicId: string,
    actorId: string,
    body: {
      userId: string;
      date: string;
      status: StaffAttendanceStatus;
      checkIn?: string;
      checkOut?: string;
      remarks?: string;
    },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: body.userId, clinicId, isSystemSupport: false },
    });
    if (!user) throw new NotFoundException('Employee not found');
    const date = dateOnlyUtc(body.date);
    const checkIn = body.checkIn ? new Date(body.checkIn) : null;
    const checkOut = body.checkOut ? new Date(body.checkOut) : null;
    if (checkIn && checkOut && checkOut < checkIn) {
      throw new BadRequestException('Check-out must be after check-in');
    }
    const workingMinutes = checkIn && checkOut ? workingMinutesBetween(checkIn, checkOut) : 0;
    const existing = await this.prisma.staffAttendance.findUnique({
      where: { clinicId_userId_date: { clinicId, userId: body.userId, date } },
    });
    const data = {
      status: body.status,
      checkIn,
      checkOut,
      workingMinutes,
      remarks: body.remarks || null,
      source: 'MANUAL',
      correctedBy: actorId,
      correctedAt: new Date(),
    };
    const row = existing
      ? await this.prisma.staffAttendance.update({ where: { id: existing.id }, data })
      : await this.prisma.staffAttendance.create({
          data: { clinicId, userId: body.userId, date, lateMinutes: 0, ...data },
        });
    await this.audit.log({
      clinicId,
      actorId,
      actorType: 'user',
      action: existing ? 'ATTENDANCE_MANUAL_UPDATE' : 'ATTENDANCE_MANUAL_CREATE',
      entityType: 'StaffAttendance',
      entityId: row.id,
      result: 'SUCCESS',
      metadata: { userId: body.userId, date: body.date, status: body.status, remarks: body.remarks },
    });
    return this.serialize(row);
  }

  async monthlyReport(clinicId: string, year: number, month: number) {
    const start = dateOnlyUtc(`${year}-${String(month).padStart(2, '0')}-01`);
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const end = dateOnlyUtc(`${endYear}-${String(endMonth).padStart(2, '0')}-01`);
    const users = await this.prisma.user.findMany({
      where: { clinicId, status: 'ACTIVE', isSystemSupport: false },
      select: { id: true, name: true, email: true, staffType: true },
      orderBy: { name: 'asc' },
    });
    const rows = await this.prisma.staffAttendance.findMany({
      where: { clinicId, date: { gte: start, lt: end } },
    });
    const byUser = new Map<string, any[]>();
    for (const r of rows) {
      const list = byUser.get(r.userId) || [];
      list.push(r);
      byUser.set(r.userId, list);
    }
    const data = users.map((u: any) => {
      const list = byUser.get(u.id) || [];
      const present = list.filter((x) => x.status === 'PRESENT' || x.status === 'LATE').length;
      const late = list.filter((x) => x.status === 'LATE').length;
      const absent = list.filter((x) => x.status === 'ABSENT').length;
      const leave = list.filter((x) => x.status === 'ON_LEAVE').length;
      const workingMinutes = list.reduce((s, x) => s + (x.workingMinutes || 0), 0);
      const lateMinutes = list.reduce((s, x) => s + (x.lateMinutes || 0), 0);
      return {
        user: u,
        present,
        late,
        absent,
        leave,
        workingMinutes,
        workingHoursDisplay: formatWorkingHours(workingMinutes),
        lateMinutes,
      };
    });
    return { year, month, data };
  }

  async monthlyReportCsv(clinicId: string, year: number, month: number): Promise<string> {
    const report = await this.monthlyReport(clinicId, year, month);
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      ['Employee', 'Email', 'Type', 'Present', 'Late', 'Absent', 'Leave', 'WorkingHours', 'LateMinutes'].join(','),
      ...report.data.map((r: any) =>
        [
          escape(r.user.name),
          escape(r.user.email),
          escape(r.user.staffType || ''),
          r.present,
          r.late,
          r.absent,
          r.leave,
          escape(r.workingHoursDisplay),
          r.lateMinutes,
        ].join(','),
      ),
    ];
    return lines.join('\n') + '\n';
  }

  // ----- devices -----

  async registerDevice(
    clinicId: string,
    userId: string,
    body: {
      deviceKey: string;
      platform?: string;
      deviceName?: string;
      challengeId?: string;
      registrationResponse?: RegistrationResponseJSON;
      webauthnCredentialId?: string;
    },
  ) {
    if (!body.deviceKey?.trim()) throw new BadRequestException('deviceKey is required');
    const hash = hashDeviceKey(body.deviceKey.trim());
    const active = await this.prisma.attendanceDevice.findFirst({
      where: { clinicId, userId, isActive: true, revokedAt: null },
    });
    if (active) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.DEVICE_ALREADY_REGISTERED,
        'This account is already registered to another device. Contact your administrator to revoke it first.',
        HttpStatus.CONFLICT,
      );
    }
    const otherUser = await this.prisma.attendanceDevice.findFirst({
      where: { clinicId, deviceKeyHash: hash, isActive: true, revokedAt: null },
    });
    if (otherUser && otherUser.userId !== userId) {
      throw new AttendanceException(
        ATTENDANCE_ERROR.DEVICE_ALREADY_REGISTERED,
        'This device is already linked to another account.',
        HttpStatus.CONFLICT,
      );
    }
    const settings = await this.getSettings(clinicId);
    let webauthnCredentialId: string | null = null;
    let webauthnPublicKey: string | null = null;
    let webauthnCounter = 0;

    if (settings.biometricEnabled) {
      if (!body.challengeId || !body.registrationResponse) {
        throw new AttendanceException(
          ATTENDANCE_ERROR.BIOMETRIC_REQUIRED,
          'Biometric enrollment is required when registering a device for this clinic.',
        );
      }
      const challengeRow = await this.loadChallenge(clinicId, userId, body.challengeId);
      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: body.registrationResponse,
          expectedChallenge: challengeRow.challenge,
          expectedOrigin: webauthnOrigins(),
          expectedRPID: webauthnRpId(),
          requireUserVerification: true,
        });
      } catch {
        throw new AttendanceException(
          ATTENDANCE_ERROR.BIOMETRIC_MISMATCH,
          'Biometric enrollment failed verification. Try again.',
        );
      }
      if (!verification.verified || !verification.registrationInfo) {
        throw new AttendanceException(
          ATTENDANCE_ERROR.BIOMETRIC_MISMATCH,
          'Biometric enrollment failed verification. Try again.',
        );
      }
      const cred = verification.registrationInfo.credential;
      webauthnCredentialId = cred.id;
      webauthnPublicKey = Buffer.from(cred.publicKey).toString('base64url');
      webauthnCounter = cred.counter || 0;
      await this.consumeChallenge(clinicId, userId, body.challengeId);
    }

    const row = await this.prisma.attendanceDevice.create({
      data: {
        clinicId,
        userId,
        deviceKeyHash: hash,
        platform: body.platform || null,
        deviceName: body.deviceName || null,
        webauthnCredentialId,
        webauthnPublicKey,
        webauthnCounter,
        isActive: true,
        lastUsedAt: new Date(),
      },
    });
    await this.audit.log({
      clinicId,
      actorId: userId,
      actorType: 'user',
      action: 'ATTENDANCE_DEVICE_REGISTER',
      entityType: 'AttendanceDevice',
      entityId: row.id,
      result: 'SUCCESS',
      metadata: {
        platform: body.platform,
        deviceName: body.deviceName,
        hasWebauthn: Boolean(webauthnCredentialId),
      },
    });
    return {
      id: row.id,
      platform: row.platform,
      deviceName: row.deviceName,
      registeredAt: row.registeredAt,
      isActive: row.isActive,
      hasWebauthn: Boolean(row.webauthnCredentialId),
    };
  }

  async listDevices(clinicId: string, userId?: string) {
    const rows = await this.prisma.attendanceDevice.findMany({
      where: { clinicId, ...(userId ? { userId } : {}) },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { registeredAt: 'desc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      user: r.user,
      platform: r.platform,
      deviceName: r.deviceName,
      isActive: r.isActive && !r.revokedAt,
      registeredAt: r.registeredAt,
      lastUsedAt: r.lastUsedAt,
      revokedAt: r.revokedAt,
    }));
  }

  async revokeDevice(clinicId: string, actorId: string, deviceId: string) {
    const device = await this.prisma.attendanceDevice.findFirst({
      where: { id: deviceId, clinicId },
    });
    if (!device) throw new NotFoundException('Device not found');
    const row = await this.prisma.attendanceDevice.update({
      where: { id: deviceId },
      data: { isActive: false, revokedAt: new Date(), revokedBy: actorId },
    });
    await this.audit.log({
      clinicId,
      actorId,
      actorType: 'user',
      action: 'ATTENDANCE_DEVICE_REVOKE',
      entityType: 'AttendanceDevice',
      entityId: row.id,
      result: 'SUCCESS',
      metadata: { userId: device.userId },
    });
    return { id: row.id, revokedAt: row.revokedAt };
  }

  // ----- shifts -----

  async listShifts(clinicId: string) {
    return this.prisma.staffShift.findMany({
      where: { clinicId },
      orderBy: { name: 'asc' },
    });
  }

  async createShift(
    clinicId: string,
    data: { name: string; startTime: string; endTime: string; graceMinutes?: number },
  ) {
    return this.prisma.staffShift.create({
      data: {
        clinicId,
        name: data.name.trim(),
        startTime: data.startTime,
        endTime: data.endTime,
        graceMinutes: data.graceMinutes ?? 10,
      },
    });
  }

  async assignShift(clinicId: string, userId: string, shiftId: string) {
    const [user, shift] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, clinicId } }),
      this.prisma.staffShift.findFirst({ where: { id: shiftId, clinicId, isActive: true } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!shift) throw new NotFoundException('Shift not found');
    // Close any open assignment for this user
    await this.prisma.staffShiftAssignment.updateMany({
      where: { clinicId, userId, effectiveTo: null },
      data: { effectiveTo: new Date() },
    });
    return this.prisma.staffShiftAssignment.create({
      data: { clinicId, userId, shiftId },
    });
  }

  async listShiftAssignments(clinicId: string) {
    const rows = await this.prisma.staffShiftAssignment.findMany({
      where: { clinicId, effectiveTo: null },
      include: {
        user: { select: { id: true, name: true, email: true, staffType: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      user: r.user,
      shift: r.shift,
      effectiveFrom: r.effectiveFrom,
    }));
  }

  async myDeviceStatus(clinicId: string, userId: string) {
    const device = await this.prisma.attendanceDevice.findFirst({
      where: { clinicId, userId, isActive: true, revokedAt: null },
      orderBy: { registeredAt: 'desc' },
    });
    return {
      registered: Boolean(device),
      device: device
        ? {
            id: device.id,
            platform: device.platform,
            deviceName: device.deviceName,
            registeredAt: device.registeredAt,
            lastUsedAt: device.lastUsedAt,
            hasWebauthn: Boolean(device.webauthnCredentialId),
            webauthnCredentialId: device.webauthnCredentialId || null,
          }
        : null,
    };
  }

  // ----- holidays -----

  async listHolidays(clinicId: string, year?: number) {
    const y = year || new Date().getFullYear();
    const start = dateOnlyUtc(`${y}-01-01`);
    const end = dateOnlyUtc(`${y + 1}-01-01`);
    return this.prisma.clinicHoliday.findMany({
      where: { clinicId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(clinicId: string, actorId: string, body: { date: string; name: string }) {
    if (!body?.date || !body?.name?.trim()) throw new BadRequestException('date and name are required');
    const date = dateOnlyUtc(body.date);
    const row = await this.prisma.clinicHoliday.upsert({
      where: { clinicId_date: { clinicId, date } },
      update: { name: body.name.trim() },
      create: { clinicId, date, name: body.name.trim() },
    });
    await this.applyStatusForAllStaff(clinicId, body.date, 'HOLIDAY', `Holiday: ${row.name}`);
    await this.audit.log({
      clinicId,
      actorId,
      actorType: 'user',
      action: 'ATTENDANCE_HOLIDAY_UPSERT',
      entityType: 'ClinicHoliday',
      entityId: row.id,
      result: 'SUCCESS',
      metadata: { date: body.date, name: row.name },
    });
    return row;
  }

  async deleteHoliday(clinicId: string, actorId: string, id: string) {
    const row = await this.prisma.clinicHoliday.findFirst({ where: { id, clinicId } });
    if (!row) throw new NotFoundException('Holiday not found');
    await this.prisma.clinicHoliday.delete({ where: { id } });
    await this.audit.log({
      clinicId,
      actorId,
      actorType: 'user',
      action: 'ATTENDANCE_HOLIDAY_DELETE',
      entityType: 'ClinicHoliday',
      entityId: id,
      result: 'SUCCESS',
      metadata: { date: row.date },
    });
    return { id };
  }

  private async applyStatusForAllStaff(
    clinicId: string,
    dateStr: string,
    status: StaffAttendanceStatus,
    remarks: string,
  ) {
    const date = dateOnlyUtc(dateStr);
    const users = await this.prisma.user.findMany({
      where: { clinicId, status: 'ACTIVE', isSystemSupport: false },
      select: { id: true },
    });
    for (const u of users) {
      const existing = await this.prisma.staffAttendance.findUnique({
        where: { clinicId_userId_date: { clinicId, userId: u.id, date } },
      });
      if (existing?.checkIn) continue;
      if (existing) {
        await this.prisma.staffAttendance.update({
          where: { id: existing.id },
          data: { status, remarks, source: 'SYSTEM' },
        });
      } else {
        await this.prisma.staffAttendance.create({
          data: {
            clinicId,
            userId: u.id,
            date,
            status,
            lateMinutes: 0,
            workingMinutes: 0,
            source: 'SYSTEM',
            remarks,
          },
        });
      }
    }
  }

  // ----- leave -----

  async requestLeave(
    clinicId: string,
    userId: string,
    body: { startDate: string; endDate: string; reason?: string },
  ) {
    if (!body?.startDate || !body?.endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    const days = eachDateInclusive(body.startDate, body.endDate);
    if (!days.length) {
      throw new AttendanceException(ATTENDANCE_ERROR.LEAVE_INVALID, 'Invalid leave date range.');
    }
    if (days.length > 31) {
      throw new AttendanceException(ATTENDANCE_ERROR.LEAVE_INVALID, 'Leave range cannot exceed 31 days.');
    }
    const row = await this.prisma.staffLeaveRequest.create({
      data: {
        clinicId,
        userId,
        startDate: dateOnlyUtc(body.startDate),
        endDate: dateOnlyUtc(body.endDate),
        reason: body.reason?.trim() || null,
        status: 'PENDING',
      },
    });
    await this.audit.log({
      clinicId,
      actorId: userId,
      actorType: 'user',
      action: 'ATTENDANCE_LEAVE_REQUEST',
      entityType: 'StaffLeaveRequest',
      entityId: row.id,
      result: 'SUCCESS',
      metadata: { startDate: body.startDate, endDate: body.endDate },
    });
    return row;
  }

  async myLeaveRequests(clinicId: string, userId: string) {
    return this.prisma.staffLeaveRequest.findMany({
      where: { clinicId, userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listLeaveRequests(clinicId: string, status?: StaffLeaveStatus) {
    return this.prisma.staffLeaveRequest.findMany({
      where: { clinicId, ...(status ? { status } : {}) },
      include: { user: { select: { id: true, name: true, email: true, staffType: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async reviewLeave(
    clinicId: string,
    actorId: string,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewNote?: string,
  ) {
    const row = await this.prisma.staffLeaveRequest.findFirst({
      where: { id, clinicId },
    });
    if (!row) throw new NotFoundException('Leave request not found');
    if (row.status !== 'PENDING') {
      throw new AttendanceException(ATTENDANCE_ERROR.LEAVE_INVALID, 'Only pending leave can be reviewed.');
    }
    const updated = await this.prisma.staffLeaveRequest.update({
      where: { id },
      data: {
        status: decision,
        reviewedBy: actorId,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
    });
    if (decision === 'APPROVED') {
      const start = row.startDate.toISOString().slice(0, 10);
      const end = row.endDate.toISOString().slice(0, 10);
      for (const day of eachDateInclusive(start, end)) {
        const date = dateOnlyUtc(day);
        const existing = await this.prisma.staffAttendance.findUnique({
          where: { clinicId_userId_date: { clinicId, userId: row.userId, date } },
        });
        if (existing?.checkIn) continue;
        if (existing) {
          await this.prisma.staffAttendance.update({
            where: { id: existing.id },
            data: {
              status: 'ON_LEAVE',
              remarks: reviewNote || row.reason || 'Approved leave',
              source: 'SYSTEM',
            },
          });
        } else {
          await this.prisma.staffAttendance.create({
            data: {
              clinicId,
              userId: row.userId,
              date,
              status: 'ON_LEAVE',
              lateMinutes: 0,
              workingMinutes: 0,
              source: 'SYSTEM',
              remarks: reviewNote || row.reason || 'Approved leave',
            },
          });
        }
      }
    }
    await this.audit.log({
      clinicId,
      actorId,
      actorType: 'user',
      action: decision === 'APPROVED' ? 'ATTENDANCE_LEAVE_APPROVE' : 'ATTENDANCE_LEAVE_REJECT',
      entityType: 'StaffLeaveRequest',
      entityId: id,
      result: 'SUCCESS',
      metadata: { userId: row.userId, reviewNote },
    });
    return updated;
  }

  async cancelMyLeave(clinicId: string, userId: string, id: string) {
    const row = await this.prisma.staffLeaveRequest.findFirst({
      where: { id, clinicId, userId },
    });
    if (!row) throw new NotFoundException('Leave request not found');
    if (row.status !== 'PENDING') {
      throw new AttendanceException(ATTENDANCE_ERROR.LEAVE_INVALID, 'Only pending leave can be cancelled.');
    }
    return this.prisma.staffLeaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Hourly job: for each attendance-enabled clinic, mark previous calendar day's
   * unmarked active staff as ABSENT (or WEEK_OFF / HOLIDAY), and open punches as HALF_DAY.
   */
  async markAbsentForPreviousDay() {
    const clinics = await this.prisma.clinic.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    let marked = 0;
    let weekOff = 0;
    let halfDay = 0;
    let clinicsProcessed = 0;

    for (const clinic of clinics) {
      const settings = await this.getSettings(clinic.id);
      if (!settings.enabled) continue;
      clinicsProcessed += 1;

      const todayStr = clinicCalendarDate(new Date(), settings.timezone);
      const todayUtc = dateOnlyUtc(todayStr);
      const prev = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000);
      const dateStr = prev.toISOString().slice(0, 10);
      const date = dateOnlyUtc(dateStr);

      const mid = new Date(`${dateStr}T12:00:00.000Z`);
      const wdShort = new Intl.DateTimeFormat('en-US', {
        timeZone: settings.timezone,
        weekday: 'short',
      }).format(mid);
      const wdMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      const dayOfWeek = wdMap[wdShort] ?? mid.getUTCDay();
      const isWeekOff = (settings.weekOffDays || []).includes(dayOfWeek);
      const holiday = await this.prisma.clinicHoliday.findFirst({
        where: { clinicId: clinic.id, date },
      });

      const users = await this.prisma.user.findMany({
        where: { clinicId: clinic.id, status: 'ACTIVE', isSystemSupport: false },
        select: { id: true },
      });
      const existing = await this.prisma.staffAttendance.findMany({
        where: { clinicId: clinic.id, date },
        select: { id: true, userId: true, checkIn: true, checkOut: true, status: true, source: true, remarks: true },
      });
      const byUser = new Map(existing.map((e: any) => [e.userId, e]));

      // Checked in but never checked out → HALF_DAY (system close)
      for (const row of existing) {
        if (row.checkIn && !row.checkOut && row.status !== 'HALF_DAY' && row.status !== 'ON_LEAVE' && row.status !== 'HOLIDAY') {
          try {
            await this.prisma.staffAttendance.update({
              where: { id: row.id },
              data: {
                status: 'HALF_DAY',
                remarks: row.source === 'MANUAL' && row.remarks
                  ? row.remarks
                  : 'Auto half-day (checked in, no check-out)',
                source: row.source === 'MANUAL' ? 'MANUAL' : 'SYSTEM',
              },
            });
            halfDay += 1;
          } catch (err: any) {
            this.logger.warn(
              `Auto half-day failed clinic=${clinic.id} id=${row.id}: ${err?.message || err}`,
            );
          }
        }
      }

      for (const u of users) {
        if (byUser.has(u.id)) continue;
        const status: StaffAttendanceStatus = holiday
          ? 'HOLIDAY'
          : isWeekOff
            ? 'WEEK_OFF'
            : 'ABSENT';
        try {
          await this.prisma.staffAttendance.create({
            data: {
              clinicId: clinic.id,
              userId: u.id,
              date,
              status,
              lateMinutes: 0,
              workingMinutes: 0,
              source: 'SYSTEM',
              remarks: holiday
                ? `Holiday: ${holiday.name}`
                : isWeekOff
                  ? 'Auto week-off'
                  : 'Auto-marked absent (no check-in)',
            },
          });
          if (holiday || isWeekOff) weekOff += 1;
          else marked += 1;
        } catch (err: any) {
          if (err?.code !== 'P2002') {
            this.logger.warn(
              `Auto-absent failed clinic=${clinic.id} user=${u.id}: ${err?.message || err}`,
            );
          }
        }
      }
    }

    this.logger.log(
      `Auto-absent: clinics=${clinicsProcessed} absent=${marked} weekOff=${weekOff} halfDay=${halfDay}`,
    );
    return { clinicsProcessed, marked, weekOff, halfDay };
  }
}
