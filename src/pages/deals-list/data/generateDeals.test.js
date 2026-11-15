import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../constants/time.js';
import { OWNER_COUNT, OWNERS, OWNERS_BY_ID, STAGE_DISTRIBUTION } from '../constants/mockData.js';
import { STAGES } from '../constants/stages.js';
import { generateDeals } from './generateDeals.js';

const referenceTime = Date.UTC(2026, 10, 14, 12);
const options = { seed: 42, referenceTime };
const deals = generateDeals(options);

describe('generated deals list data', () => {
  it('creates 50,000 unique deals with distinct owners and deals assigned to every owner', () => {
    expect(deals).toHaveLength(50_000);
    expect(OWNERS).toHaveLength(OWNER_COUNT);
    expect(new Set(OWNERS.map(({ name }) => name)).size).toBe(OWNER_COUNT);
    expect(new Set(deals.map(({ id }) => id)).size).toBe(50_000);
    const ownerIds = new Set(OWNERS.map(({ id }) => id));
    expect(ownerIds.size).toBe(OWNER_COUNT);
    expect(deals.every(({ ownerId }) => ownerIds.has(ownerId))).toBe(true);
    expect(new Set(deals.map(({ ownerId }) => ownerId)).size).toBe(OWNER_COUNT);
    expect(OWNERS.every((owner) => OWNERS_BY_ID[owner.id] === owner)).toBe(true);
  });

  it('covers every stage at realistic volume, including stages with at least 10,000 deals', () => {
    const counts = deals.reduce((result, { stage }) => {
      result[stage] = (result[stage] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toEqual(STAGE_DISTRIBUTION);
    expect(Object.keys(counts).sort()).toEqual(STAGES.map(({ id }) => id).sort());
    expect(Math.max(...Object.values(counts))).toBeGreaterThanOrEqual(10_000);
  });

  it('has positive varied values, recent and stale activity, and consistent timestamps', () => {
    expect(
      deals.every(
        (deal) =>
          deal.value > 0 &&
          Number.isInteger(deal.value) &&
          deal.lastActivityAt <= deal.updatedAt &&
          deal.updatedAt <= referenceTime &&
          deal.version === 1,
      ),
    ).toBe(true);
    expect(new Set(deals.map(({ value }) => value)).size).toBeGreaterThan(100);
    expect(deals.some(({ lastActivityAt }) => referenceTime - lastActivityAt < DAY_MS)).toBe(true);
    expect(deals.some(({ lastActivityAt }) => referenceTime - lastActivityAt > 90 * DAY_MS)).toBe(
      true,
    );
  });

  it('reproduces the full dataset with the same seed and reference time', () => {
    expect(generateDeals(options)).toEqual(deals);
  });

  it('supports a different seed and a shifted reference clock', () => {
    expect(generateDeals({ ...options, seed: 7 })[0]).not.toEqual(deals[0]);
    const shifted = generateDeals({ ...options, referenceTime: referenceTime + DAY_MS });
    expect(shifted[0].lastActivityAt).toBe(deals[0].lastActivityAt + DAY_MS);
  });
});
