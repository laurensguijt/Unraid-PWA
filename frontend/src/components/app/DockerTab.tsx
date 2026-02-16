import { Activity, CircleX, Info, Plus } from "lucide-react";
import { dockerIconProxyUrl } from "../../lib/ui";
import type { DockerData } from "../../types";
import { FrostedCard } from "../FrostedCard";
import { IconRow } from "../IconRow";
import { SectionHeader } from "../SectionHeader";
import { StatusPill } from "../StatusPill";
import { DockerLogo } from "../DockerLogo";

type DockerTabProps = {
  docker: DockerData | null;
  filteredContainers: DockerData["containers"];
  dockerSearch: string;
  onDockerSearchChange: (value: string) => void;
  onOpenContainerInfo: (containerId: string) => void;
};

export function DockerTab({
  docker,
  filteredContainers,
  dockerSearch,
  onDockerSearchChange,
  onOpenContainerInfo,
}: DockerTabProps) {
  return (
    <>
      <FrostedCard>
        <SectionHeader title="Docker Overview" />
        <label className="search-inline-label">
          <input
            className="search-inline-input"
            value={dockerSearch}
            onChange={(event) => onDockerSearchChange(event.target.value)}
            placeholder="Search dockers..."
          />
        </label>
        <IconRow label="Running" value={`${docker?.summary.running ?? 0}`} icon={Activity} />
        <IconRow label="Stopped" value={`${docker?.summary.stopped ?? 0}`} icon={CircleX} />
        <IconRow label="Updates" value={`${docker?.summary.updatesAvailable ?? 0}`} icon={Plus} />
      </FrostedCard>
      {filteredContainers.map((container) => (
        <FrostedCard key={container.id}>
          <div className="row">
            <div className="docker-title">
              <DockerLogo
                name={container.name}
                iconUrl={container.iconUrl}
                fallbackIconUrl={dockerIconProxyUrl(container.id)}
              />
              <h3>{container.name}</h3>
            </div>
            <div className="docker-card-actions">
              <StatusPill status={container.status} />
              <button
                className="icon-button notification-archive"
                type="button"
                onClick={() => onOpenContainerInfo(container.id)}
                aria-label={`Open info for ${container.name}`}
                title="Container details"
              >
                <Info size={14} />
              </button>
            </div>
          </div>
          <small>{container.image}</small>
          {(container.updateAvailable || container.rebuildReady) && (
            <small>
              Update status: {container.updateAvailable ? "update available" : "up to date"}
              {container.rebuildReady ? " (rebuild ready)" : ""}
            </small>
          )}
        </FrostedCard>
      ))}
    </>
  );
}
