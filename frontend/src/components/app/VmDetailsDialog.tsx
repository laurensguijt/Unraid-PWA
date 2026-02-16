import { vmActionLabel, vmActionsForState } from "../../lib/ui";
import type { VmAction, VmsData } from "../../types";
import { StatusPill } from "../StatusPill";

type VmData = VmsData["vms"][number];

type VmDetailsDialogProps = {
  vm: VmData;
  canWriteControls: boolean;
  onClose: () => void;
  onRequestAction: (action: VmAction) => void;
};

export function VmDetailsDialog({ vm, canWriteControls, onClose, onRequestAction }: VmDetailsDialogProps) {
  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="VM details"
      onClick={onClose}
    >
      <div className="dialog settings-dialog docker-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="row docker-dialog-header">
          <div className="docker-dialog-title">
            <h3>{vm.name}</h3>
            <small className="docker-dialog-image">{vm.id}</small>
          </div>
          <div className="docker-card-actions">
            <StatusPill status={vm.status} />
            <button className="secondary dialog-close-button" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="actions">
          {vmActionsForState(vm.stateLabel).map((action) => (
            <button
              key={action}
              className={action === "forceStop" || action === "reset" ? "secondary" : undefined}
              disabled={!canWriteControls}
              onClick={() => onRequestAction(action)}
            >
              {vmActionLabel(action)}
            </button>
          ))}
        </div>
        {!canWriteControls && <small>Write controls disabled: current API scopes are read-only.</small>}
      </div>
    </div>
  );
}
