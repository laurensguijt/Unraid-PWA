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
import type { SetupPayload } from "../types/api.js";

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
  const { baseUrl, apiKey, trustSelfSigned } = req.body as SetupPayload;
  if (!baseUrl || !apiKey) {
    respondBadRequest(res, "baseUrl and apiKey are required");
    return;
  }

  try {
    const result = await testConnection(baseUrl, apiKey, trustSelfSigned);
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: "Connection test failed",
      detail: toErrorDetail(error),
    });
  }
});

apiRouter.post("/servers", requireCsrf, async (req, res) => {
  const { baseUrl, apiKey, requestedScopes = [], name, trustSelfSigned = true } = req.body as SetupPayload;
  if (!baseUrl || !apiKey) {
    respondBadRequest(res, "baseUrl and apiKey are required");
    return;
  }

  try {
    const resolvedName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : (await resolveServerName(baseUrl, apiKey, trustSelfSigned)) ?? undefined;
    const server = await saveServer({
      name: resolvedName,
      baseUrl,
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
  const data = await listServers();
  res.json({
    activeServerId: data.activeServerId,
    servers: data.servers.map((server) => ({
      id: server.id,
      name: server.name,
      baseUrl: server.baseUrl,
      trustSelfSigned: server.trustSelfSigned,
      scopes: server.scopes,
      createdAt: server.createdAt,
    })),
  });
});

apiRouter.put("/servers/:id", requireCsrf, async (req, res) => {
  const serverId = req.params.id;
  const { name, trustSelfSigned } = req.body as { name?: string; trustSelfSigned?: boolean };

  if (name === undefined && trustSelfSigned === undefined) {
    respondBadRequest(res, "name or trustSelfSigned is required");
    return;
  }

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

  const ok = await updateServer(serverId, { name: nextName, trustSelfSigned });
  if (!ok) {
    res.status(404).json({ error: "Server not found" });
    return;
  }

  res.json({ ok: true });
});

apiRouter.post("/servers/:id/activate", requireCsrf, async (req, res) => {
  const serverId = req.params.id;
  const ok = await setActiveServer(serverId);
  if (!ok) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  res.json({ ok: true });
});

apiRouter.delete("/servers/:id", requireCsrf, async (req, res) => {
  const serverId = req.params.id;
  const ok = await deleteServer(serverId);
  if (!ok) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  res.json({ ok: true });
});

apiRouter.get("/servers/status", async (_req, res) => {
  const server = await loadServer();
  if (!server) {
    res.json({ configured: false });
    return;
  }
  res.json({
    configured: true,
    id: server.id,
    name: server.name,
    baseUrl: server.baseUrl,
    trustSelfSigned: server.trustSelfSigned,
    scopes: server.scopes,
    canWrite: hasWriteScopes(server.scopes),
    createdAt: server.createdAt,
  });
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
  const settings = await getAppSettings();
  res.json(settings);
});

apiRouter.put("/settings/app", requireCsrf, async (req, res) => {
  const payload = req.body as { themeMode?: "dark" | "light"; accentColor?: string };
  const next = await updateAppSettings(payload);
  res.json(next);
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
    const notificationId = req.params.id;
    if (!notificationId) {
      respondBadRequest(res, "Missing notification id");
      return;
    }

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

    try {
      await runAuditedAction({
        action,
        target: req.params.id,
        run: () => runContainerAction(req.params.id, action),
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

    try {
      await runAuditedAction({
        action: `vm:${action}`,
        target: req.params.id,
        run: () => runVmAction(req.params.id, action),
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
