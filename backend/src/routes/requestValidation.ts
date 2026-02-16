type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type ServerConnectionTestInput = {
  baseUrl: string;
  apiKey: string;
  trustSelfSigned: boolean;
};

export type ServerCreateInput = ServerConnectionTestInput & {
  requestedScopes: string[];
  name?: string;
  accentColor?: string;
};

export type ServerApiKeyInput = {
  apiKey: string;
};

export type ServerUpdateInput = {
  name?: string;
  trustSelfSigned?: boolean;
  accentColor?: string;
  apiKey?: string;
};

export type AppSettingsUpdateInput = {
  themeMode?: "dark" | "light";
  accentColor?: string;
};

function fail(error: string): ParseResult<never> {
  return { ok: false, error };
}

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseRequiredString(
  source: Record<string, unknown>,
  field: string,
  {
    maxLength = 2048,
    trim = true,
  }: { maxLength?: number; trim?: boolean } = {},
): ParseResult<string> {
  if (typeof source[field] !== "string") {
    return fail(`${field} is required`);
  }
  const normalized = trim ? source[field].trim() : source[field];
  if (!normalized) {
    return fail(`${field} is required`);
  }
  if (normalized.length > maxLength) {
    return fail(`${field} is too long`);
  }
  return ok(normalized);
}

function parseOptionalString(
  source: Record<string, unknown>,
  field: string,
  {
    maxLength = 128,
    trim = true,
    allowEmpty = false,
  }: { maxLength?: number; trim?: boolean; allowEmpty?: boolean } = {},
): ParseResult<string | undefined> {
  if (!(field in source)) {
    return ok(undefined);
  }
  if (typeof source[field] !== "string") {
    return fail(`${field} must be a string`);
  }
  const normalized = trim ? source[field].trim() : source[field];
  if (!normalized && !allowEmpty) {
    return fail(`${field} cannot be empty`);
  }
  if (normalized.length > maxLength) {
    return fail(`${field} is too long`);
  }
  return ok(normalized);
}

function parseOptionalBoolean(
  source: Record<string, unknown>,
  field: string,
): ParseResult<boolean | undefined> {
  if (!(field in source)) {
    return ok(undefined);
  }
  if (typeof source[field] !== "boolean") {
    return fail(`${field} must be a boolean`);
  }
  return ok(source[field] as boolean);
}

function parseScopes(
  source: Record<string, unknown>,
  field: string,
): ParseResult<string[]> {
  if (!(field in source) || source[field] === undefined) {
    return ok([]);
  }
  if (!Array.isArray(source[field])) {
    return fail(`${field} must be an array of strings`);
  }

  const scopes: string[] = [];
  for (const rawScope of source[field] as unknown[]) {
    if (typeof rawScope !== "string") {
      return fail(`${field} must be an array of strings`);
    }
    const scope = rawScope.trim();
    if (!scope) {
      continue;
    }
    if (scope.length > 128) {
      return fail(`${field} contains a value that is too long`);
    }
    scopes.push(scope);
  }

  return ok(scopes);
}

function parseThemeMode(
  source: Record<string, unknown>,
  field: string,
): ParseResult<"dark" | "light" | undefined> {
  if (!(field in source)) {
    return ok(undefined);
  }
  const value = source[field];
  if (value !== "dark" && value !== "light") {
    return fail(`${field} must be 'dark' or 'light'`);
  }
  return ok(value);
}

const LEGACY_ACCENTS = new Set(["amber", "orange", "purple", "blue", "green"]);
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseAccentColor(
  source: Record<string, unknown>,
  field: string,
): ParseResult<string | undefined> {
  const parsed = parseOptionalString(source, field, { maxLength: 32, trim: true });
  if (!parsed.ok || parsed.value === undefined) {
    return parsed;
  }

  const value = parsed.value.toLowerCase();
  if (!HEX_COLOR.test(value) && !LEGACY_ACCENTS.has(value)) {
    return fail(`${field} must be a valid color`);
  }
  return ok(value);
}

function parseServerIdInternal(
  rawValue: unknown,
  fieldName: string,
): ParseResult<string> {
  if (typeof rawValue !== "string") {
    return fail(`${fieldName} is required`);
  }
  const value = rawValue.trim();
  if (!value) {
    return fail(`${fieldName} is required`);
  }
  if (value.length > 160) {
    return fail(`${fieldName} is too long`);
  }
  return ok(value);
}

export function parseServerId(rawValue: unknown): ParseResult<string> {
  return parseServerIdInternal(rawValue, "Server id");
}

export function parseResourceId(
  rawValue: unknown,
  fieldName: string,
): ParseResult<string> {
  return parseServerIdInternal(rawValue, fieldName);
}

export function parseServerConnectionTestBody(
  body: unknown,
): ParseResult<ServerConnectionTestInput> {
  const source = asObject(body);
  if (!source) {
    return fail("Request body must be a JSON object");
  }

  const baseUrl = parseRequiredString(source, "baseUrl");
  if (!baseUrl.ok) {
    return baseUrl;
  }
  const apiKey = parseRequiredString(source, "apiKey", { maxLength: 4096 });
  if (!apiKey.ok) {
    return apiKey;
  }
  const trustSelfSigned = parseOptionalBoolean(source, "trustSelfSigned");
  if (!trustSelfSigned.ok) {
    return trustSelfSigned;
  }

  return ok({
    baseUrl: baseUrl.value,
    apiKey: apiKey.value,
    trustSelfSigned: trustSelfSigned.value ?? true,
  });
}

export function parseServerCreateBody(body: unknown): ParseResult<ServerCreateInput> {
  const source = asObject(body);
  if (!source) {
    return fail("Request body must be a JSON object");
  }

  const base = parseServerConnectionTestBody(source);
  if (!base.ok) {
    return base;
  }

  const name = parseOptionalString(source, "name", {
    maxLength: 120,
    trim: true,
    allowEmpty: true,
  });
  if (!name.ok) {
    return name;
  }

  const accentColor = parseAccentColor(source, "accentColor");
  if (!accentColor.ok) {
    return accentColor;
  }

  const requestedScopes = parseScopes(source, "requestedScopes");
  if (!requestedScopes.ok) {
    return requestedScopes;
  }

  return ok({
    ...base.value,
    requestedScopes: requestedScopes.value,
    name: name.value || undefined,
    accentColor: accentColor.value,
  });
}

export function parseServerApiKeyBody(body: unknown): ParseResult<ServerApiKeyInput> {
  const source = asObject(body);
  if (!source) {
    return fail("Request body must be a JSON object");
  }

  const apiKey = parseRequiredString(source, "apiKey", { maxLength: 4096 });
  if (!apiKey.ok) {
    return apiKey;
  }

  return ok({
    apiKey: apiKey.value,
  });
}

export function parseServerUpdateBody(body: unknown): ParseResult<ServerUpdateInput> {
  const source = asObject(body);
  if (!source) {
    return fail("Request body must be a JSON object");
  }

  const name = parseOptionalString(source, "name", {
    maxLength: 120,
    trim: true,
    allowEmpty: true,
  });
  if (!name.ok) {
    return name;
  }
  const trustSelfSigned = parseOptionalBoolean(source, "trustSelfSigned");
  if (!trustSelfSigned.ok) {
    return trustSelfSigned;
  }
  const accentColor = parseAccentColor(source, "accentColor");
  if (!accentColor.ok) {
    return accentColor;
  }
  const apiKey = parseOptionalString(source, "apiKey", { maxLength: 4096, trim: true });
  if (!apiKey.ok) {
    return apiKey;
  }

  if (
    name.value === undefined &&
    trustSelfSigned.value === undefined &&
    accentColor.value === undefined &&
    apiKey.value === undefined
  ) {
    return fail("name, trustSelfSigned, accentColor or apiKey is required");
  }

  return ok({
    name: name.value,
    trustSelfSigned: trustSelfSigned.value,
    accentColor: accentColor.value,
    apiKey: apiKey.value,
  });
}

export function parseAppSettingsUpdateBody(
  body: unknown,
): ParseResult<AppSettingsUpdateInput> {
  const source = asObject(body);
  if (!source) {
    return fail("Request body must be a JSON object");
  }

  const themeMode = parseThemeMode(source, "themeMode");
  if (!themeMode.ok) {
    return themeMode;
  }
  const accentColor = parseAccentColor(source, "accentColor");
  if (!accentColor.ok) {
    return accentColor;
  }

  if (themeMode.value === undefined && accentColor.value === undefined) {
    return fail("themeMode or accentColor is required");
  }

  return ok({
    themeMode: themeMode.value,
    accentColor: accentColor.value,
  });
}
