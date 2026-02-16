import { LayoutGrid, Network } from "lucide-react";
import { dockerIconProxyUrl, resolveDockerWebUiUrl } from "../../lib/ui";
import type { DockerAction, DockerData } from "../../types";
import { DockerLogo } from "../DockerLogo";
import { IconRow } from "../IconRow";
import { StatusPill } from "../StatusPill";
import { UrlValue } from "./UrlValue";

type DockerContainer = DockerData["containers"][number];

type DockerDetailsDialogProps = {
  container: DockerContainer;
  activeServerBaseUrl: string | undefined;
  canWriteControls: boolean;
  onClose: () => void;
  onRequestAction: (action: DockerAction) => void;
};

export function DockerDetailsDialog({
  container,
  activeServerBaseUrl,
  canWriteControls,
  onClose,
  onRequestAction,
}: DockerDetailsDialogProps) {
  const resolvedWebUi = resolveDockerWebUiUrl(container.endpoint, activeServerBaseUrl);

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Docker details"
      onClick={onClose}
    >
      <div className="dialog settings-dialog docker-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="row docker-dialog-header">
          <div className="docker-title">
            <DockerLogo
              name={container.name}
              iconUrl={container.iconUrl}
              fallbackIconUrl={dockerIconProxyUrl(container.id)}
            />
            <div className="docker-dialog-title">
              <h3>{container.name}</h3>
              <small className="docker-dialog-image">{container.image}</small>
            </div>
          </div>
          <div className="docker-card-actions">
            <StatusPill status={container.status} />
            <button className="secondary dialog-close-button" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="docker-detail-grid">
          <div className="docker-detail-item">
            <small>State</small>
            <strong>{container.stateLabel}</strong>
          </div>
          <div className="docker-detail-item">
            <small>Auto start</small>
            <strong>{container.autoStart ? "yes" : "no"}</strong>
          </div>
          <div className="docker-detail-item">
            <small>Created</small>
            <strong>{container.createdAt}</strong>
          </div>
          <div className="docker-detail-item">
            <small>Network</small>
            <strong>{container.network}</strong>
          </div>
        </div>

        <IconRow label="Ports" value={container.ports} icon={LayoutGrid} />
        <div className="icon-row">
          <div className="icon-row-left">
            <Network size={15} className="row-icon" />
            <small>Web UI</small>
          </div>
          {resolvedWebUi ? (
            <a className="url-link" href={resolvedWebUi} target="_blank" rel="noreferrer">
              {resolvedWebUi}
            </a>
          ) : (
            <UrlValue value={container.endpoint} />
          )}
        </div>

        <div className="actions">
          <button disabled={!canWriteControls} onClick={() => onRequestAction("start")}>
            Start
          </button>
          <button disabled={!canWriteControls} onClick={() => onRequestAction("stop")}>
            Stop
          </button>
          <button disabled={!canWriteControls} onClick={() => onRequestAction("restart")}>
            Restart
          </button>
        </div>
        {!canWriteControls && <small>Write controls disabled: current API scopes are read-only.</small>}
      </div>
    </div>
  );
}
