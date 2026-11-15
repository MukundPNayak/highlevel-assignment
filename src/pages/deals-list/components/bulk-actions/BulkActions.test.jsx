// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import DealsListPage from '../../DealsListPage.jsx';
import { createDealsApi } from '../../api/createDealsApi.js';
import { generateDeals } from '../../data/generateDeals.js';

const harness = vi.hoisted(() => ({ api: null, creationCount: 0 }));
vi.mock('../../api/createDealsApi.js', async (importOriginal) => {
  const { createDealsApi } = await importOriginal();
  return {
    createDealsApi(deals) {
      harness.creationCount += 1;
      const api = createDealsApi(deals, { wait: async () => {} });
      for (const method of ['listDeals', 'getDeal', 'updateDealStage', 'bulkUpdateDealStage'])
        api[method] = vi.fn(api[method]);
      harness.api = api;
      return api;
    },
  };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
let container;
let root;
let random;

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.open = true;
    },
  });
});
afterAll(() => {
  if (originalShowModal)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal);
  else delete HTMLDialogElement.prototype.showModal;
});
beforeEach(async () => {
  harness.creationCount = 0;
  random = vi.spyOn(Math, 'random').mockReturnValue(0.9);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  const initialDeals = generateDeals();
  const api = createDealsApi(initialDeals);
  await act(() => root.render(<DealsListPage api={api} />));
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  random.mockRestore();
});

const rowBoxes = () => [...container.querySelectorAll('.row-select')];
const headerBox = () => container.querySelector('thead input[type="checkbox"]');
const summaryButton = (text) =>
  [...container.querySelectorAll('.bulk-summary button')].find((button) =>
    button.textContent.includes(text),
  );

async function openBulk(targetStage = 'LOST') {
  await act(() => container.querySelector('.bulk-change-stage').click());
  const dialog = document.querySelector('dialog');
  expect(dialog.querySelector('select').value).toBe('');
  expect(
    [...dialog.querySelectorAll('button')].find((button) => button.textContent.startsWith('Save'))
      .disabled,
  ).toBe(true);
  await act(() => {
    dialog.querySelector('select').value = targetStage;
    dialog.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
  });
  return dialog;
}

describe('manual bulk selection across pages', () => {
  it('selects the current page, supports partial/keyboard selection, preserves navigation, and cancels without API calls', async () => {
    expect(rowBoxes()).toHaveLength(50);
    expect(headerBox().checked).toBe(false);
    await act(() => rowBoxes()[0].click());
    expect(headerBox().indeterminate).toBe(true);
    expect(container.querySelector('.bulk-action-bar').textContent).toContain(
      '1 selected · 1 on this page',
    );
    rowBoxes()[0].focus();
    await act(() =>
      rowBoxes()[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      ),
    );
    expect(document.activeElement).toBe(rowBoxes()[1]);
    await act(() => headerBox().click());
    expect(rowBoxes().every((input) => input.checked)).toBe(true);
    expect(headerBox().indeterminate).toBe(false);
    expect(container.querySelector('.bulk-action-bar').textContent).toContain(
      '50 selected · 50 on this page',
    );
    await act(() => headerBox().click());
    expect(container.querySelector('.bulk-action-bar')).toBeNull();
    await act(() => rowBoxes()[0].click());
    const dialog = await openBulk();
    await act(() => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('.bulk-change-stage'));
    expect(rowBoxes()[0].checked).toBe(true);
    expect(harness.api.bulkUpdateDealStage).not.toHaveBeenCalled();
    expect(harness.api.getDeal).not.toHaveBeenCalled();
    await act(() => container.querySelector('.pagination button:last-of-type').click());
    expect(rowBoxes().every((input) => !input.checked)).toBe(true);
    expect(container.querySelector('.bulk-action-bar').textContent).toContain(
      '1 selected · 0 on this page · 1 on other pages',
    );
    await act(() => headerBox().click());
    expect(container.querySelector('.bulk-action-bar').textContent).toContain(
      '51 selected · 50 on this page · 1 on other pages',
    );
    await act(() => headerBox().click());
    expect(container.querySelector('.bulk-action-bar').textContent).toContain(
      '1 selected · 0 on this page',
    );
    await act(() => container.querySelector('.pagination button:first-of-type').click());
    expect(rowBoxes()[0].checked).toBe(true);
    expect(headerBox().indeterminate).toBe(true);
    expect(harness.creationCount).toBe(1);
  }, 15_000);

  it('preserves 50 selections on each of two pages and sends all 100 in one bulk request', async () => {
    await act(() => headerBox().click());
    const firstIds = [...container.querySelectorAll('.deal-id')].map(
      (element) => element.textContent,
    );
    await act(() => container.querySelector('.pagination button:last-of-type').click());
    expect(headerBox().checked).toBe(false);
    await act(() => headerBox().click());
    const secondIds = [...container.querySelectorAll('.deal-id')].map(
      (element) => element.textContent,
    );
    expect(container.querySelector('.bulk-action-bar').textContent).toContain(
      '100 selected · 50 on this page · 50 on other pages',
    );
    await act(() => container.querySelector('.pagination button:first-of-type').click());
    expect(headerBox().checked).toBe(true);
    expect(rowBoxes().every((checkbox) => checkbox.checked)).toBe(true);
    const dialog = await openBulk();
    expect(dialog.textContent).toContain('including selections on other pages');
    await act(() =>
      [...dialog.querySelectorAll('button')]
        .find((button) => button.textContent === 'Save 100 deals')
        .click(),
    );
    expect(harness.api.bulkUpdateDealStage).toHaveBeenCalledTimes(1);
    const inputs = harness.api.bulkUpdateDealStage.mock.calls[0][0].deals;
    expect(inputs).toEqual([...firstIds, ...secondIds].map((id) => ({ id, expectedVersion: 1 })));
    expect(container.querySelector('.bulk-summary').textContent).toContain(
      '100 processed · 100 saved',
    );
    expect(container.querySelector('.bulk-action-bar')).toBeNull();
    expect(
      [...container.querySelectorAll('tbody .stage')].every(
        (element) => element.textContent === 'Lost',
      ),
    ).toBe(true);
    const readsBeforeNavigation = harness.api.listDeals.mock.calls.length;
    await act(() => container.querySelector('.pagination button:last-of-type').click());
    expect(harness.api.listDeals).toHaveBeenCalledTimes(readsBeforeNavigation + 1);
    // Navigation fetches the newly sorted page; closed deals have moved to the end.
    expect(
      [...container.querySelectorAll('tbody .deal-id')].some((element) =>
        [...firstIds, ...secondIds].includes(element.textContent),
      ),
    ).toBe(false);
    expect(rowBoxes().every((checkbox) => !checkbox.checked)).toBe(true);
    expect((await harness.api.getDeal(secondIds[0])).stage).toBe('LOST');
  }, 15_000);

  it('closes the modal, merges only successful rows, and retries only failed inputs without fetching latest deals', async () => {
    const rows = [...container.querySelectorAll('tbody tr')];
    const ids = rows.slice(0, 2).map((row) => row.querySelector('.deal-id').textContent);
    const oldStage = rows[0].querySelector('.stage').textContent;
    await act(() => rowBoxes()[0].click());
    await act(() => rowBoxes()[1].click());
    const dialog = await openBulk();
    // One latency draw, then one failure and one success.
    random.mockReturnValueOnce(0.9).mockReturnValueOnce(0.01).mockReturnValueOnce(0.9);
    const save = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === 'Save 2 deals',
    );
    await act(() => {
      save.click();
      save.click();
    });
    expect(harness.api.bulkUpdateDealStage).toHaveBeenCalledTimes(1);
    expect(harness.api.getDeal).not.toHaveBeenCalled();
    expect(harness.api.updateDealStage).not.toHaveBeenCalled();
    expect(document.querySelector('dialog')).toBeNull();
    expect(container.querySelector('.bulk-summary').textContent).toContain('2 processed · 1 saved');
    expect(container.querySelector('.bulk-summary').textContent).toContain('1 failed');
    expect(rows[0].querySelector('.stage').textContent).toBe(oldStage);
    expect(rows[1].querySelector('.stage').textContent).toBe('Lost');
    expect(rowBoxes().every((input) => !input.checked)).toBe(true);
    await act(() => summaryButton('Retry 1 failed').click());
    expect(harness.api.bulkUpdateDealStage).toHaveBeenCalledTimes(2);
    expect(harness.api.bulkUpdateDealStage.mock.calls[1][0]).toEqual({
      deals: [{ id: ids[0], expectedVersion: 1 }],
      targetStage: 'LOST',
    });
    expect(container.querySelector('.bulk-summary').textContent).toContain('2 processed · 2 saved');
    expect(summaryButton('Retry')).toBeUndefined();
    expect(rows[0].querySelector('.stage').textContent).toBe('Lost');
    expect((await harness.api.getDeal(ids[1])).version).toBe(2);
    expect(document.activeElement).toBe(container.querySelector('#deals-heading'));
  }, 15_000);

  it('reports conflicts without retrying them and requires a deliberate new selection', async () => {
    const row = container.querySelector('tbody tr');
    const id = row.querySelector('.deal-id').textContent;
    await act(() => rowBoxes()[0].click());
    await harness.api.updateDealStage({ id, expectedVersion: 1, targetStage: 'WON' });
    const dialog = await openBulk();
    await act(() =>
      [...dialog.querySelectorAll('button')]
        .find((button) => button.textContent === 'Save 1 deal')
        .click(),
    );
    expect(row.querySelector('.stage').textContent).toBe('Won');
    expect(container.querySelector('.bulk-summary').textContent).toContain('1 conflicts');
    expect(summaryButton('Retry')).toBeUndefined();
    expect(harness.api.bulkUpdateDealStage.mock.calls[0][0].deals).toEqual([
      { id, expectedVersion: 1 },
    ]);
    await act(() => rowBoxes()[0].click());
    expect(container.querySelector('.bulk-change-stage').disabled).toBe(true);
    await act(() => summaryButton('Dismiss results').click());
    expect(container.querySelector('.bulk-change-stage').disabled).toBe(false);
    const freshDialog = await openBulk();
    await act(() =>
      [...freshDialog.querySelectorAll('button')]
        .find((button) => button.textContent === 'Save 1 deal')
        .click(),
    );
    expect(harness.api.bulkUpdateDealStage.mock.calls[1][0].deals).toEqual([
      { id, expectedVersion: 2 },
    ]);
    expect(row.querySelector('.stage').textContent).toBe('Lost');
  }, 15_000);

  it('retains retryable outcomes if the whole request rejects', async () => {
    await act(() => rowBoxes()[0].click());
    harness.api.bulkUpdateDealStage.mockRejectedValueOnce(new Error('Unavailable'));
    const dialog = await openBulk();
    await act(() =>
      [...dialog.querySelectorAll('button')]
        .find((button) => button.textContent === 'Save 1 deal')
        .click(),
    );
    expect(document.querySelector('dialog')).toBeNull();
    expect(container.querySelector('.bulk-summary').textContent).toContain('1 failed');
    await act(() => summaryButton('Retry 1 failed').click());
    expect(container.querySelector('.bulk-summary').textContent).toContain('1 saved');
  }, 15_000);

  it('blocks dismissal and duplicate saves while a bulk request is pending', async () => {
    const row = container.querySelector('tbody tr');
    const oldStage = row.querySelector('.stage').textContent;
    const execute = harness.api.bulkUpdateDealStage.getMockImplementation();
    let finish;
    harness.api.bulkUpdateDealStage.mockImplementationOnce(
      (input) =>
        new Promise((resolve) => {
          finish = () => execute(input).then(resolve);
        }),
    );
    await act(() => rowBoxes()[0].click());
    const dialog = await openBulk();
    const save = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === 'Save 1 deal',
    );
    await act(() => {
      save.click();
      save.click();
    });
    expect(harness.api.bulkUpdateDealStage).toHaveBeenCalledTimes(1);
    expect(row.querySelector('.stage').textContent).toBe(oldStage);
    expect(dialog.querySelector('select').disabled).toBe(true);
    expect([...dialog.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
    expect(rowBoxes().every((checkbox) => checkbox.disabled)).toBe(true);
    expect(container.querySelector('.deal-actions-trigger').disabled).toBe(true);
    await act(() => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(document.querySelector('dialog')).toBe(dialog);
    await act(() => finish());
    expect(document.querySelector('dialog')).toBeNull();
    expect(row.querySelector('.stage').textContent).toBe('Lost');
    expect(headerBox().disabled).toBe(false);
    expect(container.querySelector('.bulk-summary').textContent).toContain('1 saved');
  }, 15_000);

  it('refreshes authoritative results on demand while preserving filters/page and preventing duplicate reads', async () => {
    await act(() => container.querySelector('.filter-trigger').click());
    await act(() => container.querySelector('.stage-select summary').click());
    await act(() => container.querySelector('input[value="NEW_LEAD"]').click());
    await act(() => container.querySelector('.apply-filters').click());
    await act(() => container.querySelector('.pagination button:last-of-type').click());
    await act(() => rowBoxes()[0].click());
    const id = container.querySelector('tbody .deal-id').textContent;
    await harness.api.updateDealStage({ id, targetStage: 'LOST', expectedVersion: 1 });
    harness.api.listDeals.mockClear();
    const read = harness.api.listDeals.getMockImplementation();
    let finish;
    harness.api.listDeals.mockImplementationOnce(
      (args) =>
        new Promise((resolve) => {
          finish = () => read(args).then(resolve);
        }),
    );
    const refresh = container.querySelector('.refresh-deals');
    refresh.focus();
    await act(() => {
      refresh.click();
      refresh.click();
    });
    expect(harness.api.listDeals).toHaveBeenCalledTimes(1);
    expect(refresh.disabled).toBe(true);
    expect(refresh.textContent).toContain('Refreshing');
    expect(container.querySelector('.count').textContent).toBe('12,000');
    expect(rowBoxes()[0].checked).toBe(true);
    await act(() => finish());
    expect(container.querySelector('.count').textContent).toBe('11,999');
    expect(container.querySelector('.page-number').textContent).toMatch(/^Page 2 of /);
    expect(container.querySelector('.active-filters').textContent).toContain('New Lead');
    expect(
      [...container.querySelectorAll('tbody .deal-id')].some(
        (element) => element.textContent === id,
      ),
    ).toBe(false);
    expect(container.querySelector('.bulk-action-bar')).toBeNull();
    expect(refresh.disabled).toBe(false);
    expect(document.activeElement).toBe(refresh);
    await act(() => refresh.click());
    expect(harness.api.listDeals).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.count').textContent).toBe('11,999');
  }, 15_000);

  it('preserves rows and selection when refresh fails and supports retrying with the same button', async () => {
    await act(() => rowBoxes()[0].click());
    const dialog = await openBulk();
    await act(() =>
      [...dialog.querySelectorAll('button')]
        .find((button) => button.textContent === 'Save 1 deal')
        .click(),
    );
    expect(container.querySelector('.results-notice')).not.toBeNull();
    await act(() => rowBoxes()[0].click());
    const ids = [...container.querySelectorAll('.deal-id')].map((element) => element.textContent);
    harness.api.listDeals.mockRejectedValueOnce(new Error('Read unavailable'));
    const refresh = container.querySelector('.notice-refresh');
    await act(() => refresh.click());
    expect(container.querySelector('.refresh-error').textContent).toContain('Could not load deals');
    expect(
      [...container.querySelectorAll('.deal-id')].map((element) => element.textContent),
    ).toEqual(ids);
    expect(rowBoxes()[0].checked).toBe(true);
    expect(refresh.disabled).toBe(false);
    expect(container.querySelector('.results-notice')).not.toBeNull();
    await act(() => refresh.click());
    expect(container.querySelector('.refresh-error')).toBeNull();
    expect(container.querySelector('.results-notice')).toBeNull();
    expect(container.querySelector('.bulk-action-bar')).toBeNull();
  }, 15_000);
});
