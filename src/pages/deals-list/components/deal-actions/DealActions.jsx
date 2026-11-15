import { useState, useRef, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ChangeStageDialog from './ChangeStageDialog.jsx';

export default function DealActions({ deal, api, onDealConfirmed, onSaved, disabled = false }) {
  const [menuPosition, setMenuPosition] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const trigger = useRef(null);
  const menu = useRef(null);

  const triggerId = useId();
  const menuId = useId();

  useEffect(() => {
    if (!menuPosition) return;
    menu.current.querySelector('button').focus();
    function dismissOutside(event) {
      if (!trigger.current.contains(event.target) && !menu.current.contains(event.target))
        setMenuPosition(null);
    }
    function dismissOnScroll() {
      setMenuPosition(null);
    }
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('scroll', dismissOnScroll, true);
    window.addEventListener('resize', dismissOnScroll);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('scroll', dismissOnScroll, true);
      window.removeEventListener('resize', dismissOnScroll);
    };
  }, [menuPosition]);

  function openMenu() {
    const rect = trigger.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 48 > window.innerHeight ? Math.max(8, rect.top - 44) : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)),
    });
  }

  function closeMenu() {
    setMenuPosition(null);
    trigger.current.focus();
  }

  function handleMenuKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      menu.current.querySelector('button').focus();
    }
  }

  return (
    <>
      <button
        ref={trigger}
        id={triggerId}
        className="deal-actions-trigger"
        type="button"
        disabled={disabled}
        aria-label={`Actions for ${deal.companyName}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(menuPosition)}
        aria-controls={menuPosition ? menuId : undefined}
        onClick={() => (menuPosition ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            openMenu();
          }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {menuPosition &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            className="deal-action-menu"
            style={menuPosition}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={handleMenuKeyDown}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuPosition(null);
                setIsEditing(true);
              }}
            >
              Change stage
            </button>
          </div>,
          document.body,
        )}
      {isEditing && (
        <ChangeStageDialog
          deal={deal}
          api={api}
          onDealConfirmed={onDealConfirmed}
          onSaved={onSaved}
          onDismiss={() => {
            setIsEditing(false);
            trigger.current.focus();
          }}
        />
      )}
    </>
  );
}
