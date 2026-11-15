import { describe, expect, it, vi } from 'vitest';
import { createDealsApi } from './createDealsApi.js';

const deal = {
  id: 'a',
  companyName: 'Acme',
  ownerId: 'owner-1',
  stage: 'NEW_LEAD',
  value: 100,
  lastActivityAt: 10,
  updatedAt: 10,
  version: 1,
};
const options = { wait: async () => {}, now: () => 200, settings: { failureRate: 0 } };

describe('single-deal fake API', () => {
  it('lists current complete saved records without exposing store objects', async () => {
    const api = createDealsApi([deal], options);
    const first = await api.listDeals();
    expect(first).toEqual({ items: [deal], total: 1, page: 0, pageSize: 50 });
    first.items[0].stage = 'LOST';
    expect((await api.listDeals()).items[0].stage).toBe('NEW_LEAD');
    await api.updateDealStage({ id: deal.id, targetStage: 'WON', expectedVersion: 1 });
    expect((await api.listDeals()).items[0]).toEqual({
      ...deal,
      stage: 'WON',
      version: 2,
      updatedAt: 200,
    });
  });
  it('isolates saved data and returns the complete confirmed deal', async () => {
    const original = { ...deal };
    const api = createDealsApi([original], options);
    original.stage = 'LOST';
    const read = await api.getDeal('a');
    expect(read.stage).toBe('NEW_LEAD');
    read.version = 99;
    const result = await api.updateDealStage({ id: 'a', targetStage: 'WON', expectedVersion: 1 });
    expect(result).toEqual({
      kind: 'success',
      deal: { ...deal, stage: 'WON', version: 2, updatedAt: 200 },
    });
    result.deal.stage = 'LOST';
    expect((await api.getDeal('a')).stage).toBe('WON');
  });

  it('fails before commit and allows the same request to be retried', async () => {
    const api = createDealsApi([deal], { ...options, settings: { failureRate: 1 } });
    const input = { id: 'a', targetStage: 'LOST', expectedVersion: 1 };
    expect((await api.updateDealStage(input)).kind).toBe('network-error');
    expect(await api.getDeal('a')).toEqual(deal);
    api.setSettings({ failureRate: 0 });
    expect((await api.updateDealStage(input)).kind).toBe('success');
  });

  it('atomically rejects competing writes and returns the latest deal for review', async () => {
    const api = createDealsApi([deal], options);
    const input = { id: 'a', expectedVersion: 1 };
    const results = await Promise.all([
      api.updateDealStage({ ...input, targetStage: 'WON' }),
      api.updateDealStage({ ...input, targetStage: 'LOST' }),
    ]);
    expect(results.map(({ kind }) => kind)).toEqual(['success', 'conflict']);
    expect(results[1].latest).toEqual(results[0].deal);
  });

  it('validates input and treats the current stage as a no-op without incrementing version', async () => {
    const api = createDealsApi([deal], options);
    expect(
      await api.updateDealStage({ id: 'a', expectedVersion: 1, targetStage: 'NEW_LEAD' }),
    ).toEqual({ kind: 'noop', deal });
    expect(
      (await api.updateDealStage({ id: 'a', expectedVersion: 1, targetStage: 'UNKNOWN' })).kind,
    ).toBe('invalid');
    expect(
      (await api.updateDealStage({ id: 'missing', expectedVersion: 1, targetStage: 'WON' })).kind,
    ).toBe('invalid');
    await expect(api.getDeal('missing')).rejects.toThrow('could not be found');
  });

  it('captures settings at request start and validates adjustment ranges', async () => {
    let finishDelay;
    const api = createDealsApi([deal], {
      ...options,
      random: () => 0.5,
      wait: () =>
        new Promise((resolve) => {
          finishDelay = resolve;
        }),
    });
    const request = api.updateDealStage({ id: 'a', expectedVersion: 1, targetStage: 'WON' });
    api.setSettings({ failureRate: 1 });
    finishDelay();
    expect((await request).kind).toBe('success');
    expect(() => api.setSettings({ minLatencyMs: 2000, maxLatencyMs: 100 })).toThrow();
    expect(() => api.setSettings({ failureRate: 2 })).toThrow();
    expect(() => api.setSettings({ maxLatencyMs: Infinity })).toThrow();
  });

  it('handles success, failure, no-op and conflict independently in one bulk request and one delay', async () => {
    const random = vi
      .fn()
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0)
      .mockReturnValue(0.9);
    const wait = vi.fn().mockResolvedValue();
    const api = createDealsApi(
      [
        deal,
        { ...deal, id: 'b' },
        { ...deal, id: 'c', stage: 'WON' },
        { ...deal, id: 'd', version: 2 },
      ],
      { random, wait, settings: { failureRate: 0.1 } },
    );
    const inputs = ['a', 'b', 'c', 'd'].map((id) => ({ id, expectedVersion: 1 }));
    const results = await api.bulkUpdateDealStage({ deals: inputs, targetStage: 'WON' });
    expect(wait).toHaveBeenCalledTimes(1);
    expect(results.map(({ kind }) => kind)).toEqual([
      'success',
      'network-error',
      'noop',
      'conflict',
    ]);
    expect(results.map(({ id }) => id)).toEqual(['a', 'b', 'c', 'd']);
    expect(results[0].deal.version).toBe(2);
    expect(results[2].deal.version).toBe(1);
    expect(results[3].latest.version).toBe(2);
    const retry = await api.bulkUpdateDealStage({ deals: [inputs[1]], targetStage: 'WON' });
    expect(retry[0].kind).toBe('success');
    expect((await api.getDeal('a')).version).toBe(2);
  });

  it('rejects duplicate/empty bulk inputs before mutation and snapshots inputs before waiting', async () => {
    const api = createDealsApi([deal], options);
    await expect(api.bulkUpdateDealStage({ deals: [], targetStage: 'WON' })).rejects.toThrow();
    await expect(
      api.bulkUpdateDealStage({ deals: [{ id: 'a' }, { id: 'a' }], targetStage: 'WON' }),
    ).rejects.toThrow();
    let finish;
    const delayed = createDealsApi([deal], {
      ...options,
      wait: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const entries = [{ id: 'a', expectedVersion: 1 }];
    const request = delayed.bulkUpdateDealStage({ deals: entries, targetStage: 'WON' });
    entries[0].expectedVersion = 99;
    entries.push({ id: 'missing' });
    finish();
    expect((await request).map(({ kind }) => kind)).toEqual(['success']);
  });
});

describe('server-side list queries', () => {
  const records = Array.from({ length: 125 }, (_, i) => ({
    ...deal,
    id: String(i).padStart(3, '0'),
    companyName: 'Company ' + i,
    ownerId: i % 2 ? 'owner-2' : 'owner-1',
    stage: i % 2 ? 'WON' : 'NEW_LEAD',
    value: i,
  }));

  it('returns a bounded page, server count, and resolved pagination metadata', async () => {
    const api = createDealsApi(records, options);
    const first = await api.listDeals();
    const second = await api.listDeals({ page: 1 });
    expect(first.items).toHaveLength(50);
    expect(first.total).toBe(125);
    expect(second.items).toHaveLength(50);
    expect(second.page).toBe(1);
    expect(second.items.some(({ id }) => first.items.some((row) => row.id === id))).toBe(false);
    const last = await api.listDeals({ page: 99 });
    expect(last.page).toBe(2);
    expect(last.items).toHaveLength(25);
  });

  it('filters and sorts the whole store before slicing the requested page', async () => {
    const api = createDealsApi(records, options);
    const result = await api.listDeals({
      query: { ownerId: 'owner-1', stages: ['NEW_LEAD'], sort: 'value-desc' },
      page: 1,
      pageSize: 25,
    });
    expect(result.total).toBe(63);
    expect(result.items).toHaveLength(25);
    expect(result.items[0].value).toBe(74);
    expect(
      result.items.every(({ stage, ownerId }) => stage === 'NEW_LEAD' && ownerId === 'owner-1'),
    ).toBe(true);
  });

  it('refills the page and updates totals after a deal leaves the active filter', async () => {
    const api = createDealsApi(records, options);
    const request = { query: { stages: ['NEW_LEAD'] }, pageSize: 25 };
    const first = await api.listDeals(request);
    await api.updateDealStage({ id: first.items[0].id, expectedVersion: 1, targetStage: 'LOST' });
    const next = await api.listDeals(request);
    expect(next.total).toBe(62);
    expect(next.items).toHaveLength(25);
    expect(next.items[0].id).toBe(first.items[1].id);
    const empty = await api.listDeals({ query: { search: 'no such company' }, page: 100 });
    expect(empty).toEqual({ items: [], total: 0, page: 0, pageSize: 50 });
  });

  it('captures query inputs before the simulated delay', async () => {
    let finish;
    const api = createDealsApi(records, {
      ...options,
      wait: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const query = { stages: ['NEW_LEAD'], search: 'Company 12' };
    const request = api.listDeals({ query });
    query.stages[0] = 'WON';
    query.search = 'changed';
    finish();
    const response = await request;
    expect(response.total).toBe(4);
    expect(response.items.every(({ stage }) => stage === 'NEW_LEAD')).toBe(true);
  });

  it('rejects invalid or unbounded page requests', async () => {
    const api = createDealsApi(records, options);
    for (const request of [{ page: -1 }, { page: 0.5 }, { pageSize: 0 }, { pageSize: 101 }]) {
      await expect(api.listDeals(request)).rejects.toThrow('Invalid pagination');
    }
  });
});
