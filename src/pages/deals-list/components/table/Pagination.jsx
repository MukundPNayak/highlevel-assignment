import { PAGE_SIZE_OPTIONS } from '../../constants/pagination.js';

const number = new Intl.NumberFormat('en-IN');

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min((page + 1) * pageSize, total);

  return (
    <nav className="pagination" aria-label="Deals pagination">
      <p className="sr-only" role="status" aria-atomic="true">
        {number.format(first)}–{number.format(last)} of {number.format(total)} deals
      </p>
      <label className="page-size">
        Rows per page
        <select
          disabled={disabled}
          value={pageSize}
          onChange={onPageSizeChange}
          aria-controls="deals-table"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div className="page-controls">
        <span className="page-number">
          Page {number.format(page + 1)} of {number.format(pageCount)}
        </span>
        <button
          type="button"
          disabled={disabled || page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-controls="deals-table"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={disabled || page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          aria-controls="deals-table"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
