import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../constants/time.js';
import { INITIAL_QUERY } from '../constants/filters.js';
import { queryDeals } from './queryDeals.js';

const now = Date.UTC(2026, 10, 14);
const records = [
  {
    id: 'deal-1',
    companyName: 'Cedar Labs',
    ownerId: 'priya',
    stage: 'NEW_LEAD',
    value: 300,
    lastActivityAt: now - 30 * DAY_MS,
  },
  {
    id: 'deal-2',
    companyName: 'Acme Corp',
    ownerId: 'arjun',
    stage: 'CONTACTED',
    value: 200,
    lastActivityAt: now - 7 * DAY_MS,
  },
  {
    id: 'deal-3',
    companyName: 'Bluebird',
    ownerId: 'priya',
    stage: 'WON',
    value: 500,
    lastActivityAt: now - 90 * DAY_MS,
  },
  {
    id: 'deal-4',
    companyName: 'Acme Labs',
    ownerId: 'priya',
    stage: 'CONTACTED',
    value: 100,
    lastActivityAt: now - 60 * DAY_MS,
  },
  {
    id: 'deal-5',
    companyName: 'Zenith',
    ownerId: 'arjun',
    stage: 'LOST',
    value: 50,
    lastActivityAt: now - 120 * DAY_MS,
  },
];
const run = (changes = {}, data = records) =>
  queryDeals(data, { ...INITIAL_QUERY, ...changes }, now);
const ids = (deals) => deals.map(({ id }) => id);

describe('deal discovery', () => {
  it('filters by any selected owner and includes everyone when no owner is selected', () => {
    expect(ids(run({ ownerId: 'priya' }))).toEqual(['deal-4', 'deal-1', 'deal-3']);
    expect(ids(run({ ownerId: 'arjun' }))).toEqual(['deal-2', 'deal-5']);
    expect(run()).toHaveLength(5);
  });

  it('matches trimmed, case-insensitive company substrings and deal IDs', () => {
    expect(ids(run({ search: '  aCmE ' }))).toEqual(['deal-4', 'deal-2']);
    expect(ids(run({ search: 'DEAL-3' }))).toEqual(['deal-3']);
    expect(run({ search: '   ' })).toHaveLength(5);
    expect(run({ search: 'missing' })).toEqual([]);
  });

  it('uses OR within stages and AND across filters', () => {
    expect(ids(run({ stages: ['NEW_LEAD', 'CONTACTED'] }))).toEqual(['deal-4', 'deal-1', 'deal-2']);
    expect(
      ids(
        run({
          ownerId: 'priya',
          search: 'Labs',
          stages: ['CONTACTED', 'NEW_LEAD'],
          inactiveDays: 60,
        }),
      ),
    ).toEqual(['deal-4']);
    expect(run({ stages: [] })).toHaveLength(5);
  });

  it.each([7, 30, 60, 90])(
    'includes the exact %i-day boundary and excludes newer or closed records',
    (days) => {
      const boundary = now - days * DAY_MS;
      const data = [
        { ...records[0], id: 'exact', lastActivityAt: boundary },
        { ...records[0], id: 'newer', lastActivityAt: boundary + 1 },
        { ...records[0], id: 'older', lastActivityAt: boundary - 1 },
        { ...records[2], id: 'won', lastActivityAt: boundary - 1 },
        { ...records[4], id: 'lost', lastActivityAt: boundary - 1 },
      ];
      expect(ids(run({ inactiveDays: days }, data))).toEqual(['older', 'exact']);
    },
  );

  it('returns no results for closed-only stages with inactivity enabled', () => {
    expect(run({ stages: ['WON', 'LOST'], inactiveDays: 7 })).toEqual([]);
    expect(run({ stages: ['WON', 'LOST'], inactiveDays: '' })).toHaveLength(2);
  });

  it.each([
    ['activity-asc', ['deal-4', 'deal-1', 'deal-2', 'deal-5', 'deal-3']],
    ['activity-desc', ['deal-2', 'deal-1', 'deal-4', 'deal-3', 'deal-5']],
    ['value-asc', ['deal-5', 'deal-4', 'deal-2', 'deal-1', 'deal-3']],
    ['value-desc', ['deal-3', 'deal-1', 'deal-2', 'deal-4', 'deal-5']],
    ['company-asc', ['deal-2', 'deal-4', 'deal-3', 'deal-1', 'deal-5']],
    ['company-desc', ['deal-5', 'deal-1', 'deal-3', 'deal-4', 'deal-2']],
  ])('orders by %s across all matching records', (sort, expected) => {
    expect(ids(run({ sort }))).toEqual(expected);
  });

  it('breaks ties by ID in every sort direction without modifying source records', () => {
    const a = Object.freeze({ ...records[0], id: 'a' });
    const b = Object.freeze({ ...records[0], id: 'b' });
    const data = Object.freeze([b, a]);
    for (const sort of [
      'activity-asc',
      'activity-desc',
      'value-asc',
      'value-desc',
      'company-asc',
      'company-desc',
    ]) {
      expect(ids(run({ sort }, data))).toEqual(['a', 'b']);
    }
    expect(data).toEqual([b, a]);
  });
});
