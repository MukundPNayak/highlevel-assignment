import { useState, useRef, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { STAGES } from '../../constants/stages.js';

export default function BulkStageDialog({ count, changedCount, isSaving, onConfirm, onDismiss }) {
  const [targetStage, setTargetStage] = useState('');

  const dialog = useRef(null);
  const cancel = useRef(null);
  const submitting = useRef(false);

  const titleId = useId();
  const helpId = useId();

  const noun = count === 1 ? 'deal' : 'deals';

  useEffect(() => {
    dialog.current.showModal();
    cancel.current.focus();
  }, []);

  function dismiss() {
    if (!submitting.current && !isSaving) onDismiss();
  }

  async function confirm() {
    if (submitting.current || !targetStage) return;
    submitting.current = true;
    try {
      await onConfirm(targetStage);
    } finally {
      submitting.current = false;
    }
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="change-stage-dialog"
      aria-labelledby={titleId}
      aria-describedby={helpId}
      aria-modal="true"
      aria-busy={isSaving}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>
          Change stage for {count} {noun}
        </h2>
        <button
          type="button"
          aria-label="Close bulk change stage"
          disabled={isSaving}
          onClick={dismiss}
        >
          ×
        </button>
      </div>
      <p id={helpId} className="dialog-help">
        This updates all {count} selected {noun}, including selections on other pages. Deals already
        in the target stage are skipped. There is no automatic undo.
      </p>
      {changedCount > 0 && (
        <p className="dialog-error">
          {changedCount} selected deals have changed since selection. They will be checked for
          conflicts.
        </p>
      )}
      <label className="dialog-stage-label">
        New stage
        <select
          value={targetStage}
          disabled={isSaving}
          onChange={(event) => setTargetStage(event.target.value)}
        >
          <option value="">Choose a stage</option>
          {STAGES.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {isSaving && (
        <p role="status">
          Updating {count} {noun}…
        </p>
      )}
      <div className="dialog-footer">
        <button ref={cancel} type="button" disabled={isSaving} onClick={dismiss}>
          Cancel
        </button>
        <button type="button" disabled={!targetStage || isSaving} onClick={confirm}>
          {isSaving ? 'Saving…' : `Save ${count} ${noun}`}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
