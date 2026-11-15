import { useState, useRef, useCallback, useEffect } from 'react';
import { SORT_OPTIONS } from './constants/filters.js';
import { STAGE_LABELS } from './constants/stages.js';
import { OWNERS, OWNERS_BY_ID } from './constants/mockData.js';
import DealTable from './components/table/DealTable.jsx';
import Pagination from './components/table/Pagination.jsx';
import DealsListToolbar from './components/filters/DealsListToolbar.jsx';
import BulkStageDialog from './components/bulk-actions/BulkStageDialog.jsx';
import BulkOperationSummary from './components/bulk-actions/BulkOperationSummary.jsx';
import { useBulkStageChange } from './hooks/useBulkStageChange.js';
import { useDealsList } from './hooks/useDealsList/useDealsList.js';
import './deals-list.css';

export default function DealsListPage({ api }) {
  const [searchText, setSearchText] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [bulkDialog, setBulkDialog] = useState(null);

  const heading = useRef(null);
  const bulkTrigger = useRef(null);
  const refreshFocusTarget = useRef(null);

  const handleSaved = useCallback(
    (deal) => setSuccessMessage(`${deal.companyName} moved to ${STAGE_LABELS[deal.stage]}.`),
    [],
  );

  const {
    deals,
    total,
    isLoading,
    loadError,
    retryLoad,
    query,
    page,
    pageSize,
    selected,
    needsResultsRefresh,
    mergeDeal,
    mergeDeals,
    applyQuery,
    refresh,
    changePage,
    changePageSize,
    toggleSelection,
    togglePageSelection,
    clearSelection,
  } = useDealsList(api);

  const {
    operation,
    changeSelectedDealsStage,
    retry: retryBulkStageChange,
    dismiss: dismissBulkResults,
    isSaving: isBulkSaving,
  } = useBulkStageChange(api, mergeDeals);

  const selectedOnPage = deals.filter(({ id }) => selected.has(id)).length;
  const hasUnresolvedResults = operation?.results.some(
    ({ kind }) => !['success', 'noop'].includes(kind),
  );
  const sortLabel = SORT_OPTIONS.find(({ id }) => id === query.sort).label;
  const orderDescription = `${query.sort.startsWith('activity-') ? 'Open deals first · ' : ''}${sortLabel}`;

  useEffect(() => {
    if (searchText === query.search) return;
    const timeout = setTimeout(() => {
      applyQuery({ search: searchText });
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchText, query.search, applyQuery]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = setTimeout(() => setSuccessMessage(''), 5000);
    return () => clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    if (!isLoading && refreshFocusTarget.current) {
      const source = refreshFocusTarget.current;
      refreshFocusTarget.current = null;
      if (document.activeElement === document.body || document.activeElement === source) {
        if (source.isConnected) source.focus();
        else
          document
            .getElementById('deals-table')
            ?.closest('[role="region"]')
            ?.focus({ preventScroll: true });
      }
    }
  }, [isLoading]);

  async function refreshResults(event) {
    if (isLoading || isBulkSaving || bulkDialog) return;
    refreshFocusTarget.current =
      document.activeElement === event.currentTarget ? event.currentTarget : null;
    await refresh();
  }

  function clearFilters() {
    setSearchText('');
    applyQuery({ search: '', stages: [], ownerId: '', inactiveDays: '' });
  }

  function handlePageSizeChange(event) {
    changePageSize(Number(event.target.value));
  }

  async function confirmBulk(targetStage) {
    clearSelection();
    const completed = await changeSelectedDealsStage(bulkDialog, targetStage);
    if (completed) {
      setBulkDialog(null);
      heading.current.focus();
    }
  }

  return (
    <main className="deals-list">
      <header className="page-header">
        <p className="eyebrow">OPPORTUNITIES</p>
        <div className="heading-line">
          <h1>Deals List</h1>
        </div>
        <p className="page-description">Find and prioritize your team’s opportunities.</p>
      </header>

      <section className="deals-panel" aria-labelledby="deals-heading">
        <div className="table-heading">
          <div>
            <h2 ref={heading} tabIndex={-1} id="deals-heading">
              Deals <span className="count">{total.toLocaleString('en-IN')}</span>
            </h2>
            <p id="table-order">{orderDescription}</p>
          </div>
          <button
            className="refresh-deals"
            type="button"
            disabled={isLoading || isBulkSaving || Boolean(bulkDialog)}
            aria-busy={isLoading}
            onClick={refreshResults}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 7v5h-5M4 17v-5h5" />
              <path d="M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 17.9 17" />
            </svg>
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {loadError && (
          <p className="refresh-error" role="alert">
            {loadError}{' '}
            <button type="button" onClick={retryLoad} disabled={isLoading}>
              Retry loading
            </button>
          </p>
        )}
        <DealsListToolbar
          query={query}
          searchText={searchText}
          owners={OWNERS}
          onSearchChange={setSearchText}
          onQueryChange={applyQuery}
          onClear={clearFilters}
        />
        {selected.size > 0 && (
          <div className="bulk-action-bar" aria-label="Selected deals">
            <span>
              {selected.size} selected · {selectedOnPage} on this page
              {selected.size > selectedOnPage &&
                ` · ${selected.size - selectedOnPage} on other pages`}
            </span>
            <button
              ref={bulkTrigger}
              className="bulk-change-stage"
              type="button"
              disabled={
                isBulkSaving || isLoading || hasUnresolvedResults || searchText !== query.search
              }
              onClick={() => setBulkDialog([...selected.values()].map((entry) => ({ ...entry })))}
            >
              Change stage
            </button>
            <button
              type="button"
              disabled={isBulkSaving || isLoading}
              onClick={() => {
                clearSelection();
                heading.current.focus();
              }}
            >
              Clear selection
            </button>
            {hasUnresolvedResults && (
              <span>
                Review or dismiss the previous results before starting another bulk change.
              </span>
            )}
          </div>
        )}
        <BulkOperationSummary
          operation={operation}
          retryDisabled={isLoading}
          onRetry={async () => {
            const source = document.activeElement;
            await retryBulkStageChange();
            if (document.activeElement === document.body && !source.isConnected)
              heading.current.focus();
          }}
          onDismiss={() => {
            dismissBulkResults();
            heading.current.focus();
          }}
        />
        {needsResultsRefresh && (
          <div className="results-notice">
            <p role="status">Deal values updated. Refresh to update the results count and order.</p>
            <button
              className="notice-refresh"
              type="button"
              disabled={isLoading || isBulkSaving || Boolean(bulkDialog)}
              aria-busy={isLoading}
              onClick={refreshResults}
            >
              {isLoading ? 'Refreshing…' : 'Refresh results'}
            </button>
          </div>
        )}
        <DealTable
          deals={deals}
          isLoading={isLoading}
          loadError={loadError}
          ownersById={OWNERS_BY_ID}
          orderDescription={orderDescription}
          onClearFilters={clearFilters}
          api={api}
          onDealConfirmed={mergeDeal}
          onSaved={handleSaved}
          selected={selected}
          onSelect={toggleSelection}
          onSelectPage={togglePageSelection}
          isBulkSaving={isBulkSaving || isLoading}
        />
        <Pagination
          disabled={isLoading || isBulkSaving}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={changePage}
          onPageSizeChange={handlePageSizeChange}
        />
      </section>
      <p className="demo-note">
        Generated demo data · Changes reset on reload. Selections persist between pages; the header
        checkbox affects only this page. Live teammate updates are not enabled.
      </p>
      {bulkDialog && (
        <BulkStageDialog
          count={bulkDialog.length}
          changedCount={
            bulkDialog.filter(({ id, expectedVersion }) => {
              const deal = deals.find((entry) => entry.id === id);
              return deal && deal.version !== expectedVersion;
            }).length
          }
          isSaving={isBulkSaving}
          onConfirm={confirmBulk}
          onDismiss={() => {
            setBulkDialog(null);
            bulkTrigger.current?.focus();
          }}
        />
      )}
      <div className="toast-region" role="status" aria-atomic="true">
        {successMessage && (
          <div className="success-toast">
            <span>{successMessage}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setSuccessMessage('')}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
