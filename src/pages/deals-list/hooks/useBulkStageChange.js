import { useState, useRef } from 'react';

export function useBulkStageChange(api, onConfirmed) {
  const [operation, setOperation] = useState(null);

  const busy = useRef(false);

  async function changeSelectedDealsStage(entries, targetStage, previous = null) {
    if (busy.current || !entries.length) return false;
    busy.current = true;
    const inputs = entries.map((entry) => ({ ...entry }));
    const next = {
      inputs: previous?.inputs || inputs,
      results: previous?.results || [],
      targetStage,
      attempted: inputs.length,
    };
    setOperation({ ...next, running: true });
    let results;
    try {
      results = await api.bulkUpdateDealStage({ deals: inputs, targetStage });
    } catch {
      results = inputs.map(({ id }) => ({
        id,
        kind: 'network-error',
        message: 'The bulk request failed. You can retry this deal.',
      }));
    }
    const combined = new Map(next.results.map((result) => [result.id, result]));
    for (const result of results) {
      const { id, kind, message } = result;
      combined.set(id, {
        id,
        kind,
        message,
        companyName: result.companyName || result.deal?.companyName || result.latest?.companyName,
      });
    }
    onConfirmed(
      results
        .filter(({ kind }) => kind === 'success' || kind === 'conflict')
        .map((result) => result.deal || result.latest)
        .filter(Boolean),
    );
    setOperation({ ...next, results: [...combined.values()], running: false });
    busy.current = false;
    return true;
  }

  function retry() {
    if (!operation) return;
    const failedIds = new Set(
      operation.results.filter(({ kind }) => kind === 'network-error').map(({ id }) => id),
    );
    return changeSelectedDealsStage(
      operation.inputs.filter(({ id }) => failedIds.has(id)),
      operation.targetStage,
      operation,
    );
  }

  function dismiss() {
    if (!busy.current) setOperation(null);
  }

  return {
    operation,
    changeSelectedDealsStage,
    retry,
    dismiss,
    isSaving: Boolean(operation?.running),
  };
}
