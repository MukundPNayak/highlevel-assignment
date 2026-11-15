// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDealsList } from './useDealsList.js';
import { createDealsApi } from '../../api/createDealsApi.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const fixtures = Array.from({ length: 125 }, (_, i) => ({
  id: String(i).padStart(3, '0'),
  companyName: 'Company ' + i,
  stage: 'NEW_LEAD',
  ownerId: 'owner-1',
  value: i,
  lastActivityAt: i,
  version: 1,
}));
let current;
let api;
let root;
let container;

function Harness() {
  const value = useDealsList(api);
  useEffect(() => {
    current = value;
  }, [value]);
  return null;
}

beforeEach(async () => {
  api = createDealsApi(fixtures, { wait: async () => {}, settings: { failureRate: 0 } });
  api.listDeals = vi.fn(api.listDeals);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(() => root.render(<Harness />));
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
});

describe('server paginated deals', () => {
  it('keeps only the fetched page and refetches when navigating back', async () => {
    expect(current.deals).toHaveLength(50);
    expect(current.total).toBe(125);
    expect(current.dealsById).toBeUndefined();
    expect(current.viewIds).toBeUndefined();
    const firstId = current.deals[0].id;
    await act(() => current.changePage(1));
    expect(api.listDeals).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 50 }),
    );
    expect(current.deals).toHaveLength(50);
    expect(current.deals.some(({ id }) => id === firstId)).toBe(false);
    await api.updateDealStage({ id: firstId, targetStage: 'LOST', expectedVersion: 1 });
    await act(() => current.changePage(0));
    expect(api.listDeals).toHaveBeenCalledTimes(3);
    expect(current.deals.find(({ id }) => id === firstId)).toBeUndefined();
    expect(current.deals).toHaveLength(50);
  });

  it('preserves only selected IDs and original versions across pages', async () => {
    await act(() => current.togglePageSelection());
    const first = current.deals[0];
    await act(() => current.changePage(1));
    await act(() => current.togglePageSelection());
    expect(current.selected.size).toBe(100);
    expect(current.selected.get(first.id)).toEqual({ id: first.id, expectedVersion: 1 });
    await api.updateDealStage({ id: first.id, targetStage: 'CONTACTED', expectedVersion: 1 });
    await act(() => current.changePage(0));
    expect(current.selected.size).toBe(100);
    expect(current.deals[0].version).toBe(2);
    expect(current.selected.get(first.id).expectedVersion).toBe(1);
    await act(() => current.togglePageSelection());
    expect(current.selected.size).toBe(50);
  });

  it('updates visible cells without inserting off-page deals or recalculating totals', async () => {
    const first = current.deals[0];
    await act(() =>
      current.mergeDeals([
        { ...first, stage: 'LOST', version: 2 },
        { ...fixtures[100], version: 2 },
      ]),
    );
    expect(current.deals).toHaveLength(50);
    expect(current.deals[0].stage).toBe('LOST');
    expect(current.deals.some(({ id }) => id === fixtures[100].id)).toBe(false);
    expect(current.total).toBe(125);
    expect(current.needsResultsRefresh).toBe(true);
  });

  it('retains rows and selection on failed refresh, and clears selection after successful retry', async () => {
    await act(() => current.togglePageSelection());
    const page = current.deals;
    api.listDeals.mockRejectedValueOnce(new Error('Offline'));
    await act(() => current.refresh());
    expect(current.deals).toBe(page);
    expect(current.selected.size).toBe(50);
    expect(current.loadError).toContain('Could not load');
    await act(() => current.retryLoad());
    expect(current.selected.size).toBe(0);
    expect(current.loadError).toBe('');
  });

  it('preserves independent confirmed updates received before React renders again', async () => {
    const [first, second] = current.deals;
    await act(() => {
      current.mergeDeal({ ...first, stage: 'LOST', version: 2 });
      current.mergeDeal({ ...second, stage: 'WON', version: 2 });
      current.mergeDeal({ ...first, stage: 'CONTACTED', version: 1 });
    });
    expect(current.deals[0].stage).toBe('LOST');
    expect(current.deals[1].stage).toBe('WON');
    expect(current.deals).toHaveLength(50);
  });

  it('preserves cross-page selections when retrying a failed page request', async () => {
    await act(() => current.togglePageSelection());
    api.listDeals.mockRejectedValueOnce(new Error('Offline'));
    await act(() => current.changePage(1));
    expect(current.deals).toEqual([]);
    expect(current.selected.size).toBe(50);
    await act(() => current.retryLoad());
    expect(current.page).toBe(1);
    expect(current.deals).toHaveLength(50);
    expect(current.selected.size).toBe(50);
  });

  it('ignores old responses when a newer query finishes first', async () => {
    const read = api.listDeals.getMockImplementation();
    let finishOld;
    api.listDeals.mockImplementationOnce(
      (args) =>
        new Promise((resolve) => {
          finishOld = () => read(args).then(resolve);
        }),
    );
    await act(() => {
      current.changePage(1);
    });
    expect(current.isLoading).toBe(true);
    expect(current.deals).toEqual([]);
    await act(() => current.applyQuery({ search: 'Company 124' }));
    expect(current.total).toBe(1);
    expect(current.deals[0].id).toBe('124');
    await act(() => finishOld());
    expect(current.deals[0].id).toBe('124');
    expect(current.total).toBe(1);
  });

  it('sends query and page size to the API and clamps pages against current server results', async () => {
    await act(() => current.changePageSize(100));
    expect(current.deals).toHaveLength(100);
    await act(() => current.changePage(1));
    expect(current.deals).toHaveLength(25);
    await act(() => current.applyQuery({ search: 'Company 12', sort: 'value-desc' }));
    expect(current.page).toBe(0);
    expect(current.total).toBe(6);
    expect(current.deals[0].value).toBe(124);
    expect(api.listDeals).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 0,
        pageSize: 100,
        query: expect.objectContaining({ search: 'Company 12', sort: 'value-desc' }),
      }),
    );
  });
});
