import { BadgePill } from "../BadgePill";
import { SectionHeader } from "../SectionHeader";

type SetupFormProps = {
  title?: string;
  scopeInfo: string[];
  missingScopes: string[];
  serverName: string;
  serverUrl: string;
  apiKey: string;
  trustSelfSigned: boolean;
  managementAccessUrl: string | null;
  isTestingSetup: boolean;
  isSavingSetup: boolean;
  onServerNameChange: (value: string) => void;
  onServerUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onTrustSelfSignedChange: (value: boolean) => void;
  onTestConnection: () => void;
  onCancel?: () => void;
  onSubmit: () => void;
};

export function SetupForm({
  title = "First run setup",
  scopeInfo,
  missingScopes,
  serverName,
  serverUrl,
  apiKey,
  trustSelfSigned,
  managementAccessUrl,
  isTestingSetup,
  isSavingSetup,
  onServerNameChange,
  onServerUrlChange,
  onApiKeyChange,
  onTrustSelfSignedChange,
  onTestConnection,
  onCancel,
  onSubmit,
}: SetupFormProps) {
  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <SectionHeader
        title={title}
        right={scopeInfo.length ? <BadgePill value={`${scopeInfo.length} scopes`} /> : undefined}
      />
      <label>
        Server name
        <input
          value={serverName}
          onChange={(event) => onServerNameChange(event.target.value)}
          placeholder="Leave blank to use Unraid server name"
        />
      </label>
      <label>
        Server base URL
        <input
          value={serverUrl}
          onChange={(event) => onServerUrlChange(event.target.value)}
          placeholder="https://<server-ip>:3443"
          required
        />
      </label>
      <label>
        API key
        <input
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          placeholder="unraid-api-key"
          required
        />
        {managementAccessUrl && (
          <small className="setup-help-inline">
            Get API key:{" "}
            <a className="url-link" href={managementAccessUrl} target="_blank" rel="noreferrer">
              {managementAccessUrl}
            </a>
          </small>
        )}
        <details className="setup-scope-help">
          <summary>API permissions</summary>
          <small>
            <strong>Read-only (viewer):</strong> READ_ANY or viewer role for array, docker, vms, info
          </small>
          <br />
          <small>
            <strong>Full control:</strong> CREATE_ANY, UPDATE_ANY, DELETE_ANY (or admin role)
          </small>
        </details>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={trustSelfSigned}
          onChange={(event) => onTrustSelfSignedChange(event.target.checked)}
        />
        Trust self signed certificates
      </label>
      <div className="actions">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="secondary"
          disabled={isTestingSetup || isSavingSetup}
          onClick={onTestConnection}
        >
          {isTestingSetup ? "Testing..." : "Test connection"}
        </button>
        <button type="submit" disabled={isSavingSetup || isTestingSetup}>
          {isSavingSetup ? "Connecting..." : "Save and connect"}
        </button>
      </div>
      {scopeInfo.length > 0 && <small>Detected scopes: {scopeInfo.join(", ")}</small>}
      {missingScopes.length > 0 && (
        <small>Missing recommended read scopes: {missingScopes.join(", ")}</small>
      )}
    </form>
  );
}
