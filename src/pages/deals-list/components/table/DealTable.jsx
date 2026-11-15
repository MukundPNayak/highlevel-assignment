import { useRef, useEffect } from 'react';
import { STAGE_LABELS } from '../../constants/stages.js';
import DealActions from '../deal-actions/DealActions.jsx';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const date = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

export default function DealTable({
  deals,
  ownersById,
  orderDescription,
  onClearFilters,
  api,
  onDealConfirmed,
  onSaved,
  selected,
  onSelect,
  onSelectPage,
  isBulkSaving,
  isLoading = false,
  loadError = '',
}) {
  const scrollRegion = useRef(null);
  const selectPage = useRef(null);

  const selectedCount = deals.filter(({ id }) => selected.has(id)).length;

  useEffect(() => {
    selectPage.current.indeterminate = selectedCount > 0 && selectedCount < deals.length;
  }, [selectedCount, deals.length]);

  return (
    <div
      ref={scrollRegion}
      className="table-scroll"
      role="region"
      aria-label="Deals table, scroll horizontally on smaller screens"
      tabIndex={0}
    >
      <table
        id="deals-table"
        aria-busy={isLoading}
        aria-describedby="table-order"
        onKeyDown={(event) => {
          if (
            !event.target.classList.contains('row-select') ||
            !['ArrowDown', 'ArrowUp'].includes(event.key)
          )
            return;
          event.preventDefault();
          const checkboxes = [...scrollRegion.current.querySelectorAll('.row-select')];
          const index = checkboxes.indexOf(event.target) + (event.key === 'ArrowDown' ? 1 : -1);
          checkboxes[index]?.focus();
        }}
      >
        <caption className="sr-only">Deals List. {orderDescription}.</caption>
        <thead>
          <tr>
            <th scope="col" className="selection-cell">
              <input
                ref={selectPage}
                type="checkbox"
                aria-label={`Select all ${deals.length} deals on this page`}
                checked={deals.length > 0 && selectedCount === deals.length}
                disabled={!deals.length || isBulkSaving}
                onChange={onSelectPage}
              />
            </th>
            <th scope="col">Company</th>
            <th scope="col">Stage</th>
            <th scope="col">Owner</th>
            <th scope="col" className="numeric">
              Deal value
            </th>
            <th scope="col">Last activity</th>
            <th scope="col" className="actions-heading">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading && !deals.length && (
            <tr>
              <td colSpan={7} className="empty-state" role="status">
                Loading deals?
              </td>
            </tr>
          )}
          {deals.map((deal) => (
            <tr key={deal.id} className={selected.has(deal.id) ? 'selected-row' : undefined}>
              <td className="selection-cell">
                <input
                  className="row-select"
                  type="checkbox"
                  aria-label={`Select ${deal.companyName}`}
                  checked={selected.has(deal.id)}
                  disabled={isBulkSaving}
                  onChange={() => onSelect(deal.id)}
                />
              </td>
              <th scope="row">
                <span className="company-name">{deal.companyName}</span>
                <span className="deal-id">{deal.id}</span>
                {selected.has(deal.id) &&
                  selected.get(deal.id).expectedVersion !== deal.version && (
                    <span className="filter-mismatch">Changed since selection</span>
                  )}
              </th>
              <td>
                <span className={`stage stage-${deal.stage.toLowerCase()}`}>
                  {STAGE_LABELS[deal.stage]}
                </span>
              </td>
              <td>{ownersById[deal.ownerId].name}</td>
              <td className="numeric value">{currency.format(deal.value)}</td>
              <td>
                <time dateTime={new Date(deal.lastActivityAt).toISOString()}>
                  {date.format(deal.lastActivityAt)}
                </time>
              </td>
              <td className="actions-cell">
                <DealActions
                  deal={deal}
                  api={api}
                  onDealConfirmed={onDealConfirmed}
                  onSaved={onSaved}
                  disabled={isBulkSaving}
                />
              </td>
            </tr>
          ))}
          {deals.length === 0 && !isLoading && !loadError && (
            <tr>
              <td colSpan={7} className="empty-state">
                <p>No deals match your filters.</p>
                <button type="button" onClick={onClearFilters}>
                  Clear filters
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
