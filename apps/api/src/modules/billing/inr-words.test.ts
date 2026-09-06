import { describe, expect, it } from 'vitest';
import { amountInWordsInr } from './inr-words';

describe('amountInWordsInr', () => {
  it('formats zero', () => {
    expect(amountInWordsInr(0)).toBe('Zero Rupees only');
  });

  it('formats whole rupees', () => {
    expect(amountInWordsInr(500)).toBe('Five Hundred Rupees only');
  });

  it('formats thousands and lakhs', () => {
    expect(amountInWordsInr(125000)).toBe('One Lakh Twenty Five Thousand Rupees only');
  });

  it('includes paise', () => {
    expect(amountInWordsInr(10.5)).toBe('Ten Rupees and Fifty Paisa only');
  });
});
