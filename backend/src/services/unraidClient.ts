import { loadServer } from "./secretStore.js";
import type {
  ArrayResponse,
  DockerResponse,
  OverviewResponse,
  SharesResponse,
  VmsResponse,
} from "../types/api.js";
import { mapArray, mapDocker, mapOverview, mapVms } from "./mappers.js";

type GqlPayload<T> = { data?: T; errors?: Array<{ message: string }> };

/**
 * Unraid API uses AuthAction: CREATE_ANY, READ_ANY, UPDATE_ANY, DELETE_ANY (and _OWN variants).
 * No "write" scope; write = create/update/delete. Resources: ARRAY, DOCKER, VMS, INFO, etc.
 */
/** Scopes we suggest in the UI when reporting "missing recommended". */
const RECOMMENDED_READ_LABELS = ["read:monitoring", "read:docker", "read:vms", "read:array"];
/** For each label, patterns that mean the user already has that read access (Unraid or legacy). */
const SATISFIES_READ: Record<string, string[]> = {
  "read:monitoring": ["read:monitoring", "monitoring", "info", "read_any", "read_own"],
  "read:docker": ["read:docker", "docker", "read_any", "read_own"],
  "read:vms": ["read:vms", "vms", "read_any", "read_own"],
  "read:array": ["read:array", "array", "read_any", "read_own"],
};
/** Unraid may return only read:monitoring/info for keys with full read; treat as all read satisfied. */
const IMPLIES_FULL_READ = ["read:monitoring", "monitoring", "info", "read_any", "read_own"];
/** Unraid write = create/update/delete actions (AuthAction). Also accept legacy "write" and "admin". */
const UNRAID_WRITE_ACTIONS = ["create_any", "create_own", "update_any", "update_own", "delete_any", "delete_own"];

function shouldAllowSelfSigned(trustSelfSigned: boolean | undefined): boolean {
  if (typeof trustSelfSigned === "boolean") {
    return trustSelfSigned;
  }
  return (process.env.UNRAID_BFF_ALLOW_SELF_SIGNED ?? "true") === "true";
}

async function withTlsVerification<T>(
  trustSelfSigned: boolean | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const previousTlsSetting = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = shouldAllowSelfSigned(trustSelfSigned) ? "0" : "1";
  try {
    return await run();
  } finally {
    if (previousTlsSetting === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTlsSetting;
    }
  }
}

async function requestGraphql<T>(
  baseUrl: string,
  apiKey: string,
  trustSelfSigned: boolean | undefined,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<{ data: T; headers: Headers }> {
  let response: Response;
  try {
    response = await withTlsVerification(trustSelfSigned, async () =>
      fetch(`${baseUrl.replace(/\/$/, "")}/graphql`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ query, variables }),
      }),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown fetch error";
    throw new Error(`Unable to reach Unraid GraphQL endpoint: ${reason}`);
  }

  const payload = (await response.json().catch(() => ({}))) as GqlPayload<T>;
  if (!response.ok) {
    const detail = payload.errors?.map((item) => item.message).filter(Boolean).join(" | ");
    throw new Error(
      detail ? `Unraid request failed: ${response.status} (${detail})` : `Unraid request failed: ${response.status}`,
    );
  }
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  if (!payload.data) {
    throw new Error("No data returned by Unraid GraphQL API.");
  }

  return { data: payload.data, headers: response.headers };
}

async function requestBinary(
  apiKey: string,
  trustSelfSigned: boolean | undefined,
  url: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const response = await withTlsVerification(trustSelfSigned, async () =>
      fetch(url, {
        headers: {
          "x-api-key": apiKey,
        },
      }),
    );
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return null;
    }
    const bytes = await response.arrayBuffer();
    return { data: Buffer.from(bytes), contentType };
  } catch {
    return null;
  }
}

async function gqlRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const server = await loadServer();
  if (!server) {
    throw new Error("Server not configured yet.");
  }
  const { data } = await requestGraphql<T>(
    server.baseUrl,
    server.apiKey,
    server.trustSelfSigned,
    query,
    variables,
  );
  return data;
}

function readScopesFromHeaders(headers: Headers): string[] {
  const headerValue =
    headers.get("x-unraid-scopes") ??
    headers.get("x-api-scopes") ??
    headers.get("x-scopes");
  if (!headerValue) {
    return [];
  }
  return headerValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function formatKilobytesToHuman(value: unknown): string {
  const kb = Number(value ?? 0);
  if (!Number.isFinite(kb) || kb <= 0) {
    return "-";
  }
  const bytes = kb * 1024;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let current = bytes;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  const rounded = current >= 100 ? current.toFixed(0) : current.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

function matchMissingScopes(granted: string[]): string[] {
  const lower = granted.map((scope) => scope.toLowerCase());
  const hasFullReadHint = lower.some((s) => IMPLIES_FULL_READ.some((p) => s.includes(p)));
  if (hasFullReadHint) {
    return [];
  }
  return RECOMMENDED_READ_LABELS.filter((label) => {
    const patterns = SATISFIES_READ[label];
    return !patterns.some((p) => lower.some((s) => s.includes(p)));
  });
}

export async function testConnection(
  baseUrl: string,
  apiKey: string,
  trustSelfSigned?: boolean,
): Promise<{ ok: boolean; scopes: string[]; missingScopes: string[]; canWrite: boolean }> {
  const { headers } = await requestGraphql<unknown>(
    baseUrl,
    apiKey,
    trustSelfSigned,
    "query Ping { __typename }",
  );
  const scopeHints = readScopesFromHeaders(headers);
  const scopes = dedupe(scopeHints.length > 0 ? scopeHints : ["read:monitoring"]);
  const missingScopes = matchMissingScopes(scopes);
  return {
    ok: true,
    scopes,
    missingScopes,
    canWrite: hasWriteScopes(scopes),
  };
}

export async function resolveServerName(
  baseUrl: string,
  apiKey: string,
  trustSelfSigned?: boolean,
): Promise<string | null> {
  try {
    const { data } = await requestGraphql<{
      vars?: { name?: string };
      info?: { os?: { hostname?: string } };
    }>(
      baseUrl,
      apiKey,
      trustSelfSigned,
      "query ResolveServerName { vars { name } info { os { hostname } } }",
    );
    const directName = data.vars?.name?.trim();
    if (directName) {
      return directName;
    }
    const hostname = data.info?.os?.hostname?.trim();
    if (hostname) {
      return hostname;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchOverview(): Promise<OverviewResponse> {
  let core: unknown;
  try {
    core = await gqlRequest<unknown>(
      "query OverviewCore { vars { name version regTy } info { time cpu { brand cores threads speed } os { distro platform kernel hostname uptime } baseboard { manufacturer model } } metrics { cpu { percentTotal } memory { percentTotal used total free } } array { state capacity { kilobytes { used free total } } parityCheckStatus { date duration speed status progress errors running } } }",
    );
  } catch {
    core = await gqlRequest<unknown>(
      "query OverviewCoreFallback { vars { name version regTy } info { time cpu { brand cores threads speed } os { distro kernel hostname uptime } } metrics { cpu { percentTotal } memory { percentTotal used total free } } array { state capacity { kilobytes { used free total } } parityCheckStatus { status progress errors running } } }",
    );
  }

  const notificationsOverview = await gqlRequest<unknown>(
    "query OverviewNotificationsOverview { notifications { overview { unread { info warning alert total } } } }",
  ).catch(() => null);

  const notificationsList = await gqlRequest<unknown>(
    "query OverviewNotificationsList { notifications { warningsAndAlerts { id title importance timestamp description } } }",
  ).catch(() => null);

  const notificationsListFallback = await gqlRequest<unknown>(
    "query OverviewNotificationsListFallback { notifications { list(filter: { type: UNREAD, offset: 0, limit: 25 }) { id title importance timestamp description } } }",
  ).catch(() => null);

  const notifications =
    notificationsOverview || notificationsList
      ? {
          notifications: {
            overview:
              (notificationsOverview as { notifications?: { overview?: unknown } } | null)?.notifications
                ?.overview ?? null,
            warningsAndAlerts:
              (notificationsList as { notifications?: { warningsAndAlerts?: unknown } } | null)?.notifications
                ?.warningsAndAlerts ??
              (notificationsListFallback as { notifications?: { list?: unknown } } | null)?.notifications
                ?.list ??
              [],
          },
        }
      : null;

  const network = await gqlRequest<unknown>(
    "query OverviewNetwork { network { accessUrls { type name ipv4 ipv6 } } }",
  ).catch(() => null);

  const ups = await gqlRequest<unknown>(
    "query OverviewUps { upsDevices { id name model status battery { chargeLevel estimatedRuntime health } power { inputVoltage outputVoltage loadPercentage } } }",
  ).catch(() => null);

  return mapOverview({
    core,
    notifications,
    network,
    ups,
  });
}

export async function fetchArray(): Promise<ArrayResponse> {
  let data: unknown;
  try {
    data = await gqlRequest<unknown>(
      "query Array { array { state capacity { kilobytes { used free total } } parityCheckStatus { status progress errors running } parities { id name device type fsType temp size fsUsed fsFree numErrors } disks { id name device type fsType temp size fsUsed fsFree numErrors } caches { id name device type fsType temp size fsUsed fsFree numErrors } } }",
    );
  } catch {
    data = await gqlRequest<unknown>(
      "query ArrayFallback { array { state capacity { kilobytes { used free total } } parityCheckStatus { status progress errors running } disks { id name fsType temp size fsUsed fsFree numErrors } caches { id name fsType temp size fsUsed fsFree numErrors } } }",
    );
  }
  return mapArray(data);
}

export async function fetchDocker(): Promise<DockerResponse> {
  const queries = [
    "query Docker { docker { containers { id names image iconUrl webUiUrl labels status state created autoStart hostConfig { networkMode } ports { privatePort publicPort type } } } }",
    "query Docker { docker { containers { id names image iconUrl labels status state created autoStart hostConfig { networkMode } ports { privatePort publicPort type } } } }",
    "query Docker { docker { containers { id names image webUiUrl labels status state created autoStart hostConfig { networkMode } ports { privatePort publicPort type } } } }",
    "query Docker { docker { containers { id names image labels status state created autoStart hostConfig { networkMode } ports { privatePort publicPort type } } } }",
  ];
  let lastError: unknown = null;
  for (const query of queries) {
    try {
      const data = await gqlRequest<unknown>(query);
      return mapDocker(data);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Docker query failed.");
}

export async function fetchVms(): Promise<VmsResponse> {
  const data = await gqlRequest<unknown>("query Vms { vms { domains { id name state } } }");
  return mapVms(data);
}

export async function fetchShares(): Promise<SharesResponse> {
  const data = await gqlRequest<{ shares?: Array<Record<string, unknown>> }>(
    "query Shares { shares { id name allocator splitLevel size used free cache include exclude } }",
  );
  return {
    shares: (data.shares ?? []).map((share) => {
      const size = Number(share.size ?? 0);
      const used = Number(share.used ?? 0);
      const free = Number(share.free ?? 0);
      const denominator = size > 0 ? size : used + free;
      const usagePercent = denominator > 0 ? Math.round((used / denominator) * 100) : 0;
      const include = Array.isArray(share.include)
        ? (share.include as unknown[]).filter((value) => typeof value === "string" && value.trim().length > 0)
        : [];
      const exclude = Array.isArray(share.exclude)
        ? (share.exclude as unknown[]).filter((value) => typeof value === "string" && value.trim().length > 0)
        : [];
      const location =
        include.length > 0
          ? `Include: ${include.join(", ")}`
          : exclude.length > 0
            ? `Exclude: ${exclude.join(", ")}`
            : "All disks";
      return {
        id: String(share.id ?? "-"),
        name: String(share.name ?? "-"),
        allocator: String(share.allocator ?? "-"),
        splitLevel: String(share.splitLevel ?? "-"),
        size: formatKilobytesToHuman(size),
        used: formatKilobytesToHuman(used),
        free: formatKilobytesToHuman(free),
        cached: share.cache == null ? "-" : share.cache ? "yes" : "no",
        usagePercent,
        location,
      };
    }),
  };
}

async function tryMutation(
  mutationCandidates: Array<{ query: string; variables: Record<string, unknown> }>,
): Promise<void> {
  const failures: string[] = [];
  for (const candidate of mutationCandidates) {
    try {
      await gqlRequest<unknown>(candidate.query, candidate.variables);
      return;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Unknown mutation failure");
    }
  }
  throw new Error(failures.join(" | "));
}

export async function runContainerAction(
  containerId: string,
  action: "start" | "stop" | "restart",
): Promise<void> {
  if (action === "restart") {
    await tryMutation([
      {
        query: "mutation DockerStop($id: PrefixedID!) { docker { stop(id: $id) { id } } }",
        variables: { id: containerId },
      },
    ]);
    await tryMutation([
      {
        query: "mutation DockerStart($id: PrefixedID!) { docker { start(id: $id) { id } } }",
        variables: { id: containerId },
      },
    ]);
    return;
  }

  const dockerMutation = action === "start" ? "start" : "stop";
  await tryMutation([
    {
      query: `mutation DockerAction($id: PrefixedID!) { docker { ${dockerMutation}(id: $id) { id } } }`,
      variables: { id: containerId },
    },
    {
      query: "mutation DockerLegacyAction($id: String!, $action: String!) { dockerContainerAction(id: $id, action: $action) { __typename } }",
      variables: { id: containerId, action },
    },
    {
      query: "mutation DockerLegacyAction($id: String!, $action: String!) { dockerAction(id: $id, action: $action) { __typename } }",
      variables: { id: containerId, action },
    },
  ]);
}

export async function runVmAction(
  vmId: string,
  action: "start" | "stop" | "pause" | "resume" | "forceStop" | "reboot" | "reset",
): Promise<void> {
  const vmMutationMap: Record<
    "start" | "stop" | "pause" | "resume" | "forceStop" | "reboot" | "reset",
    string
  > = {
    start: "start",
    stop: "stop",
    pause: "pause",
    resume: "resume",
    forceStop: "forceStop",
    reboot: "reboot",
    reset: "reset",
  };
  const vmMutation = vmMutationMap[action];
  const legacyAction = action === "forceStop" ? "force-stop" : action.toLowerCase();
  await tryMutation([
    {
      query: `mutation VmAction($id: PrefixedID!) { vm { ${vmMutation}(id: $id) } }`,
      variables: { id: vmId },
    },
    {
      query: "mutation VmAction($id: String!, $action: String!) { vmAction(id: $id, action: $action) { __typename } }",
      variables: { id: vmId, action: legacyAction },
    },
    {
      query: "mutation VmAction($id: String!, $action: String!) { virtualMachineAction(id: $id, action: $action) { __typename } }",
      variables: { id: vmId, action: legacyAction },
    },
  ]);
}

export async function runArrayAction(action: "start" | "stop"): Promise<void> {
  const desiredState = action === "start" ? "START" : "STOP";
  await tryMutation([
    {
      query: "mutation ArraySetState($desiredState: ArrayStateInputState!) { array { setState(input: { desiredState: $desiredState }) { id } } }",
      variables: { desiredState },
    },
    {
      query: "mutation ArrayAction($action: String!) { arrayAction(action: $action) { __typename } }",
      variables: { action },
    },
  ]);
}

export async function archiveNotification(notificationId: string): Promise<void> {
  await tryMutation([
    {
      query: "mutation ArchiveNotification($id: PrefixedID!) { archiveNotification(id: $id) { id } }",
      variables: { id: notificationId },
    },
  ]);
}

/** True when we only have the default/fallback scope (no real scope headers from Unraid). */
function isUncertainScopes(scopes: string[]): boolean {
  if (scopes.length === 0) return true;
  if (scopes.length === 1 && scopes[0].toLowerCase() === "read:monitoring") return true;
  return false;
}

export function hasWriteScopes(scopes: string[]): boolean {
  if (isUncertainScopes(scopes)) {
    return true;
  }
  const lower = scopes.map((scope) => scope.toLowerCase());
  return (
    lower.some((scope) => scope.includes("admin")) ||
    lower.some((scope) => scope.includes("write")) ||
    lower.some((scope) =>
      UNRAID_WRITE_ACTIONS.some((action) => scope.includes(action)),
    )
  );
}

function sanitizeForIconPath(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\//, "")
    .replace(/[^a-z0-9._-]+/g, "-");
}

function toAbsoluteUrl(baseUrl: string, urlOrPath: string): string {
  if (/^https?:\/\//i.test(urlOrPath)) {
    return urlOrPath;
  }
  return `${baseUrl.replace(/\/$/, "")}/${urlOrPath.replace(/^\//, "")}`;
}

export async function fetchDockerIcon(
  containerId: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  const server = await loadServer();
  if (!server) {
    return null;
  }

  const meta = await gqlRequest<{
    docker?: {
      container?: {
        names?: string[];
        image?: string;
        labels?: Record<string, unknown>;
      };
    };
  }>(
    "query DockerIconMeta($id: PrefixedID!) { docker { container(id: $id) { names image labels } } }",
    { id: containerId },
  ).catch(() => null);

  const container = meta?.docker?.container;
  if (!container) {
    return null;
  }

  const firstName = (container.names?.[0] ?? "").replace(/^\//, "");
  const imageName = (container.image ?? "").split("/").pop()?.split(":")[0] ?? "";
  const labels = container.labels ?? {};
  const labelIcon = typeof labels["net.unraid.docker.icon"] === "string" ? labels["net.unraid.docker.icon"] : "";
  const nameSlug = sanitizeForIconPath(firstName);
  const imageSlug = sanitizeForIconPath(imageName);
  const candidates = [
    labelIcon,
    `/plugins/dynamix.docker.manager/images/${nameSlug}-icon.png`,
    `/plugins/dynamix.docker.manager/images/${nameSlug}.png`,
    `/plugins/dynamix.docker.manager/images/${imageSlug}-icon.png`,
    `/plugins/dynamix.docker.manager/images/${imageSlug}.png`,
    `/plugins/dynamix.docker.manager/images/${nameSlug}.jpg`,
    `/plugins/dynamix.docker.manager/images/${imageSlug}.jpg`,
  ].filter((item) => item.length > 0);

  for (const candidate of candidates) {
    const absolute = toAbsoluteUrl(server.baseUrl, candidate);
    const icon = await requestBinary(server.apiKey, server.trustSelfSigned, absolute);
    if (icon) {
      return icon;
    }
  }

  return null;
}
