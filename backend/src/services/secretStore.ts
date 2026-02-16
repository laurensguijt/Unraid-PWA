import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type StoredServer = {
  id: string;
  name: string;
  accentColor: string;
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
const keyFile = path.resolve(dataDir, "encryption.key");
const DEFAULT_ACCENT_COLOR = "#ea580c";
const legacyFallbackEncryptionKey = "unraid-pwa-insecure-dev-key";
let didWarnForWeakEncryptionKey = false;
let didWarnForLegacyKeyMigration = false;

function isWeakKey(raw: string): boolean {
  return (
    raw.length < 16 ||
    raw.startsWith("replace-with-") ||
    raw === "replace-with-32-char-key-material"
  );
}

function readKeyFile(): string | null {
  try {
    const value = fsSync.readFileSync(keyFile, "utf8").trim();
    if (!value) {
      throw new Error("Encryption key file is empty.");
    }
    return value;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function createKeyFile(): string {
  fsSync.mkdirSync(dataDir, { recursive: true });
  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fsSync.writeFileSync(keyFile, generated, { encoding: "utf8", mode: 0o600, flag: "wx" });
    return generated;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      const existing = readKeyFile();
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
}

function resolveKeySource(): string {
  const raw = (process.env.UNRAID_BFF_ENCRYPTION_KEY ?? "").trim();
  if (!isWeakKey(raw)) {
    return raw;
  }

  if (!didWarnForWeakEncryptionKey) {
    didWarnForWeakEncryptionKey = true;
    console.warn(
      "UNRAID_BFF_ENCRYPTION_KEY is missing or weak. Falling back to data/encryption.key (auto-generated).",
    );
  }

  const existing = readKeyFile();
  if (existing) {
    return existing;
  }
  return createKeyFile();
}

function deriveKeyMaterial(source: string): Buffer {
  return crypto.createHash("sha256").update(source).digest();
}

function getKeyMaterial(): Buffer {
  return deriveKeyMaterial(resolveKeySource());
}

function encrypt(value: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKeyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString("hex")}`;
}

function decryptWithKeyMaterial(value: string, keyMaterial: Buffer): string {
  const [ivHex, tagHex, dataHex, ...rest] = value.split(".");
  if (rest.length > 0 || !ivHex || !tagHex || !dataHex) {
    throw new Error("Encrypted payload format is invalid.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    keyMaterial,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function decrypt(value: string): { value: string; usedLegacyFallback: boolean } {
  try {
    return {
      value: decryptWithKeyMaterial(value, getKeyMaterial()),
      usedLegacyFallback: false,
    };
  } catch (primaryError) {
    try {
      const legacy = decryptWithKeyMaterial(
        value,
        deriveKeyMaterial(legacyFallbackEncryptionKey),
      );
      if (!didWarnForLegacyKeyMigration) {
        didWarnForLegacyKeyMigration = true;
        console.warn(
          "Detected credentials encrypted with a legacy fallback key. Re-encrypting with current key material.",
        );
      }
      return {
        value: legacy,
        usedLegacyFallback: true,
      };
    } catch {
      throw primaryError;
    }
  }
}

function defaultStore(): ServerStore {
  return {
    activeServerId: null,
    servers: [],
    appSettings: {
      themeMode: "dark",
      accentColor: DEFAULT_ACCENT_COLOR, /* default: orange */
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
    orange: DEFAULT_ACCENT_COLOR,
    purple: "#9333ea",
    blue: "#3b82f6",
    green: "#22c55e",
  };
  if (typeof value !== "string") {
    return DEFAULT_ACCENT_COLOR;
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
  return DEFAULT_ACCENT_COLOR;
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
          accentColor: DEFAULT_ACCENT_COLOR,
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

function normalizeStoredServer(server: Partial<StoredServer>, index: number): StoredServer {
  return {
    id: typeof server.id === "string" && server.id.trim() ? server.id : crypto.randomUUID(),
    name:
      typeof server.name === "string" && server.name.trim()
        ? server.name.trim()
        : `Server ${index + 1}`,
    accentColor: normalizeAccentColor(server.accentColor),
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
  async function readEncryptedStore(
    filePath: string,
  ): Promise<{ store: ServerStore; migrated: boolean }> {
    const content = await fs.readFile(filePath, "utf8");
    try {
      const decrypted = decrypt(content);
      return {
        store: normalizeLegacy(JSON.parse(decrypted.value)),
        migrated: decrypted.usedLegacyFallback,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown decryption failure";
      throw new Error(
        `Failed to decrypt ${path.basename(filePath)}. Check encryption key consistency. (${reason})`,
      );
    }
  }

  function isFileMissing(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === "ENOENT";
  }

  let primaryReadError: Error | null = null;

  try {
    const current = await readEncryptedStore(dataFile);
    if (current.migrated) {
      await writeStore(current.store);
    }
    return current.store;
  } catch (error) {
    if (!isFileMissing(error)) {
      primaryReadError =
        error instanceof Error ? error : new Error("Unknown encrypted store read error");
    }
  }

  try {
    const legacy = await readEncryptedStore(legacyDataFile);
    await writeStore(legacy.store);
    return legacy.store;
  } catch (error) {
    if (!isFileMissing(error)) {
      if (primaryReadError) {
        throw primaryReadError;
      }
      throw error;
    }
  }

  if (primaryReadError) {
    throw primaryReadError;
  }

  return defaultStore();
}

async function writeStore(store: ServerStore): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, encrypt(JSON.stringify(store)), "utf8");
}

export async function saveServer(
  server: Omit<StoredServer, "id" | "name" | "accentColor"> & {
    id?: string;
    name?: string;
    accentColor?: string;
  },
): Promise<StoredServer> {
  const store = await readStore();
  const id = server.id ?? crypto.randomUUID();
  const name = server.name?.trim() ? server.name.trim() : `Server ${store.servers.length + 1}`;
  const existing = store.servers.find((item) => item.id === id);
  const next: StoredServer = {
    id,
    name,
    accentColor: normalizeAccentColor(server.accentColor ?? existing?.accentColor),
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
  input: { name?: string; trustSelfSigned?: boolean; accentColor?: string; apiKey?: string },
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
  if (typeof input.accentColor === "string") {
    target.accentColor = normalizeAccentColor(input.accentColor);
  }
  if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    target.apiKey = input.apiKey.trim();
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
