import { describe, expect, it } from 'vitest';
import { distanceMeters, isInsideGeofence } from './geofence';
import {
  calculateLateMinutes,
  clinicCalendarDate,
  eachDateInclusive,
  formatWorkingHours,
  hashDeviceKey,
  workingMinutesBetween,
} from './attendance-time';

describe('geofence', () => {
  it('returns ~0 for same point', () => {
    expect(distanceMeters(13.08, 80.27, 13.08, 80.27)).toBeLessThan(1);
  });

  it('allows inside radius and rejects outside', () => {
    const clinic = { lat: 13.0827, lon: 80.2707 };
    const near = isInsideGeofence({
      userLat: 13.083,
      userLon: 80.271,
      clinicLat: clinic.lat,
      clinicLon: clinic.lon,
      radiusMeters: 200,
    });
    expect(near.inside).toBe(true);

    const far = isInsideGeofence({
      userLat: 13.1,
      userLon: 80.3,
      clinicLat: clinic.lat,
      clinicLon: clinic.lon,
      radiusMeters: 200,
    });
    expect(far.inside).toBe(false);
  });
});

describe('attendance-time', () => {
  it('formats working hours', () => {
    expect(formatWorkingHours(543)).toBe('9h 03m');
  });

  it('computes working minutes', () => {
    const a = new Date('2026-09-10T03:30:00.000Z');
    const b = new Date('2026-09-10T12:30:00.000Z');
    expect(workingMinutesBetween(a, b)).toBe(540);
  });

  it('hashes device key stably', () => {
    expect(hashDeviceKey('abc')).toBe(hashDeviceKey('abc'));
    expect(hashDeviceKey('abc')).not.toBe(hashDeviceKey('abd'));
  });

  it('calculates late after grace', () => {
    // 09:15 IST = 03:45 UTC on 2026-09-10
    const checkIn = new Date('2026-09-10T03:45:00.000Z');
    const late = calculateLateMinutes({
      checkIn,
      shiftStartHm: '09:00',
      graceMinutes: 10,
      timeZone: 'Asia/Kolkata',
    });
    expect(late).toBe(5);
  });

  it('overnight: on-time before midnight is not late', () => {
    // 22:05 IST
    const checkIn = new Date('2026-09-10T16:35:00.000Z');
    const late = calculateLateMinutes({
      checkIn,
      shiftStartHm: '22:00',
      shiftEndHm: '06:00',
      graceMinutes: 10,
      timeZone: 'Asia/Kolkata',
    });
    expect(late).toBe(0);
  });

  it('overnight: after midnight late relative to previous-day start', () => {
    // 01:30 IST next calendar morning = very late vs 22:00 start + 10 grace
    const checkIn = new Date('2026-09-10T20:00:00.000Z'); // 01:30 IST
    const late = calculateLateMinutes({
      checkIn,
      shiftStartHm: '22:00',
      shiftEndHm: '06:00',
      graceMinutes: 10,
      timeZone: 'Asia/Kolkata',
    });
    expect(late).toBeGreaterThan(100);
  });

  it('returns clinic calendar date in TZ', () => {
    const d = clinicCalendarDate(new Date('2026-09-09T20:30:00.000Z'), 'Asia/Kolkata');
    expect(d).toBe('2026-09-10');
  });

  it('eachDateInclusive spans inclusive range', () => {
    expect(eachDateInclusive('2026-09-10', '2026-09-12')).toEqual([
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
    ]);
    expect(eachDateInclusive('2026-09-12', '2026-09-10')).toEqual([]);
  });
});
