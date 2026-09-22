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

export function extractDaySlots(goals: unknown): string[] {
  if (!goals) return [];
  if (Array.isArray(goals)) {
    if (goals.every((g) => typeof g === 'string')) return goals;
    return [];
  }
  if (typeof goals === 'object' && goals !== null) {
    const obj = goals as Record<string, any>;
    if (Array.isArray(obj.daySlots)) return obj.daySlots;
  }
  return [];
}

export function extractTimeSlot(goals: unknown): string | null {
  if (!goals || typeof goals !== 'object' || Array.isArray(goals)) return null;
  return (goals as Record<string, any>).timeSlot || null;
}

export function parseWeekday(slot: string): number {
  const lower = slot.toLowerCase();
  if (lower.includes('sun')) return 0;
  if (lower.includes('mon')) return 1;
  if (lower.includes('tue')) return 2;
  if (lower.includes('wed')) return 3;
  if (lower.includes('thu')) return 4;
  if (lower.includes('fri')) return 5;
  if (lower.includes('sat')) return 6;
  return -1;
}

