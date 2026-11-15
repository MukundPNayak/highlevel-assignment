import { describe, expect, it } from 'vitest';
import { orderDeals } from './orderDeals.js';

describe('default deal ordering', () => {
  it('places all open stages before Won/Lost, even when closed activity is older', () => {
    const records = [
      { id: 'lost', stage: 'LOST', lastActivityAt: 1 },
      { id: 'new', stage: 'NEW_LEAD', lastActivityAt: 50 },
      { id: 'won', stage: 'WON', lastActivityAt: 2 },
      { id: 'negotiation', stage: 'NEGOTIATION', lastActivityAt: 20 },
      { id: 'contacted', stage: 'CONTACTED', lastActivityAt: 30 },
      { id: 'demo', stage: 'DEMO_DONE', lastActivityAt: 40 },
      { id: 'proposal', stage: 'PROPOSAL_SENT', lastActivityAt: 60 },
    ];
    expect(orderDeals(records).map(({ id }) => id)).toEqual([
      'negotiation',
      'contacted',
      'demo',
      'new',
      'proposal',
      'lost',
      'won',
    ]);
  });

  it('breaks equal-activity ties by ID without mutating the source or records', () => {
    const a = Object.freeze({ id: 'deal-00001', stage: 'NEW_LEAD', lastActivityAt: 1 });
    const b = Object.freeze({ id: 'deal-00002', stage: 'CONTACTED', lastActivityAt: 1 });
    const input = Object.freeze([b, a]);
    const result = orderDeals(input);
    expect(result).toEqual([a, b]);
    expect(input).toEqual([b, a]);
    expect(result[0]).toBe(a);
  });

  it('handles an empty dataset', () => {
    expect(orderDeals([])).toEqual([]);
  });
});
