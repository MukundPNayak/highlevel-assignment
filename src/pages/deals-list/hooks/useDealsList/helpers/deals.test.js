import { describe, expect, it } from 'vitest';
import { mergeConfirmedDeals } from './deals.js';

describe('current page updates', () => {
  const first = Object.freeze({ id: 'a', version: 1 });
  const second = Object.freeze({ id: 'b', version: 1 });
  const page = Object.freeze([first, second]);

  it('updates existing visible rows without adding off-page records or reordering', () => {
    const updated = { id: 'a', version: 2, stage: 'LOST' };
    const next = mergeConfirmedDeals(page, [updated, { id: 'c', version: 3 }]);
    expect(next).toEqual([updated, second]);
    expect(next[1]).toBe(second);
    expect(page[0]).toBe(first);
  });

  it('ignores duplicates, older versions, and off-page records', () => {
    expect(
      mergeConfirmedDeals(page, [
        { id: 'a', version: 1 },
        { id: 'c', version: 4 },
      ]),
    ).toBe(page);
    expect(mergeConfirmedDeals(page, [])).toBe(page);
  });

  it('uses the highest confirmed version within a batch', () => {
    expect(
      mergeConfirmedDeals(page, [
        { id: 'a', version: 3 },
        { id: 'a', version: 2 },
      ])[0].version,
    ).toBe(3);
  });
});
