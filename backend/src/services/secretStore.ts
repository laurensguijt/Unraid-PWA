import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type StoredServer = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  trustSelfSigned: boolean;
  scopes: string[];
  createdAt: string;
};

export type AppSettings = {
  themeMode: "dark" | "light";
  accentColor: string;
};

type ServerStore = {
  activeServerId: string | null;
  servers: StoredServer[];
  appSettings: AppSettings;
};

const dataDir = path.resolve(process.cwd(), "data");
const dataFile = path.resolve(dataDir, "servers.enc");
const legacyDataFile = path.resolve(dataDir, "server.enc");
const fallbackEncryptionKey = "unraid-pwa-insecure-dev-key";
let didWarnForWeakEncryptionKey = false;

function getKeyMaterial(): Buffer {
  const raw = (process.env.UNRAID_BFF_ENCRYPTION_KEY ?? "").trim();
  const weak =
    raw.length < 16 ||
    raw.startsWith("replace-with-") ||
    raw === "replace-with-32-char-key-material";
  if (weak && !didWarnForWeakEncryptionKey) {
    didWarnForWeakEncryptionKey = true;
    console.warn(
      "UNRAID_BFF_ENCRYPTION_KEY is missing or weak. Using an insecure fallback key for local development.",
    );
  }
  const source = weak ? fallbackEncryptionKey : raw;
  return crypto.createHash("sha256").update(source).digest();
}

function encrypt(value: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKeyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString("hex")}`;
}

function decrypt(value: string): string {
  const [ivHex, tagHex, dataHex] = value.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKeyMaterial(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function defaultStore(): ServerStore {
  return {
    activeServerId: null,
    servers: [],
    appSettings: {
      themeMode: "dark",
      accentColor: "#ea580c", /* default: orange */
    },
  };
}

function normalizeThemeMode(value: unknown): "dark" | "light" {
  if (value === "light" || value === "dark") {
    return value;
  }
  return "dark";
}

function normalizeAccentColor(value: unknown): string {
  const legacyMap: Record<string, string> = {
    amber: "#d97706",
    orange: "#ea580c",
    purple: "#9333ea",
    blue: "#3b82f6",
    green: "#22c55e",
  };
  if (typeof value !== "string") {
    return "#ea580c";
  }
  const trimmed = value.trim().toLowerCase();
  if (legacyMap[trimmed]) {
    return legacyMap[trimmed];
  }
  const hex3 = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (hex3) {
    const short = hex3[1];
    return `#${short[0]}${short[0]}${short[1]}${short[1]}${short[2]}${short[2]}`;
  }
  if (/^#([0-9a-f]{6})$/i.test(trimmed)) {
    return trimmed;
  }
  return "#ea580c";
}

function normalizeLegacy(payload: unknown): ServerStore {
  if (
    payload &&
    typeof payload === "object" &&
    "servers" in payload &&
    Array.isArray((payload as { servers: unknown }).servers)
  ) {
    const store = payload as ServerStore;
    const normalizedServers = (store.servers ?? []).map((server, index) => normalizeStoredServer(server, index));
    const activeServerId = normalizedServers.some((server) => server.id === store.activeServerId)
      ? store.activeServerId ?? null
      : normalizedServers[0]?.id ?? null;
    return {
      activeServerId,
      servers: normalizedServers,
      appSettings: {
        themeMode: normalizeThemeMode(store.appSettings?.themeMode),
        accentColor: normalizeAccentColor(store.appSettings?.accentColor),
      },
    };
  }
  if (payload && typeof payload === "object" && "baseUrl" in payload && "apiKey" in payload) {
    const legacy = payload as { baseUrl: string; apiKey: string; scopes?: string[]; createdAt?: string };
    const id = crypto.randomUUID();
    return {
      activeServerId: id,
      servers: [
        {
          id,
          name: "Primary server",
          baseUrl: legacy.baseUrl,
          apiKey: legacy.apiKey,
          trustSelfSigned: true,
          scopes: legacy.scopes ?? [],
          createdAt: legacy.createdAt ?? new Date().toISOString(),
        },
      ],
      appSettings: defaultStore().appSettings,
    };
  }
  return defaultStore();
}

function normalizeStoredServer(server: StoredServer, index: number): StoredServer {
  return {
    id: typeof server.id === "string" && server.id.trim() ? server.id : crypto.randomUUID(),
    name:
      typeof server.name === "string" && server.name.trim()
        ? server.name.trim()
        : `Server ${index + 1}`,
    baseUrl: typeof server.baseUrl === "string" ? server.baseUrl : "",
    apiKey: typeof server.apiKey === "string" ? server.apiKey : "",
    trustSelfSigned: typeof server.trustSelfSigned === "boolean" ? server.trustSelfSigned : true,
    scopes: Array.isArray(server.scopes)
      ? server.scopes.filter((scope): scope is string => typeof scope === "string")
      : [],
    createdAt:
      typeof server.createdAt === "string" && server.createdAt.trim()
        ? server.createdAt
        : new Date().toISOString(),
  };
}

async function readStore(): Promise<ServerStore> {
  try {
    const content = await fs.readFile(dataFile, "utf8");
    return normalizeLegacy(JSON.parse(decrypt(content)));
  } catch {
    try {
      const legacyContent = await fs.readFile(legacyDataFile, "utf8");
      return normalizeLegacy(JSON.parse(decrypt(legacyContent)));
    } catch {
      return defaultStore();
    }
  }
}

async function writeStore(store: ServerStore): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, encrypt(JSON.stringify(store)), "utf8");
}

export async function saveServer(
  server: Omit<StoredServer, "id" | "name"> & { id?: string; name?: string },
): Promise<StoredServer> {
  const store = await readStore();
  const id = server.id ?? crypto.randomUUID();
  const name = server.name?.trim() ? server.name.trim() : `Server ${store.servers.length + 1}`;
  const existing = store.servers.find((item) => item.id === id);
  const next: StoredServer = {
    id,
    name,
    baseUrl: server.baseUrl,
    apiKey: server.apiKey,
    trustSelfSigned: server.trustSelfSigned ?? existing?.trustSelfSigned ?? true,
    scopes: server.scopes,
    createdAt: server.createdAt,
  };
  const index = store.servers.findIndex((item) => item.id === id);
  if (index >= 0) {
    store.servers[index] = next;
  } else {
    store.servers.push(next);
  }
  if (!store.activeServerId) {
    store.activeServerId = id;
  }
  await writeStore(store);
  return next;
}

export async function loadServer(): Promise<StoredServer | null> {
  const store = await readStore();
  if (!store.activeServerId) {
    return null;
  }
  return store.servers.find((item) => item.id === store.activeServerId) ?? null;
}

export async function loadServerById(serverId: string): Promise<StoredServer | null> {
  const store = await readStore();
  return store.servers.find((item) => item.id === serverId) ?? null;
}

export async function listServers(): Promise<{ activeServerId: string | null; servers: StoredServer[] }> {
  const store = await readStore();
  return { activeServerId: store.activeServerId, servers: store.servers };
}

export async function updateServer(
  serverId: string,
  input: { name?: string; trustSelfSigned?: boolean },
): Promise<boolean> {
  const store = await readStore();
  const target = store.servers.find((item) => item.id === serverId);
  if (!target) {
    return false;
  }
  if (typeof input.name === "string" && input.name.trim()) {
    target.name = input.name.trim();
  }
  if (typeof input.trustSelfSigned === "boolean") {
    target.trustSelfSigned = input.trustSelfSigned;
  }
  await writeStore(store);
  return true;
}

export async function setActiveServer(serverId: string): Promise<boolean> {
  const store = await readStore();
  const exists = store.servers.some((item) => item.id === serverId);
  if (!exists) {
    return false;
  }
  store.activeServerId = serverId;
  await writeStore(store);
  return true;
}

export async function deleteServer(serverId: string): Promise<boolean> {
  const store = await readStore();
  const before = store.servers.length;
  store.servers = store.servers.filter((item) => item.id !== serverId);
  if (store.servers.length === before) {
    return false;
  }
  if (store.activeServerId === serverId) {
    store.activeServerId = store.servers[0]?.id ?? null;
  }
  await writeStore(store);
  return true;
}

export async function getAppSettings(): Promise<AppSettings> {
  const store = await readStore();
  return store.appSettings;
}

export async function updateAppSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  const store = await readStore();
  store.appSettings = {
    themeMode: normalizeThemeMode(input.themeMode ?? store.appSettings.themeMode),
    accentColor: normalizeAccentColor(input.accentColor ?? store.appSettings.accentColor),
  };
  await writeStore(store);
  return store.appSettings;
}
