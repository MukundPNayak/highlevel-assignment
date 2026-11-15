// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DealsListPage from './DealsListPage.jsx';
import Pagination from './components/table/Pagination.jsx';
import { createDealsApi } from './api/createDealsApi.js';
import { generateDeals } from './data/generateDeals.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let pageProps;

beforeEach(() => {
  const initialDeals = generateDeals();
  pageProps = {
    api: createDealsApi(initialDeals, { wait: async () => {}, settings: { failureRate: 0 } }),
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function control(name) {
  return [...container.querySelectorAll('label')]
    .find((label) => label.firstChild.textContent.trim() === name)
    .querySelector('input, select');
}

async function choose(name, value) {
  await act(() => {
    const select = control(name);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('deals list discovery and pagination', () => {
  it('renders 50 rows and navigates forward/back without changing the records or losing button focus', async () => {
    await act(() => root.render(<DealsListPage {...pageProps} />));
    const previous = container.querySelector('.pagination button:first-of-type');
    const next = container.querySelector('.pagination button:last-of-type');
    const rows = () => [...container.querySelectorAll('tbody tr')];
    const originalIds = rows().map((row) => row.querySelector('.deal-id').textContent);

    expect(rows()).toHaveLength(50);
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(container.querySelector('[role="status"]').textContent).toBe('1–50 of 50,000 deals');
    expect(container.querySelector('caption').textContent).toContain('Open deals');
    expect(container.querySelectorAll('thead th[scope="col"]')).toHaveLength(7);
    expect(control('Rows per page').value).toBe('50');

    next.focus();
    const scrollRegion = container.querySelector('.table-scroll');
    scrollRegion.scrollTop = 300;
    await act(() => next.click());
    expect(document.activeElement).toBe(next);
    expect(scrollRegion.scrollTop).toBe(300);
    expect(rows()).toHaveLength(50);
    expect(container.querySelector('[role="status"]').textContent).toBe('51–100 of 50,000 deals');
    expect(container.querySelector('.page-number').textContent).toBe('Page 2 of 1,000');
    expect(
      rows().every((row) => !originalIds.includes(row.querySelector('.deal-id').textContent)),
    ).toBe(true);
    expect(previous.disabled).toBe(false);

    await act(() => previous.click());
    expect(rows().map((row) => row.querySelector('.deal-id').textContent)).toEqual(originalIds);
    expect(previous.disabled).toBe(true);
    expect(next.getAttribute('aria-controls')).toBe(container.querySelector('table').id);

    const pageSize = control('Rows per page');
    pageSize.focus();
    await act(() => {
      pageSize.value = '25';
      pageSize.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(document.activeElement).toBe(pageSize);
    expect(rows()).toHaveLength(25);
    expect(container.querySelector('[role="status"]').textContent).toBe('1–25 of 50,000 deals');
    expect(container.querySelector('.page-number').textContent).toBe('Page 1 of 2,000');

    await act(() => next.click());
    expect(container.querySelector('[role="status"]').textContent).toBe('26–50 of 50,000 deals');
    await act(() => {
      pageSize.value = '100';
      pageSize.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(rows()).toHaveLength(100);
    expect(container.querySelector('[role="status"]').textContent).toBe('1–100 of 50,000 deals');
    expect(container.querySelector('.page-number').textContent).toBe('Page 1 of 500');
    expect(previous.disabled).toBe(true);
  }, 15_000); // Full-volume dataset plus DOM rendering; not a browser performance budget.

  it('defaults to all owners, combines filters, resets pages, and clears filters while retaining sort and size', async () => {
    await act(() => root.render(<DealsListPage {...pageProps} />));
    await act(() => container.querySelector('.filter-trigger').click());
    expect(control('Owner').value).toBe('');
    expect(control('Owner').disabled).toBe(false);
    expect(container.querySelector('.count').textContent).toBe('50,000');
    await choose('Owner', 'owner-1');
    expect(container.querySelector('.count').textContent).toBe('50,000');
    expect(container.querySelector('.active-filters')).toBeNull();
    await act(() => container.querySelector('.apply-filters').click());
    expect(
      [...container.querySelectorAll('tbody tr')].every(
        (row) => row.cells[3].textContent === 'Priya Sharma',
      ),
    ).toBe(true);
    await act(() => container.querySelector('.filter-trigger').click());
    await choose('Owner', '');
    await act(() => container.querySelector('.apply-filters').click());
    await choose('Rows per page', '25');
    await act(() => container.querySelector('.pagination button:last-of-type').click());
    expect(container.querySelector('.page-number').textContent).toBe('Page 2 of 2,000');
    await choose('Sort by', 'value-desc');
    expect(container.querySelector('.page-number').textContent).toBe('Page 1 of 2,000');
    expect(container.querySelector('caption').textContent).toContain('Highest value');
    expect(container.querySelector('caption').textContent).not.toContain('Open deals first');

    await act(() => container.querySelector('.filter-trigger').click());
    await choose('Owner', 'owner-2');
    await act(() => container.querySelector('.stage-select summary').click());
    await act(() => container.querySelector('input[value="WON"]').click());
    await act(() => container.querySelector('.apply-filters').click());
    expect(
      [...container.querySelectorAll('tbody tr')].every(
        (row) => row.cells[2].textContent === 'Won' && row.cells[3].textContent === 'Arjun Mehta',
      ),
    ).toBe(true);
    await act(() => container.querySelector('.filter-trigger').click());
    await choose('Inactive for', '90');
    expect(container.querySelector('.filter-help').textContent).toContain(
      'Won and Lost are excluded',
    );
    await act(() => container.querySelector('.apply-filters').click());
    expect(container.querySelector('.empty-state').textContent).toContain(
      'No deals match your filters',
    );
    expect(container.querySelector('.pagination button:last-of-type').disabled).toBe(true);

    await act(() => container.querySelector('.empty-state button').click());
    expect(control('Sort by').value).toBe('value-desc');
    expect(control('Rows per page').value).toBe('25');
    await act(() => container.querySelector('.filter-trigger').click());
    expect(control('Owner').value).toBe('');
    expect(control('Inactive for').value).toBe('');
    expect(container.querySelectorAll('input:checked')).toHaveLength(0);
    expect(container.querySelector('.count').textContent).toBe('50,000');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(25);
  }, 15_000);

  it('debounces search across the full dataset and cancels pending search when filters are cleared', async () => {
    vi.useFakeTimers();
    await act(() => root.render(<DealsListPage {...pageProps} />));
    const search = control('Search deals');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    async function typeSearch(value) {
      await act(() => {
        setValue.call(search, value);
        search.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    await typeSearch('DEAL-50000');
    await act(() => vi.advanceTimersByTime(249));
    expect(container.querySelector('.count').textContent).toBe('50,000');
    await act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('.count').textContent).toBe('1');
    expect(container.querySelector('.deal-id').textContent).toBe('deal-50000');

    await typeSearch('no-such-company');
    await act(() => container.querySelector('.clear-filters').click());
    await act(() => vi.advanceTimersByTime(300));
    expect(search.value).toBe('');
    expect(container.querySelector('.count').textContent).toBe('50,000');
    expect(container.querySelector('.empty-state')).toBeNull();
  }, 15_000);

  it('opens filters with focus, shows removable chips, and dismisses by Escape, focus leaving, or outside click', async () => {
    await act(() => root.render(<DealsListPage {...pageProps} />));
    const trigger = container.querySelector('.filter-trigger');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(control('Owner'));
    expect(container.querySelector('[role="dialog"]').id).toBe(
      trigger.getAttribute('aria-controls'),
    );
    await choose('Owner', 'owner-2');
    await act(() => container.querySelector('.stage-select summary').click());
    await act(() => container.querySelector('input[value="WON"]').click());
    expect(container.querySelector('.filter-count')).toBeNull();

    await act(() => container.querySelector('input[value="CONTACTED"]').click());
    expect(container.querySelector('.stage-select summary').textContent).toContain(
      '2 stages selected',
    );
    expect(container.querySelector('.stage-select details').open).toBe(true);
    await act(() => container.querySelector('input[value="CONTACTED"]').click());
    expect(container.querySelector('.stage-select summary').textContent).toContain('Won');
    await act(() =>
      container
        .querySelector('input[value="WON"]')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(container.querySelector('.stage-select details').open).toBe(false);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement).toBe(container.querySelector('.stage-select summary'));

    await act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(container.querySelector('.active-filters')).toBeNull();
    await act(() => trigger.click());
    expect(control('Owner').value).toBe('');
    expect(container.querySelector('.stage-select summary').textContent).toContain('All stages');
    await choose('Owner', 'owner-2');
    await act(() => container.querySelector('.stage-select summary').click());
    await act(() => container.querySelector('input[value="WON"]').click());
    await act(() => container.querySelector('.apply-filters').click());
    expect(container.querySelector('.filter-count').textContent).toBe('2');
    expect(container.querySelector('.active-filters').textContent).toContain('Arjun Mehta');
    expect(container.querySelector('.active-filters').textContent).toContain('Won');
    await act(() => container.querySelector('[aria-label="Remove owner filter"]').click());
    expect(container.querySelector('.filter-count').textContent).toBe('1');
    expect(container.querySelector('[aria-label="Remove owner filter"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(() => trigger.click());
    expect(control('Owner').value).toBe('');
    expect(container.querySelector('.stage-select summary').textContent).toContain('Won');
    expect(container.querySelector('input[value="WON"]').checked).toBe(true);
    await choose('Owner', 'owner-1');
    await act(() => control('Search deals').focus());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(control('Search deals'));

    await act(() => trigger.click());
    expect(control('Owner').value).toBe('');
    await choose('Inactive for', '7');
    await act(() =>
      container.querySelector('table').dispatchEvent(new Event('pointerdown', { bubbles: true })),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(() => trigger.click());
    expect(control('Inactive for').value).toBe('');
    await act(() => container.querySelector('[aria-label="Close filters"]').click());
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await act(() => container.querySelector('[aria-label="Remove Won filter"]').click());
    expect(container.querySelector('.active-filters')).toBeNull();
    expect(container.querySelector('.filter-count')).toBeNull();
    expect(container.querySelector('.count').textContent).toBe('50,000');
  }, 15_000);

  it('preserves the page and selection while drafting and resets them only when filters are applied', async () => {
    await act(() => root.render(<DealsListPage {...pageProps} />));
    await act(() => container.querySelector('.pagination button:last-of-type').click());
    await act(() => container.querySelector('.row-select').click());
    await act(() => container.querySelector('.filter-trigger').click());
    await choose('Owner', 'owner-1');
    await choose('Inactive for', '7');
    await act(() => container.querySelector('.stage-select summary').click());
    await act(() => container.querySelector('input[value="NEW_LEAD"]').click());
    expect(container.querySelector('.page-number').textContent).toBe('Page 2 of 1,000');
    expect(container.querySelector('.row-select').checked).toBe(true);
    expect(container.querySelector('.count').textContent).toBe('50,000');
    expect(container.querySelector('.active-filters')).toBeNull();
    await act(() => container.querySelector('.apply-filters').click());
    expect(container.querySelector('.page-number').textContent).toMatch(/^Page 1 of /);
    expect(container.querySelector('.bulk-action-bar')).toBeNull();
    expect(container.querySelector('.count').textContent).not.toBe('50,000');
    expect(container.querySelector('.filter-count').textContent).toBe('3');
    expect(
      [...container.querySelectorAll('tbody tr')].every(
        (row) =>
          row.cells[2].textContent === 'New Lead' && row.cells[3].textContent === 'Priya Sharma',
      ),
    ).toBe(true);
  }, 15_000);

  it('disables Next on page 1,000 and emits a valid Previous page', async () => {
    const onPageChange = vi.fn();
    await act(() =>
      root.render(
        <Pagination page={999} pageSize={50} total={50_000} onPageChange={onPageChange} />,
      ),
    );
    const [previous, next] = container.querySelectorAll('button');
    expect(container.querySelector('[role="status"]').textContent).toBe(
      '49,951–50,000 of 50,000 deals',
    );
    expect(container.querySelector('.page-number').textContent).toBe('Page 1,000 of 1,000');
    expect(next.disabled).toBe(true);
    await act(() => next.click());
    expect(onPageChange).not.toHaveBeenCalled();
    await act(() => previous.click());
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(998);
  });

  it('reports an accurate partial last page and an empty result range', async () => {
    await act(() =>
      root.render(<Pagination page={1} pageSize={50} total={73} onPageChange={() => {}} />),
    );
    expect(container.querySelector('[role="status"]').textContent).toBe('51–73 of 73 deals');
    expect(container.querySelector('button:last-of-type').disabled).toBe(true);

    await act(() =>
      root.render(<Pagination page={0} pageSize={50} total={0} onPageChange={() => {}} />),
    );
    expect(container.querySelector('[role="status"]').textContent).toBe('0–0 of 0 deals');
    expect([...container.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
  });
});
