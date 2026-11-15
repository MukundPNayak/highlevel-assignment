import { describe, expect, it } from 'vitest';
import { clampPage } from './pagination.js';

describe('result helpers', () => {
  it('preserves valid pages and clamps empty/out-of-range results', () => {
    expect(clampPage(2, 150, 50)).toBe(2);
    expect(clampPage(2, 100, 50)).toBe(1);
    expect(clampPage(2, 0, 50)).toBe(0);
    expect(clampPage(-1, 100, 50)).toBe(0);
  });
});
