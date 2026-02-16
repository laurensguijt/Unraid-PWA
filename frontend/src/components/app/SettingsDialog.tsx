import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { ServerRecord } from "../../types";
import { BadgePill } from "../BadgePill";
import { FrostedCard } from "../FrostedCard";
import { SectionHeader } from "../SectionHeader";
import { UrlValue } from "./UrlValue";

type SettingsDialogProps = {
  open: boolean;
  servers: ServerRecord[];
  activeServerId: string | null;
  renameInput: Record<string, string>;
  apiKeyInput: Record<string, string>;
  themeMode: "dark" | "light";
  updateIntervalMs: number;
  onClose: () => void;
  onActivateServer: (id: string) => void;
  onStartRename: (id: string, currentName: string) => void;
  onRenameInputChange: (id: string, value: string) => void;
  onApiKeyInputChange: (id: string, value: string) => void;
  onSaveRename: (id: string) => void;
  onSaveApiKey: (id: string) => void;
  onRemoveServer: (id: string) => void;
  onSetServerTrustSelfSigned: (id: string, value: boolean) => void;
  onSetServerAccentColor: (id: string, value: string) => void;
  onAddServer: () => void;
  onThemeModeChange: (mode: "dark" | "light") => void;
  onUpdateIntervalChange: (nextMs: number) => void;
};

export function SettingsDialog({
  open,
  servers,
  activeServerId,
  renameInput,
  apiKeyInput,
  themeMode,
  updateIntervalMs,
  onClose,
  onActivateServer,
  onStartRename,
  onRenameInputChange,
  onApiKeyInputChange,
  onSaveRename,
  onSaveApiKey,
  onRemoveServer,
  onSetServerTrustSelfSigned,
  onSetServerAccentColor,
  onAddServer,
  onThemeModeChange,
  onUpdateIntervalChange,
}: SettingsDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div className="dialog settings-dialog dialog--closable" onClick={(event) => event.stopPropagation()}>
        <button
          className="dialog-close-icon"
          type="button"
          onClick={onClose}
          aria-label="Close settings dialog"
          title="Close"
        >
          <X size={16} />
        </button>
        <div className="dialog-header">
          <h3>Settings</h3>
          <p className="dialog-subtitle">Manage servers and app preferences.</p>
        </div>

        <FrostedCard>
          <SectionHeader title="Server management" right={<BadgePill value={servers.length} />} />
          {servers.map((server) => (
            <div key={server.id} className="list-item">
              <div className="row">
                <strong>{server.name}</strong>
                {activeServerId === server.id ? <BadgePill value="Active" /> : null}
              </div>
              <div className="server-key-row">
                <label className="server-key-control">
                  API key
                  <input
                    type="password"
                    value={apiKeyInput[server.id] ?? ""}
                    onChange={(event) => onApiKeyInputChange(server.id, event.target.value)}
                    placeholder="••••••••••••••••"
                    autoComplete="new-password"
                  />
                </label>
                <button
                  className="secondary"
                  type="button"
                  disabled={!apiKeyInput[server.id]?.trim()}
                  onClick={() => onSaveApiKey(server.id)}
                >
                  Test + save key
                </button>
              </div>
              <label className="server-accent-control">
                Accent color
                <input
                  type="color"
                  value={server.accentColor}
                  onChange={(event) => onSetServerAccentColor(server.id, event.target.value)}
                />
              </label>
              <UrlValue value={server.baseUrl} />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={server.trustSelfSigned}
                  onChange={(event) => onSetServerTrustSelfSigned(server.id, event.target.checked)}
                />
                Trust self signed certificates
              </label>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={activeServerId === server.id}
                  onClick={() => onActivateServer(server.id)}
                >
                  Use
                </button>
                <button
                  className="secondary"
                  onClick={() => onStartRename(server.id, server.name)}
                >
                  <Pencil size={14} /> Rename
                </button>
                <button className="secondary" onClick={() => onRemoveServer(server.id)}>
                  <Trash2 size={14} /> Remove
                </button>
              </div>
              {renameInput[server.id] !== undefined && (
                <div className="actions">
                  <input
                    value={renameInput[server.id]}
                    onChange={(event) => onRenameInputChange(server.id, event.target.value)}
                    placeholder="Leave blank to use Unraid server name"
                  />
                  <button onClick={() => onSaveRename(server.id)}>Save</button>
                </div>
              )}
            </div>
          ))}

          <div className="actions">
            <button className="secondary" onClick={onAddServer}>
              <Plus size={14} /> Add server
            </button>
          </div>
        </FrostedCard>

        <FrostedCard>
          <SectionHeader title="App settings" />
          <div className="settings-grid">
            <label>
              Theme mode
              <select
                value={themeMode}
                onChange={(event) => onThemeModeChange(event.target.value as "dark" | "light")}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>

            <label>
              Update interval ({Math.round(updateIntervalMs / 1000)}s)
              <input
                type="range"
                min={2}
                max={30}
                step={1}
                value={Math.round(updateIntervalMs / 1000)}
                onChange={(event) => {
                  const seconds = Number(event.target.value);
                  const nextMs = Math.min(30000, Math.max(2000, Math.round(seconds * 1000)));
                  onUpdateIntervalChange(nextMs);
                }}
              />
            </label>
          </div>
        </FrostedCard>
      </div>
    </div>
  );
}
