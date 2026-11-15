
import { useEffect, useId, useRef } from 'react';
import { UserPlus, TriangleAlert, X } from 'lucide-react';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'אישור',
  cancelText = 'ביטול',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {

  const dialogRef = useRef<HTMLDialogElement>(null);

  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const Icon =
    variant === 'danger'
      ? TriangleAlert
      : UserPlus;

  return (

    <dialog
      ref={dialogRef}
      className={`smart-dialog dialog-${variant}`}
      dir="rtl"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      aria-busy={loading}
      onCancel={event => {
        event.preventDefault();

        if (!loading) onCancel();
      }}
    >

      <div className="smart-dialog-header">

        <div className="smart-dialog-icon">
          <Icon size={28} />
        </div>

        <button
          type="button"
          className="smart-dialog-close"
          aria-label="סגירה"
          disabled={loading}
          onClick={onCancel}
        >
          <X size={21} />
        </button>

      </div>

      <h2 id={titleId}>{title}</h2>

      <p id={messageId}>{message}</p>

      <div className="smart-dialog-actions">

        <button
          type="button"
          className="smart-dialog-cancel"
          disabled={loading}
          onClick={onCancel}
          autoFocus
        >
          {cancelText}
        </button>

        <button
          type="button"
          className="smart-dialog-confirm"
          disabled={loading}
          onClick={onConfirm}
        >
          {loading ? 'מבצע פעולה...' : confirmText}
        </button>

      </div>

    </dialog>
  );
}
