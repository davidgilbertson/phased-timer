import {useEffect, useRef} from "react";

export function ConfirmPanel({confirmPanel, onClose}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirmPanel && !dialog.open) dialog.showModal();
    if (!confirmPanel && dialog.open) dialog.close();
  }, [confirmPanel]);

  if (!confirmPanel) return null;

  return (
    <dialog
      ref={dialogRef}
      className="confirm-panel"
      onClick={event => {
        if (event.target === event.currentTarget) onClose(false);
      }}
      onClose={() => onClose(false)}
    >
      <h2>{confirmPanel.title}</h2>
      <div className="body">{confirmPanel.body}</div>
      <div className="actions">
        <button className="neutral" type="button" onClick={() => onClose(false)}>
          {confirmPanel.cancelText ?? "Cancel"}
        </button>
        <button className="primary" type="button" onClick={() => onClose(true)}>
          {confirmPanel.confirmText ?? "OK"}
        </button>
      </div>
    </dialog>
  );
}
