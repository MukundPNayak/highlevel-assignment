import { useState, useRef, useId, useEffect } from 'react';
import { SORT_OPTIONS, INACTIVITY_OPTIONS } from '../../constants/filters.js';
import { STAGES } from '../../constants/stages.js';
import StageMultiSelect from './StageMultiSelect.jsx';

export default function DealsListToolbar({
  query,
  searchText,
  owners,
  onSearchChange,
  onQueryChange,
  onClear,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(() => ({
    ownerId: query.ownerId,
    stages: [...query.stages],
    inactiveDays: query.inactiveDays,
  }));

  const anchor = useRef(null);
  const trigger = useRef(null);
  const panel = useRef(null);

  const panelId = useId();

  const activeCount =
    Number(Boolean(query.ownerId)) + query.stages.length + Number(query.inactiveDays !== '');

  useEffect(() => {
    if (!isOpen) return;
    panel.current.querySelector('select').focus();
    function dismissOutside(event) {
      if (!anchor.current.contains(event.target)) setIsOpen(false);
    }
    function dismissOnEscape(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        trigger.current.focus();
      }
    }
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [isOpen]);

  function closeFilters() {
    setIsOpen(false);
    trigger.current.focus();
  }

  function removeFilter(changes) {
    onQueryChange(changes);
    setIsOpen(false);
    trigger.current.focus();
  }

  function toggleFilters() {
    if (isOpen) {
      closeFilters();
      return;
    }
    setDraft({
      ownerId: query.ownerId,
      stages: [...query.stages],
      inactiveDays: query.inactiveDays,
    });
    setIsOpen(true);
  }

  function applyFilters() {
    onQueryChange(draft);
    closeFilters();
  }

  return (
    <div className="deals-toolbar" role="search" aria-label="Find deals">
      <div className="query-controls">
        <label className="search-control">
          Search deals
          <input
            type="search"
            value={searchText}
            placeholder="Company name or deal ID"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <label>
          Sort by
          <select
            value={query.sort}
            onChange={(event) => onQueryChange({ sort: event.target.value })}
          >
            {SORT_OPTIONS.map((sort) => (
              <option key={sort.id} value={sort.id}>
                {sort.label}
              </option>
            ))}
          </select>
        </label>
        <div className="filter-anchor" ref={anchor}>
          <button
            ref={trigger}
            className="filter-trigger"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-controls={isOpen ? panelId : undefined}
            onClick={toggleFilters}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 4h18l-7 8v7l-4 2v-9z" />
            </svg>
            Filters {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
          </button>
          {isOpen && (
            <div
              ref={panel}
              id={panelId}
              className="filter-popover"
              role="dialog"
              aria-labelledby={`${panelId}-title`}
            >
              <div className="filter-popover-heading">
                <h3 id={`${panelId}-title`}>Filter deals</h3>
                <button type="button" onClick={closeFilters} aria-label="Close filters">
                  ×
                </button>
              </div>
              <div className="filter-fields">
                <label>
                  Owner
                  <select
                    value={draft.ownerId}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, ownerId: event.target.value }))
                    }
                  >
                    <option value="">All owners</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Inactive for
                  <select
                    value={draft.inactiveDays}
                    aria-describedby={
                      draft.inactiveDays !== '' ? `${panelId}-inactivity` : undefined
                    }
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        inactiveDays: event.target.value === '' ? '' : Number(event.target.value),
                      }))
                    }
                  >
                    <option value="">Any time</option>
                    {INACTIVITY_OPTIONS.map((days) => (
                      <option key={days} value={days}>
                        {days}+ days
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <StageMultiSelect
                value={draft.stages}
                onChange={(stages) => setDraft((current) => ({ ...current, stages }))}
              />
              {draft.inactiveDays !== '' && (
                <p id={`${panelId}-inactivity`} className="filter-help">
                  Won and Lost are excluded.
                </p>
              )}
              <div className="filter-popover-footer">
                <button className="apply-filters" type="button" onClick={applyFilters}>
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="clear-filters"
          onClick={() => {
            setIsOpen(false);
            onClear();
          }}
        >
          Clear filters
        </button>
      </div>
      {activeCount > 0 && (
        <div className="active-filters" role="group" aria-label="Active filters">
          {query.ownerId && (
            <button
              type="button"
              aria-label="Remove owner filter"
              onClick={() => removeFilter({ ownerId: '' })}
            >
              Owner: {owners.find(({ id }) => id === query.ownerId).name}{' '}
              <span aria-hidden="true">×</span>
            </button>
          )}
          {STAGES.filter(({ id }) => query.stages.includes(id)).map((stage) => (
            <button
              type="button"
              key={stage.id}
              aria-label={`Remove ${stage.label} filter`}
              onClick={() => removeFilter({ stages: query.stages.filter((id) => id !== stage.id) })}
            >
              Stage: {stage.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          {query.inactiveDays !== '' && (
            <button
              type="button"
              aria-label="Remove inactivity filter"
              onClick={() => removeFilter({ inactiveDays: '' })}
            >
              Inactive: {query.inactiveDays}+ days · Open only <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
