import { describe, expect, it } from 'vitest';
import { toggleDealSelection, togglePageSelection } from './selection.js';

describe('selection helpers', () => {
  it('captures a version on selection and removes only that deal on deselection', () => {
    const current = new Map([['other', { id: 'other', expectedVersion: 1 }]]);
    const next = toggleDealSelection(current, { id: 'a', version: 2 });
    expect(next.get('a')).toEqual({ id: 'a', expectedVersion: 2 });
    expect(current.has('a')).toBe(false);
    expect(toggleDealSelection(next, { id: 'a', version: 3 })).toEqual(current);
  });

  it('selects/deselects only this page while preserving other pages and original selected versions', () => {
    const original = { id: 'a', expectedVersion: 1 };
    const current = new Map([
      ['a', original],
      ['other', { id: 'other', expectedVersion: 1 }],
    ]);
    const page = [
      { id: 'a', version: 2 },
      { id: 'b', version: 1 },
    ];
    const next = togglePageSelection(current, page);
    expect(next.get('a')).toBe(original);
    expect(next.get('b')).toEqual({ id: 'b', expectedVersion: 1 });
    expect(togglePageSelection(next, page)).toEqual(new Map([['other', current.get('other')]]));
  });
});
