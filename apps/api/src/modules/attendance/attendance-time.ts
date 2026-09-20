import { createHash, randomBytes } from 'crypto';

/** Parse "HH:mm" into minutes from midnight. */
export function parseHmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** Calendar YYYY-MM-DD for an instant in a given IANA timezone. */
export function clinicCalendarDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Date-only UTC midnight for Prisma @db.Date from YYYY-MM-DD. */
export function dateOnlyUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/**
 * Late minutes vs shift start + grace, using local wall-clock in clinic TZ.
 * Overnight shifts (start > end): check-ins after midnight are measured from start + 24h.
 */
export function calculateLateMinutes(opts: {
  checkIn: Date;
  shiftStartHm: string;
  graceMinutes: number;
  timeZone: string;
  shiftEndHm?: string;
}): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: opts.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(opts.checkIn);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const checkMins = hour * 60 + minute;
  const startMins = parseHmToMinutes(opts.shiftStartHm);
  const endMins = opts.shiftEndHm ? parseHmToMinutes(opts.shiftEndHm) : null;
  const overnight = endMins != null && startMins > endMins;
  const allowed = startMins + Math.max(0, opts.graceMinutes);

  let effectiveCheck = checkMins;
  if (overnight && checkMins < startMins) {
    // After midnight portion of overnight shift (e.g. 01:00 vs start 22:00)
    effectiveCheck = checkMins + 24 * 60;
  }

  if (effectiveCheck <= allowed) return 0;
  return effectiveCheck - allowed;
}

export function workingMinutesBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / 60000);
}

export function formatWorkingHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function eachDateInclusive(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  let cur = dateOnlyUtc(startIso);
  const end = dateOnlyUtc(endIso);
  if (cur.getTime() > end.getTime()) return out;
  while (cur.getTime() <= end.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

export function hashDeviceKey(deviceKey: string): string {
  return createHash('sha256').update(deviceKey, 'utf8').digest('hex');
}

export function newChallengeValue(): string {
  return randomBytes(32).toString('base64url');
}
