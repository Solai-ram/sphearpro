import { describe, expect, it } from 'vitest';
import { nextOccurrence } from './session-schedule';

describe('session-schedule generated calendar (policy)', () => {
  it('WEEKLY produces 7-day gaps across four sessions', () => {
    let current = new Date('2026-10-01T10:00:00.000Z');
    const dates = [current];
    for (let i = 0; i < 3; i += 1) {
      current = nextOccurrence(current, 'WEEKLY', i);
      dates.push(current);
    }
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-10-01',
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
    ]);
  });

  it('CUSTOM falls back to weekly', () => {
    const start = new Date('2026-10-01T10:00:00.000Z');
    expect(nextOccurrence(start, 'CUSTOM', 0).toISOString()).toBe(
      nextOccurrence(start, 'WEEKLY', 0).toISOString(),
    );
  });
});
