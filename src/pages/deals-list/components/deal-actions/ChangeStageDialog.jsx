import { useState, useRef, useId, useEffect, useEffectEvent } from 'react';
import { createPortal } from 'react-dom';
import { STAGES, STAGE_LABELS } from '../../constants/stages.js';

export default function ChangeStageDialog({ deal, api, onDealConfirmed, onSaved, onDismiss }) {
  const [record, setRecord] = useState(null);
  const [targetStage, setTargetStage] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const dialog = useRef(null);
  const cancel = useRef(null);
  const saving = useRef(false);

  const titleId = useId();
  const helpId = useId();

  const isSaving = status === 'saving';
  const current = conflict || record;

  // Read the current row without restarting the fetch when its values change.
  const confirmFetchedDeal = useEffectEvent((latest) => {
    if (latest.version > deal.version) onDealConfirmed(latest);
  });

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
    cancel.current.focus();
  }, []);

  useEffect(() => {
    let active = true;
    api
      .getDeal(deal.id)
      .then((latest) => {
        if (!active) return;
        setRecord(latest);
        setTargetStage(latest.stage);
        setStatus('ready');
        confirmFetchedDeal(latest);
      })
      .catch((failure) => {
        if (!active) return;
        setError(failure.message || 'Could not load the latest deal.');
        setStatus('load-error');
      });
    return () => {
      active = false;
    };
  }, [api, deal.id, loadAttempt]);

  async function save() {
    if (saving.current || !record || conflict || targetStage === record.stage) return;
    saving.current = true;
    setStatus('saving');
    setError(null);
    try {
      const result = await api.updateDealStage({
        id: record.id,
        expectedVersion: record.version,
        targetStage,
      });
      if (result.kind === 'success' || result.kind === 'noop') {
        onDealConfirmed(result.deal);
        onSaved(result.deal);
        onDismiss();
      } else if (result.kind === 'conflict') {
        onDealConfirmed(result.latest);
        setConflict(result.latest);
        setError(result.message);
        setStatus('conflict');
      } else {
        setError(result.message);
        setStatus('save-error');
      }
    } catch {
      setError('The stage could not be saved. Please try again.');
      setStatus('save-error');
    } finally {
      saving.current = false;
    }
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="change-stage-dialog"
      aria-labelledby={titleId}
      aria-describedby={helpId}
      aria-modal="true"
      aria-busy={status === 'loading' || isSaving}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving.current) onDismiss();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>Change stage</h2>
        <button
          type="button"
          aria-label="Close change stage"
          disabled={isSaving}
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
      <p className="dialog-company">{current?.companyName || deal.companyName}</p>
      <p className="dialog-current-stage">
        {deal.id}
        {current && ` · Current stage: ${STAGE_LABELS[current.stage]}`}
      </p>
      {status === 'loading' && <p role="status">Loading latest deal…</p>}
      {current && (
        <label className="dialog-stage-label">
          New stage
          <select
            value={targetStage}
            disabled={isSaving || Boolean(conflict)}
            onChange={(event) => {
              setTargetStage(event.target.value);
              setError(null);
              setStatus('ready');
            }}
          >
            {STAGES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <p id={helpId} className="dialog-help">
        {isSaving
          ? 'Saving your change…'
          : 'The stage changes only after the save succeeds. There is no automatic undo.'}
      </p>
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      {status === 'load-error' && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStatus('loading');
            setLoadAttempt((attempt) => attempt + 1);
          }}
        >
          Retry loading
        </button>
      )}
      {conflict && (
        <button
          type="button"
          onClick={() => {
            setRecord(conflict);
            setConflict(null);
            setError(null);
            setStatus('ready');
          }}
        >
          Review latest stage
        </button>
      )}
      <div className="dialog-footer">
        <button ref={cancel} type="button" disabled={isSaving} onClick={onDismiss}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!record || isSaving || Boolean(conflict) || targetStage === record.stage}
          onClick={save}
          aria-describedby={helpId}
        >
          {isSaving ? 'Saving…' : status === 'save-error' ? 'Retry save' : 'Save stage'}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
