import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }: Props) {
  if (!open) {
    return null;
  }
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="dialog dialog--closable">
        <button
          className="dialog-close-icon"
          type="button"
          onClick={onCancel}
          aria-label="Close confirmation dialog"
          title="Close"
        >
          <X size={16} />
        </button>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="actions">
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
