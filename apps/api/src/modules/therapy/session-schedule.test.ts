import { describe, expect, it } from 'vitest';
import { addDays, nextOccurrence, withRemaining } from './session-schedule';

describe('session-schedule', () => {
  const start = new Date('2026-01-05T10:00:00.000Z');

  it('addDays advances calendar days', () => {
    expect(addDays(start, 7).toISOString()).toBe('2026-01-12T10:00:00.000Z');
  });

  it('WEEKLY advances by 7 days', () => {
    expect(nextOccurrence(start, 'WEEKLY', 0).toISOString()).toBe('2026-01-12T10:00:00.000Z');
  });

  it('DAILY advances by 1 day', () => {
    expect(nextOccurrence(start, 'DAILY', 0).toISOString()).toBe('2026-01-06T10:00:00.000Z');
  });

  it('EVERY_TWO_WEEKS advances by 14 days', () => {
    expect(nextOccurrence(start, 'EVERY_TWO_WEEKS', 0).toISOString()).toBe(
      '2026-01-19T10:00:00.000Z',
    );
  });

  it('TWICE_WEEKLY alternates 3 then 4 day gaps', () => {
    expect(nextOccurrence(start, 'TWICE_WEEKLY', 0).toISOString()).toBe('2026-01-08T10:00:00.000Z');
    expect(nextOccurrence(start, 'TWICE_WEEKLY', 1).toISOString()).toBe('2026-01-09T10:00:00.000Z');
  });

  it('THREE_TIMES_WEEKLY uses 2/2/3 day pattern', () => {
    expect(nextOccurrence(start, 'THREE_TIMES_WEEKLY', 0).toISOString()).toBe(
      '2026-01-07T10:00:00.000Z',
    );
    expect(nextOccurrence(start, 'THREE_TIMES_WEEKLY', 1).toISOString()).toBe(
      '2026-01-07T10:00:00.000Z',
    );
    expect(nextOccurrence(start, 'THREE_TIMES_WEEKLY', 2).toISOString()).toBe(
      '2026-01-08T10:00:00.000Z',
    );
  });

  it('MONTHLY advances one calendar month', () => {
    expect(nextOccurrence(start, 'MONTHLY', 0).toISOString()).toBe('2026-02-05T10:00:00.000Z');
  });

  it('withRemaining computes unused sessions', () => {
    expect(withRemaining({ totalSessions: 10, usedSessions: 3 })).toEqual({
      totalSessions: 10,
      usedSessions: 3,
      remainingSessions: 7,
    });
  });
});
