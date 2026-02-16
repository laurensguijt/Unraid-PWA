import { X } from "lucide-react";
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
  const compactVmId =
    vm.id.length > 36 ? `${vm.id.slice(0, 18)}...${vm.id.slice(-12)}` : vm.id;

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="VM details"
      onClick={onClose}
    >
      <div className="dialog settings-dialog docker-dialog dialog--closable" onClick={(event) => event.stopPropagation()}>
        <button
          className="dialog-close-icon"
          type="button"
          onClick={onClose}
          aria-label="Close VM details dialog"
          title="Close"
        >
          <X size={16} />
        </button>
        <div className="row docker-dialog-header dialog-header--split">
          <div className="docker-dialog-title dialog-header-main">
            <h3>{vm.name}</h3>
            <small className="docker-dialog-image dialog-meta" title={vm.id}>
              {compactVmId}
            </small>
          </div>
          <div className="docker-card-actions">
            <StatusPill status={vm.status} />
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
