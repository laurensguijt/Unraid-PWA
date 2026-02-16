import type { VmAction } from "../types";

const WRITE_ACTIONS = ["create_any", "create_own", "update_any", "update_own", "delete_any", "delete_own"];

export function hasLikelyWriteScopes(scopes: string[]): boolean {
  return scopes.some((scope) => {
    const normalized = scope.toLowerCase();
    return (
      normalized.includes("write") ||
      normalized.includes("admin") ||
      WRITE_ACTIONS.some((action) => normalized.includes(action))
    );
  });
}

export function isHttpUrl(value: string): boolean {
  if (!value || value === "-") {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function toManagementAccessUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}/Settings/ManagementAccess`;
  } catch {
    return null;
  }
}

export function resolveDockerWebUiUrl(endpoint: string, serverBaseUrl: string | undefined): string | null {
  if (!endpoint || endpoint === "-" || !serverBaseUrl) {
    return null;
  }

  let hostname: string;
  try {
    hostname = new URL(serverBaseUrl).hostname;
  } catch {
    return null;
  }

  let resolved = endpoint.replace(/\[IP\]/gi, hostname).replace(/\[PORT:(\d+)\]/gi, ":$1");
  if (!/^https?:\/\//i.test(resolved)) {
    resolved = `http://${resolved}`;
  }
  return isHttpUrl(resolved) ? resolved : null;
}

export function formatUpsRuntime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "-";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatRelativeDaysAgo(value: string): string {
  if (!value || value === "-") {
    return "-";
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  const diffMs = Date.now() - parsed;
  if (diffMs < 0) {
    return "today";
  }
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) {
    return "today";
  }
  if (days === 1) {
    return "1 day ago";
  }
  return `${days} days ago`;
}

export function formatUnraidLine(distro: string, license: string, version: string): string {
  const cleanDistro = distro && distro !== "-" ? distro : "Unraid OS";
  const cleanLicense = license && license !== "-" ? ` (${license})` : "";
  const cleanVersion = version && version !== "-" ? ` ${version}` : "";
  return `${cleanDistro}${cleanLicense}${cleanVersion}`.trim();
}

export function vmActionsForState(stateLabel: string): VmAction[] {
  const normalized = stateLabel.toLowerCase();
  if (normalized.includes("running")) {
    return ["pause", "stop", "reboot", "reset", "forceStop"];
  }
  if (normalized.includes("paused")) {
    return ["resume", "stop", "reboot", "reset", "forceStop"];
  }
  if (normalized.includes("shut") || normalized.includes("stop")) {
    return ["start"];
  }
  return ["start", "stop", "reboot", "reset"];
}

export function vmActionLabel(action: VmAction): string {
  if (action === "forceStop") {
    return "Force stop";
  }
  return action.charAt(0).toUpperCase() + action.slice(1);
}

export function dockerIconProxyUrl(containerId: string): string {
  return `/api/docker/${encodeURIComponent(containerId)}/icon`;
}
