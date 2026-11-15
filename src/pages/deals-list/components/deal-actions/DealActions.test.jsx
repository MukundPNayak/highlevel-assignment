// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { STAGES } from '../../constants/stages.js';
import { createDealsApi } from '../../api/createDealsApi.js';
import DealActions from './DealActions.jsx';
import DealsListPage from '../../DealsListPage.jsx';
import { generateDeals } from '../../data/generateDeals.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container;
let root;
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');

beforeAll(() => {
  // JSDOM does not implement the browser's modal top layer or native focus trap.
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

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
});

describe('deal action UI', () => {
  it('opens a single-item menu by keyboard, restores focus on Escape, and dismisses outside clicks', async () => {
    await act(() =>
      root.render(<DealActions deal={{ id: 'deal-1', companyName: 'Acme', stage: 'CONTACTED' }} />),
    );
    const trigger = container.querySelector('button');
    trigger.focus();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await act(() =>
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })),
    );
    const item = document.querySelector('[role="menuitem"]');
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(1);
    expect(item.textContent).toBe('Change stage');
    expect(document.activeElement).toBe(item);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await act(() =>
      item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(() => trigger.click());
    await act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it.each(['NEW_LEAD', 'WON', 'LOST'])(
    'preselects %s, allows every target, and cancels without changing the deal',
    async (stage) => {
      const deal = Object.freeze({
        id: 'deal-1',
        companyName: 'Acme Technologies',
        stage,
        version: 1,
      });
      const api = createDealsApi([deal], { wait: async () => {}, settings: { failureRate: 0 } });
      await act(() =>
        root.render(
          <DealActions deal={deal} api={api} onDealConfirmed={vi.fn()} onSaved={vi.fn()} />,
        ),
      );
      const trigger = container.querySelector('button');
      async function openDialog() {
        await act(() => trigger.click());
        await act(() => document.querySelector('[role="menuitem"]').click());
      }
      await openDialog();
      let dialog = document.querySelector('dialog');
      expect(dialog.open).toBe(true);
      expect(dialog.textContent).toContain('Acme Technologies');
      expect(dialog.querySelector('select').value).toBe(stage);
      expect([...dialog.querySelectorAll('option')].map(({ value }) => value)).toEqual(
        STAGES.map(({ id }) => id),
      );
      expect(document.activeElement.textContent).toBe('Cancel');
      expect(
        [...dialog.querySelectorAll('button')].find((button) => button.textContent === 'Save stage')
          .disabled,
      ).toBe(true);

      const target = stage === 'NEW_LEAD' ? 'LOST' : 'NEW_LEAD';
      await act(() => {
        const select = dialog.querySelector('select');
        select.value = target;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(dialog.querySelector('select').value).toBe(target);
      expect(
        [...dialog.querySelectorAll('button')].find((button) => button.textContent === 'Save stage')
          .disabled,
      ).toBe(false);
      expect(deal.stage).toBe(stage);
      await act(() =>
        [...dialog.querySelectorAll('button')]
          .find((button) => button.textContent === 'Cancel')
          .click(),
      );
      expect(document.querySelector('dialog')).toBeNull();
      expect(document.activeElement).toBe(trigger);

      await openDialog();
      dialog = document.querySelector('dialog');
      expect(dialog.querySelector('select').value).toBe(stage);
      await act(() => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
      expect(document.querySelector('dialog')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(deal.stage).toBe(stage);
    },
  );

  it('loads the authoritative stage instead of the table stage and merges the full successful response', async () => {
    const tableDeal = { id: 'deal-1', companyName: 'Acme', stage: 'NEW_LEAD', version: 1 };
    const latest = {
      ...tableDeal,
      stage: 'WON',
      version: 3,
      value: 1000,
      ownerId: 'owner-1',
      updatedAt: 100,
    };
    const api = createDealsApi([latest], {
      wait: async () => {},
      now: () => 200,
      settings: { failureRate: 0 },
    });
    const onDealConfirmed = vi.fn();
    const onSaved = vi.fn();
    await act(() =>
      root.render(
        <DealActions
          deal={tableDeal}
          api={api}
          onDealConfirmed={onDealConfirmed}
          onSaved={onSaved}
        />,
      ),
    );
    await act(() => container.querySelector('button').click());
    await act(() => document.querySelector('[role="menuitem"]').click());
    const dialog = document.querySelector('dialog');
    expect(dialog.querySelector('select').value).toBe('WON');
    expect(onDealConfirmed).toHaveBeenCalledWith(latest);
    await act(() => {
      const select = dialog.querySelector('select');
      select.value = 'CONTACTED';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      [...dialog.querySelectorAll('button')]
        .find((button) => button.textContent === 'Save stage')
        .click();
    });
    const saved = { ...latest, stage: 'CONTACTED', version: 4, updatedAt: 200 };
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(onDealConfirmed).toHaveBeenLastCalledWith(saved);
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('button'));
  });

  it('prevents duplicate saves and dismissal during saving, then retries failures without changing the displayed deal', async () => {
    let finishSave;
    const deal = { id: 'deal-1', companyName: 'Acme', stage: 'NEW_LEAD', version: 1 };
    const api = {
      getDeal: vi.fn().mockResolvedValue(deal),
      updateDealStage: vi.fn(
        () =>
          new Promise((resolve) => {
            finishSave = resolve;
          }),
      ),
    };
    const onSaved = vi.fn();
    await act(() =>
      root.render(
        <DealActions deal={deal} api={api} onDealConfirmed={vi.fn()} onSaved={onSaved} />,
      ),
    );
    await act(() => container.querySelector('button').click());
    await act(() => document.querySelector('[role="menuitem"]').click());
    const dialog = document.querySelector('dialog');
    await act(() => {
      const select = dialog.querySelector('select');
      select.value = 'LOST';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const save = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === 'Save stage',
    );
    await act(() => {
      save.click();
      save.click();
    });
    expect(api.updateDealStage).toHaveBeenCalledTimes(1);
    expect(dialog.querySelector('select').disabled).toBe(true);
    expect([...dialog.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
    await act(() => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(document.querySelector('dialog')).toBe(dialog);
    await act(() => finishSave({ kind: 'network-error', message: 'Failed before commit.' }));
    expect(dialog.querySelector('[role="alert"]').textContent).toBe('Failed before commit.');
    expect(dialog.querySelector('select').value).toBe('LOST');
    expect(onSaved).not.toHaveBeenCalled();
    await act(() =>
      [...dialog.querySelectorAll('button')]
        .find((button) => button.textContent === 'Retry save')
        .click(),
    );
    expect(api.updateDealStage.mock.calls[1][0]).toEqual({
      id: deal.id,
      expectedVersion: 1,
      targetStage: 'LOST',
    });
    await act(() => finishSave({ kind: 'success', deal: { ...deal, stage: 'LOST', version: 2 } }));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('requires explicit review of a conflict and preserves the chosen target', async () => {
    const deal = { id: 'deal-1', companyName: 'Acme', stage: 'NEW_LEAD', version: 1 };
    const latest = { ...deal, stage: 'CONTACTED', version: 2 };
    const api = {
      getDeal: vi.fn().mockResolvedValue(deal),
      updateDealStage: vi
        .fn()
        .mockResolvedValueOnce({ kind: 'conflict', latest, message: 'Changed by another user.' })
        .mockResolvedValueOnce({ kind: 'success', deal: { ...latest, stage: 'WON', version: 3 } }),
    };
    const merge = vi.fn();
    await act(() =>
      root.render(<DealActions deal={deal} api={api} onDealConfirmed={merge} onSaved={vi.fn()} />),
    );
    await act(() => container.querySelector('button').click());
    await act(() => document.querySelector('[role="menuitem"]').click());
    const dialog = document.querySelector('dialog');
    const button = (text) =>
      [...dialog.querySelectorAll('button')].find((item) => item.textContent === text);
    await act(() => {
      dialog.querySelector('select').value = 'WON';
      dialog.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(() => button('Save stage').click());
    expect(dialog.querySelector('[role="alert"]').textContent).toBe('Changed by another user.');
    expect(dialog.querySelector('select').value).toBe('WON');
    expect(button('Save stage').disabled).toBe(true);
    expect(merge).toHaveBeenLastCalledWith(latest);
    await act(() => button('Review latest stage').click());
    expect(button('Save stage').disabled).toBe(false);
    await act(() => button('Save stage').click());
    expect(api.updateDealStage).toHaveBeenLastCalledWith({
      id: deal.id,
      expectedVersion: 2,
      targetStage: 'WON',
    });
  });

  it('keeps loading explicit, supports fetch retry, and ignores a fetch completed after cancellation', async () => {
    const deal = { id: 'deal-1', companyName: 'Acme', stage: 'NEW_LEAD', version: 1 };
    let finishLoad;
    const merge = vi.fn();
    const api = {
      getDeal: vi
        .fn()
        .mockRejectedValueOnce(new Error('Read unavailable.'))
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              finishLoad = resolve;
            }),
        ),
    };
    await act(() =>
      root.render(<DealActions deal={deal} api={api} onDealConfirmed={merge} onSaved={vi.fn()} />),
    );
    await act(() => container.querySelector('button').click());
    await act(() => document.querySelector('[role="menuitem"]').click());
    const dialog = document.querySelector('dialog');
    expect(dialog.querySelector('[role="alert"]').textContent).toBe('Read unavailable.');
    await act(() =>
      [...dialog.querySelectorAll('button')]
        .find((button) => button.textContent === 'Retry loading')
        .click(),
    );
    expect(dialog.querySelector('select')).toBeNull();
    expect(dialog.querySelector('[role="status"]').textContent).toContain('Loading latest');
    await act(() =>
      [...dialog.querySelectorAll('button')]
        .find((button) => button.textContent === 'Cancel')
        .click(),
    );
    await act(() => finishLoad({ ...deal, stage: 'WON', version: 2 }));
    expect(document.querySelector('dialog')).toBeNull();
    expect(merge).not.toHaveBeenCalled();
  });

  it('saves from the table, preserves row position and scrolling, and reapplies stage filtering on explicit refresh', async () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const initialDeals = generateDeals();
      const api = createDealsApi(initialDeals);
      await act(() => root.render(<DealsListPage api={api} />));
      await act(() => vi.runOnlyPendingTimers());
      await act(() => container.querySelector('.filter-trigger').click());
      await act(() => container.querySelector('.stage-select summary').click());
      await act(() => container.querySelector('input[value="NEW_LEAD"]').click());
      await act(() => container.querySelector('.apply-filters').click());
      await act(() => vi.runOnlyPendingTimers());
      expect(container.querySelector('.count').textContent).toBe('12,000');
      const firstRow = container.querySelector('tbody tr');
      const originalId = firstRow.querySelector('.deal-id').textContent;
      const scroller = container.querySelector('.table-scroll');
      scroller.scrollTop = 123;
      await act(() => firstRow.querySelector('.deal-actions-trigger').click());
      await act(() => document.querySelector('[role="menuitem"]').click());
      await act(() => vi.runOnlyPendingTimers());
      const dialog = document.querySelector('dialog');
      expect(dialog.querySelector('select').value).toBe('NEW_LEAD');
      expect(container.querySelector('.results-notice')).toBeNull();
      await act(() => {
        dialog.querySelector('select').value = 'LOST';
        dialog.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
      });
      await act(() =>
        [...dialog.querySelectorAll('button')]
          .find((button) => button.textContent === 'Save stage')
          .click(),
      );
      expect(firstRow.querySelector('.stage').textContent).toBe('New Lead');
      await act(() => vi.runOnlyPendingTimers());
      expect(document.querySelector('dialog')).toBeNull();
      expect(container.querySelector('tbody tr .deal-id').textContent).toBe(originalId);
      expect(firstRow.querySelector('.stage').textContent).toBe('Lost');
      expect(container.querySelector('.results-notice').textContent).toContain(
        'Deal values updated. Refresh to update the results count and order.',
      );
      expect(scroller.scrollTop).toBe(123);
      expect(container.querySelector('.count').textContent).toBe('12,000');
      expect(container.querySelector('.success-toast').textContent).toContain('moved to Lost');
      const refresh = container.querySelector('.notice-refresh');
      refresh.focus();
      await act(() => refresh.click());
      expect(refresh.disabled).toBe(true);
      expect(container.querySelector('.refresh-deals').disabled).toBe(true);
      await act(() => vi.runOnlyPendingTimers());
      expect(container.querySelector('.count').textContent).toBe('11,999');
      expect(container.querySelector('tbody tr .deal-id').textContent).not.toBe(originalId);
      expect(container.querySelector('.results-notice')).toBeNull();
      expect(document.activeElement).toBe(scroller);
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  }, 15_000);
});
