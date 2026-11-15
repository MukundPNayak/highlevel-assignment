import { STAGE_LABELS } from '../../constants/stages.js';

export default function BulkOperationSummary({
  operation,
  onRetry,
  onDismiss,
  retryDisabled = false,
}) {
  if (!operation) return null;
  const { results, running, targetStage, attempted } = operation;
  const count = (kind) => results.filter((result) => result.kind === kind).length;
  const failed = results.filter(({ kind }) => !['success', 'noop'].includes(kind));

  return (
    <section className="bulk-summary" aria-label="Bulk stage change results">
      <p role="status">
        {running
          ? `Updating ${attempted} deals to ${STAGE_LABELS[targetStage]}…`
          : `${results.length} processed · ${count('success')} saved · ${count('noop')} already in stage · ${count('network-error')} failed · ${count('conflict')} conflicts · ${count('invalid')} invalid`}
      </p>
      {failed.length > 0 && (
        <details>
          <summary>Review {failed.length} unsuccessful deals</summary>
          <ul>
            {failed.map((result) => (
              <li key={result.id}>
                <strong>{result.companyName || result.id}</strong> ({result.id}): {result.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      {count('conflict') > 0 && (
        <p>
          Conflicting deals on the current page show the latest data. Review them using the row
          action, or dismiss these results and select them again for a new change.
        </p>
      )}
      <div className="bulk-summary-actions">
        {count('network-error') > 0 && (
          <button type="button" disabled={running || retryDisabled} onClick={onRetry}>
            Retry {count('network-error')} failed
          </button>
        )}
        <button type="button" disabled={running} onClick={onDismiss}>
          Dismiss results
        </button>
      </div>
    </section>
  );
}
