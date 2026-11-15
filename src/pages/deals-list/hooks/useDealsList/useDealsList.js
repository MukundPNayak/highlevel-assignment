import { useState, useRef, useCallback, useEffect } from 'react';
import { INITIAL_QUERY } from '../../constants/filters.js';
import { PAGE_SIZE } from '../../constants/pagination.js';
import { mergeConfirmedDeals } from './helpers/deals.js';
import { clampPage } from './helpers/pagination.js';
import {
  toggleDealSelection,
  togglePageSelection as togglePageRecords,
} from './helpers/selection.js';

export function useDealsList(api) {
  const [deals, setDeals] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState(() => ({ ...INITIAL_QUERY, stages: [] }));
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(() => new Map());
  const [needsResultsRefresh, setNeedsResultsRefresh] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Request bookkeeping only; rendered data and query inputs live in state.
  const requestId = useRef(0);
  const loadingRef = useRef(false);
  const clearSelectionAfterLoad = useRef(false);

  const loadPage = useCallback(
    async (request, { clearPage = false, clearSelection = false } = {}) => {
      const id = ++requestId.current;
      clearSelectionAfterLoad.current = clearSelection;
      loadingRef.current = true;
      setIsLoading(true);
      setLoadError('');
      if (clearPage) {
        setDeals([]);
        setNeedsResultsRefresh(false);
      }
      try {
        const response = await api.listDeals(request);
        if (id !== requestId.current) return false;
        setDeals(response.items);
        setTotal(response.total);
        setPage(response.page);
        setNeedsResultsRefresh(false);
        if (clearSelection) setSelected(new Map());
        return true;
      } catch {
        if (id === requestId.current) setLoadError('Could not load deals. Please try again.');
        return false;
      } finally {
        if (id === requestId.current) {
          loadingRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [api],
  );

  const mergeDeals = useCallback((incoming) => {
    if (!incoming.length) return;
    setDeals((current) => mergeConfirmedDeals(current, incoming));
    setNeedsResultsRefresh(true);
  }, []);

  const mergeDeal = useCallback((deal) => mergeDeals([deal]), [mergeDeals]);

  const applyQuery = useCallback(
    (changes) => {
      const next = { ...query, ...changes };
      setQuery(next);
      setPage(0);
      setTotal(0);
      setSelected(new Map());
      return loadPage({ query: next, page: 0, pageSize }, { clearPage: true });
    },
    [loadPage, query, pageSize],
  );

  const changePage = useCallback(
    (nextPage) => {
      const requestedPage = clampPage(nextPage, total, pageSize);
      setPage(requestedPage);
      return loadPage({ query, page: requestedPage, pageSize }, { clearPage: true });
    },
    [loadPage, total, query, pageSize],
  );

  const changePageSize = useCallback(
    (nextSize) => {
      setPageSize(nextSize);
      setPage(0);
      setSelected(new Map());
      return loadPage({ query, page: 0, pageSize: nextSize }, { clearPage: true });
    },
    [loadPage, query],
  );

  const refresh = useCallback(() => {
    if (loadingRef.current) return Promise.resolve(false);
    return loadPage({ query, page, pageSize }, { clearSelection: true });
  }, [loadPage, query, page, pageSize]);

  const retryLoad = useCallback(() => {
    if (loadingRef.current) return Promise.resolve(false);
    return loadPage({ query, page, pageSize }, { clearSelection: clearSelectionAfterLoad.current });
  }, [loadPage, query, page, pageSize]);

  const toggleSelection = useCallback(
    (id) => {
      if (loadingRef.current) return;
      const deal = deals.find((entry) => entry.id === id);
      if (deal) setSelected((current) => toggleDealSelection(current, deal));
    },
    [deals],
  );

  const togglePageSelection = useCallback(() => {
    if (loadingRef.current) return;
    setSelected((current) => togglePageRecords(current, deals));
  }, [deals]);
  const clearSelection = useCallback(() => setSelected(new Map()), []);

  useEffect(() => {
    // Initial state already represents loading; this effect starts the external request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage({ query: INITIAL_QUERY, page: 0, pageSize: PAGE_SIZE });
    return () => {
      requestId.current += 1;
    };
  }, [loadPage]);

  return {
    deals,
    total,
    query,
    page,
    pageSize,
    selected,
    needsResultsRefresh,
    isLoading,
    loadError,
    mergeDeal,
    mergeDeals,
    applyQuery,
    refresh,
    retryLoad,
    changePage,
    changePageSize,
    toggleSelection,
    togglePageSelection,
    clearSelection,
  };
}
