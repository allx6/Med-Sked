import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ open, onCancel, onConfirm }) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="modal-panel confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
      >
        <div className="confirm-dialog-mark" aria-hidden="true">?</div>
        <p className="eyebrow">Confirm logout</p>
        <h3 id="logout-dialog-title">Log out?</h3>
        <p id="logout-dialog-description">This will end your Admin session on this device.</p>
        <div className="modal-actions">
          <button ref={cancelButtonRef} type="button" className="secondary-button" onClick={onCancel}>
            Stay signed in
          </button>
          <button type="button" className="logout-confirm-button" onClick={onConfirm}>
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}