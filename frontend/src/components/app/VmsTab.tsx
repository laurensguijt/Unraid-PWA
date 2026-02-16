import { Activity, CircleX, Info, LayoutGrid, Monitor } from "lucide-react";
import type { VmsData } from "../../types";
import { BadgePill } from "../BadgePill";
import { FrostedCard } from "../FrostedCard";
import { IconRow } from "../IconRow";
import { SectionHeader } from "../SectionHeader";
import { StatusPill } from "../StatusPill";

type VmsTabProps = {
  vmsData: VmsData;
  filteredVms: VmsData["vms"];
  vmSearch: string;
  onVmSearchChange: (value: string) => void;
  onOpenVmInfo: (vmId: string) => void;
};

export function VmsTab({
  vmsData,
  filteredVms,
  vmSearch,
  onVmSearchChange,
  onOpenVmInfo,
}: VmsTabProps) {
  return (
    <>
      <FrostedCard>
        <SectionHeader title="VM Overview" />
        <label className="search-inline-label">
          <input
            className="search-inline-input"
            value={vmSearch}
            onChange={(event) => onVmSearchChange(event.target.value)}
            placeholder="Search VMs..."
          />
        </label>
        <div className="array-grid">
          <IconRow label="Running" value={String(vmsData.summary.running)} icon={Activity} />
          <IconRow label="Stopped" value={String(vmsData.summary.stopped)} icon={CircleX} />
          <IconRow label="Paused" value={String(vmsData.summary.paused)} icon={Monitor} />
          <IconRow label="Other" value={String(vmsData.summary.other)} icon={LayoutGrid} />
        </div>
      </FrostedCard>
      <FrostedCard>
        <SectionHeader title="VMs" right={<BadgePill value={filteredVms.length} />} />
        {filteredVms.map((vm) => (
          <div key={vm.id} className="list-item vm-item">
            <div className="row">
              <strong>{vm.name}</strong>
              <div className="docker-card-actions">
                <StatusPill status={vm.status} />
                <button
                  className="icon-button notification-archive"
                  type="button"
                  onClick={() => onOpenVmInfo(vm.id)}
                  aria-label={`Open info for ${vm.name}`}
                  title="VM details"
                >
                  <Info size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </FrostedCard>
    </>
  );
}
