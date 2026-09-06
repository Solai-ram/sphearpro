import { describe, expect, it } from 'vitest';
import { ICD10_CODES, searchIcd10 } from './icd10.data';

describe('searchIcd10', () => {
  it('returns a limited prefix of the catalog for empty query', () => {
    const result = searchIcd10('  ', 5);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual(ICD10_CODES[0]);
  });

  it('matches by code', () => {
    const result = searchIcd10('E11.9');
    expect(result.some((c) => c.code === 'E11.9')).toBe(true);
  });

  it('matches by description (case-insensitive)', () => {
    const result = searchIcd10('headache');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.description.toLowerCase().includes('headache'))).toBe(true);
  });

  it('respects limit', () => {
    expect(searchIcd10('a', 3)).toHaveLength(3);
  });

  it('returns empty when nothing matches', () => {
    expect(searchIcd10('zzznomatchzzz')).toEqual([]);
  });
});
