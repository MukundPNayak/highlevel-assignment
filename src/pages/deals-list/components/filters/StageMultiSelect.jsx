import { useRef, useId, useEffect } from 'react';
import { STAGES } from '../../constants/stages.js';

export default function StageMultiSelect({ value, onChange }) {
  const dropdown = useRef(null);

  const labelId = useId();

  const selected = STAGES.filter(({ id }) => value.includes(id));
  const summary =
    selected.length === 0
      ? 'All stages'
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} stages selected`;

  useEffect(() => {
    function dismissOutside(event) {
      if (!dropdown.current.contains(event.target)) dropdown.current.open = false;
    }
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
    };
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape' && dropdown.current.open) {
      event.preventDefault();
      event.stopPropagation();
      dropdown.current.open = false;
      dropdown.current.querySelector('summary').focus();
    }
  }

  function toggleStage(stageId) {
    onChange(value.includes(stageId) ? value.filter((id) => id !== stageId) : [...value, stageId]);
  }

  return (
    <div className="stage-select">
      <span id={labelId} className="stage-select-label">
        Stages
      </span>
      <details ref={dropdown} onKeyDown={handleKeyDown}>
        <summary aria-label={`Stages: ${summary}`}>
          {summary}
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="stage-select-options">
          <p>Choose multiple. None selected means all.</p>
          <fieldset aria-labelledby={labelId}>
            {STAGES.map((stage) => (
              <label key={stage.id}>
                <input
                  type="checkbox"
                  value={stage.id}
                  checked={value.includes(stage.id)}
                  onChange={() => toggleStage(stage.id)}
                />
                {stage.label}
              </label>
            ))}
          </fieldset>
        </div>
      </details>
    </div>
  );
}
