export type SessionFrequency =
  | 'WEEKLY'
  | 'TWICE_WEEKLY'
  | 'THREE_TIMES_WEEKLY'
  | 'DAILY'
  | 'EVERY_TWO_WEEKS'
  | 'MONTHLY'
  | 'CUSTOM';

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

/** Advance from the current session date to the next occurrence for a frequency. */
export function nextOccurrence(current: Date, frequency: SessionFrequency, index: number): Date {
  switch (frequency) {
    case 'DAILY':
      return addDays(current, 1);
    case 'WEEKLY':
      return addDays(current, 7);
    case 'TWICE_WEEKLY':
      return addDays(current, index % 2 === 0 ? 3 : 4);
    case 'THREE_TIMES_WEEKLY':
      return addDays(current, index % 3 === 2 ? 3 : 2);
    case 'EVERY_TWO_WEEKS':
      return addDays(current, 14);
    case 'MONTHLY':
      return addMonths(current, 1);
    case 'CUSTOM':
    default:
      return addDays(current, 7);
  }
}

export function withRemaining<T extends { totalSessions: number; usedSessions: number }>(pkg: T) {
  return { ...pkg, remainingSessions: pkg.totalSessions - pkg.usedSessions };
}
