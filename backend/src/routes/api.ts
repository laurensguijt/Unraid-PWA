import { Router, type Response } from "express";
import { requireCsrf } from "../middleware/csrf.js";
import { writeRateLimit } from "../middleware/writeRateLimit.js";
import { writeAuditLog } from "../services/auditLog.js";
import {
  deleteServer,
  getAppSettings,
  listServers,
  loadServer,
  loadServerById,
  saveServer,
  setActiveServer,
  updateServer,
  updateAppSettings,
} from "../services/secretStore.js";
import {
  archiveNotification,
  fetchArray,
  fetchDocker,
  fetchDockerIcon,
  fetchOverview,
  fetchShares,
  fetchVms,
  hasWriteScopes,
  resolveServerName,
  runArrayAction,
  runContainerAction,
  runVmAction,
  testConnection,
} from "../services/unraidClient.js";
import {
  parseAppSettingsUpdateBody,
  parseResourceId,
  parseServerConnectionTestBody,
  parseServerCreateBody,
  parseServerApiKeyBody,
  parseServerId,
  parseServerUpdateBody,
} from "./requestValidation.js";

export const apiRouter = Router();

const DOCKER_ACTIONS = ["start", "stop", "restart"] as const;
const VM_ACTIONS = ["start", "stop", "pause", "resume", "forceStop", "reboot", "reset"] as const;
const ARRAY_ACTIONS = ["start", "stop"] as const;

function toErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function parseAction<T extends string>(value: string, supported: readonly T[]): T | null {
  if (supported.includes(value as T)) {
    return value as T;
  }
  return null;
}

function respondBadRequest(res: Response, error: string): void {
  res.status(400).json({ error });
}

function normalizeBaseUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

async function runAuditedAction(input: {
  action: string;
  target: string;
  run: () => Promise<void>;
}): Promise<void> {
  try {
    await input.run();
    await writeAuditLog({ action: input.action, target: input.target, result: "ok" });
  } catch (error) {
    await writeAuditLog({ action: input.action, target: input.target, result: "failed" });
    throw error;
  }
}

apiRouter.post("/servers/test", async (req, res) => {
  const parsedBody = parseServerConnectionTestBody(req.body);
  if (!parsedBody.ok) {
    respondBadRequest(res, parsedBody.error);
    return;
  }
  const { baseUrl, apiKey, trustSelfSigned } = parsedBody.value;

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    respondBadRequest(res, "baseUrl must be a valid http(s) URL");
    return;
  }

  try {
    const result = await testConnection(normalizedBaseUrl, apiKey, trustSelfSigned);
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: "Connection test failed",
      detail: toErrorDetail(error),
    });
  }
});

apiRouter.post("/servers", requireCsrf, writeRateLimit, async (req, res) => {
  const parsedBody = parseServerCreateBody(req.body);
  if (!parsedBody.ok) {
    respondBadRequest(res, parsedBody.error);
    return;
  }
  const { baseUrl, apiKey, requestedScopes, name, accentColor, trustSelfSigned } = parsedBody.value;

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    respondBadRequest(res, "baseUrl must be a valid http(s) URL");
    return;
  }

  try {
    const resolvedName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : (await resolveServerName(normalizedBaseUrl, apiKey, trustSelfSigned)) ?? undefined;
    const server = await saveServer({
      name: resolvedName,
      accentColor,
      baseUrl: normalizedBaseUrl,
      apiKey,
      trustSelfSigned,
      scopes: requestedScopes,
      createdAt: new Date().toISOString(),
    });
    const activated = await setActiveServer(server.id);
    res.status(201).json({ ok: true, serverId: server.id, activated });
  } catch (error) {
    res.status(500).json({
      error: "Unable to store server credentials",
      detail: toErrorDetail(error),
    });
  }
});

apiRouter.get("/servers", async (_req, res) => {
  try {
    const data = await listServers();
    res.json({
      activeServerId: data.activeServerId,
      servers: data.servers.map((server) => ({
        id: server.id,
        name: server.name,
        accentColor: server.accentColor,
        baseUrl: server.baseUrl,
        trustSelfSigned: server.trustSelfSigned,
        scopes: server.scopes,
        createdAt: server.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Unable to list servers", detail: toErrorDetail(error) });
  }
});

apiRouter.put("/servers/:id", requireCsrf, writeRateLimit, async (req, res) => {
  try {
    const parsedServerId = parseServerId(req.params.id);
    if (!parsedServerId.ok) {
      respondBadRequest(res, parsedServerId.error);
      return;
    }
    const serverId = parsedServerId.value;

    const parsedBody = parseServerUpdateBody(req.body);
    if (!parsedBody.ok) {
      respondBadRequest(res, parsedBody.error);
      return;
    }
    const { name, trustSelfSigned, accentColor, apiKey } = parsedBody.value;

    let nextName = name;
    if (typeof name === "string" && name.trim().length === 0) {
      const server = await loadServerById(serverId);
      if (!server) {
        res.status(404).json({ error: "Server not found" });
        return;
      }
      nextName =
        (await resolveServerName(server.baseUrl, server.apiKey, server.trustSelfSigned)) ??
        server.name;
    }

    const ok = await updateServer(serverId, {
      name: nextName,
      trustSelfSigned,
      accentColor,
      apiKey,
    });
    if (!ok) {
      res.status(404).json({ error: "Server not found" });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to update server", detail: toErrorDetail(error) });
  }
});

apiRouter.post("/servers/:id/test-key", requireCsrf, writeRateLimit, async (req, res) => {
  const parsedServerId = parseServerId(req.params.id);
  if (!parsedServerId.ok) {
    respondBadRequest(res, parsedServerId.error);
    return;
  }

  const parsedBody = parseServerApiKeyBody(req.body);
  if (!parsedBody.ok) {
    respondBadRequest(res, parsedBody.error);
    return;
  }

  try {
    const server = await loadServerById(parsedServerId.value);
    if (!server) {
      res.status(404).json({ error: "Server not found" });
      return;
    }

    const result = await testConnection(
      server.baseUrl,
      parsedBody.value.apiKey,
      server.trustSelfSigned,
    );
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: "API key test failed",
      detail: toErrorDetail(error),
    });
  }
});

apiRouter.post("/servers/:id/activate", requireCsrf, writeRateLimit, async (req, res) => {
  try {
    const parsedServerId = parseServerId(req.params.id);
    if (!parsedServerId.ok) {
      respondBadRequest(res, parsedServerId.error);
      return;
    }
    const serverId = parsedServerId.value;

    const ok = await setActiveServer(serverId);
    if (!ok) {
      res.status(404).json({ error: "Server not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to activate server", detail: toErrorDetail(error) });
  }
});

apiRouter.delete("/servers/:id", requireCsrf, writeRateLimit, async (req, res) => {
  try {
    const parsedServerId = parseServerId(req.params.id);
    if (!parsedServerId.ok) {
      respondBadRequest(res, parsedServerId.error);
      return;
    }
    const serverId = parsedServerId.value;

    const ok = await deleteServer(serverId);
    if (!ok) {
      res.status(404).json({ error: "Server not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to remove server", detail: toErrorDetail(error) });
  }
});

apiRouter.get("/servers/status", async (_req, res) => {
  try {
    const server = await loadServer();
    if (!server) {
      res.json({ configured: false });
      return;
    }
    res.json({
      configured: true,
      id: server.id,
      name: server.name,
      accentColor: server.accentColor,
      baseUrl: server.baseUrl,
      trustSelfSigned: server.trustSelfSigned,
      scopes: server.scopes,
      canWrite: hasWriteScopes(server.scopes),
      createdAt: server.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Unable to load server status", detail: toErrorDetail(error) });
  }
});

apiRouter.get("/overview", async (_req, res) => {
  try {
    const overview = await fetchOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({
      error: "Overview fetch failed",
      detail: toErrorDetail(error),
    });
  }
});

apiRouter.get("/settings/app", async (_req, res) => {
  try {
    const settings = await getAppSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Unable to load app settings", detail: toErrorDetail(error) });
  }
});

apiRouter.put("/settings/app", requireCsrf, writeRateLimit, async (req, res) => {
  try {
    const parsedBody = parseAppSettingsUpdateBody(req.body);
    if (!parsedBody.ok) {
      respondBadRequest(res, parsedBody.error);
      return;
    }

    const next = await updateAppSettings(parsedBody.value);
    res.json(next);
  } catch (error) {
    res.status(500).json({ error: "Unable to save app settings", detail: toErrorDetail(error) });
  }
});

apiRouter.get("/array", async (_req, res) => {
  try {
    const array = await fetchArray();
    res.json(array);
  } catch (error) {
    res.status(500).json({
      error: "Array fetch failed",
      detail: toErrorDetail(error),
    });
  }
});

apiRouter.get("/docker", async (_req, res) => {
  try {
    const docker = await fetchDocker();
    res.json(docker);
  } catch (error) {
    res.status(500).json({
      error: "Docker fetch failed",
      detail: toErrorDetail(error),
    });
  }
});

apiRouter.get("/docker/:id/icon", async (req, res) => {
  try {
    const icon = await fetchDockerIcon(req.params.id);
    if (!icon) {
      res.status(404).end();
      return;
    }
    res.setHeader("content-type", icon.contentType);
    res.setHeader("cache-control", "public, max-age=300");
    res.send(icon.data);
  } catch {
    res.status(404).end();
  }
});

apiRouter.get("/vms", async (_req, res) => {
  try {
    const vms = await fetchVms();
    res.json(vms);
  } catch (error) {
    res.status(500).json({
      error: "VM fetch failed",
      detail: toErrorDetail(error),
    });
  }
});

apiRouter.get("/shares", async (_req, res) => {
  try {
    const shares = await fetchShares();
    res.json(shares);
  } catch (error) {
    res.status(500).json({
      error: "Shares fetch failed",
      detail: toErrorDetail(error),
    });
  }
});

apiRouter.post(
  "/notifications/:id/archive",
  requireCsrf,
  writeRateLimit,
  async (req, res) => {
    const parsedNotificationId = parseResourceId(req.params.id, "Notification id");
    if (!parsedNotificationId.ok) {
      respondBadRequest(res, parsedNotificationId.error);
      return;
    }
    const notificationId = parsedNotificationId.value;

    try {
      await runAuditedAction({
        action: "notification:archive",
        target: notificationId,
        run: () => archiveNotification(notificationId),
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: "Archive notification failed",
        detail: toErrorDetail(error),
      });
    }
  },
);

apiRouter.post(
  "/docker/:id/:action",
  requireCsrf,
  writeRateLimit,
  async (req, res) => {
    const action = parseAction(req.params.action, DOCKER_ACTIONS);
    if (!action) {
      respondBadRequest(res, "Unsupported action");
      return;
    }
    const parsedId = parseResourceId(req.params.id, "Container id");
    if (!parsedId.ok) {
      respondBadRequest(res, parsedId.error);
      return;
    }
    const containerId = parsedId.value;

    try {
      await runAuditedAction({
        action,
        target: containerId,
        run: () => runContainerAction(containerId, action),
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: "Container action failed",
        detail: toErrorDetail(error),
      });
    }
  },
);

apiRouter.post(
  "/vms/:id/:action",
  requireCsrf,
  writeRateLimit,
  async (req, res) => {
    const action = parseAction(req.params.action, VM_ACTIONS);
    if (!action) {
      respondBadRequest(res, "Unsupported action");
      return;
    }
    const parsedId = parseResourceId(req.params.id, "VM id");
    if (!parsedId.ok) {
      respondBadRequest(res, parsedId.error);
      return;
    }
    const vmId = parsedId.value;

    try {
      await runAuditedAction({
        action: `vm:${action}`,
        target: vmId,
        run: () => runVmAction(vmId, action),
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: "VM action failed",
        detail: toErrorDetail(error),
      });
    }
  },
);

apiRouter.post(
  "/array/:action",
  requireCsrf,
  writeRateLimit,
  async (req, res) => {
    const action = parseAction(req.params.action, ARRAY_ACTIONS);
    if (!action) {
      respondBadRequest(res, "Unsupported action");
      return;
    }

    try {
      await runAuditedAction({
        action: `array:${action}`,
        target: "array",
        run: () => runArrayAction(action),
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: "Array action failed",
        detail: toErrorDetail(error),
      });
    }
  },
);
