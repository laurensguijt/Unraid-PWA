import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAppSettingsUpdateBody,
  parseResourceId,
  parseServerApiKeyBody,
  parseServerConnectionTestBody,
  parseServerCreateBody,
  parseServerUpdateBody,
} from "./requestValidation.js";

describe("requestValidation", () => {
  it("parses server create payload and normalizes values", () => {
    const parsed = parseServerCreateBody({
      name: "  Lab Server  ",
      baseUrl: "https://10.0.0.2:3443 ",
      apiKey: " my-key ",
      trustSelfSigned: false,
      accentColor: "#Ea580c",
      requestedScopes: ["read:monitoring", "  ", "read:docker"],
    });

    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.deepEqual(parsed.value, {
      name: "Lab Server",
      baseUrl: "https://10.0.0.2:3443",
      apiKey: "my-key",
      trustSelfSigned: false,
      accentColor: "#ea580c",
      requestedScopes: ["read:monitoring", "read:docker"],
    });
  });

  it("rejects invalid connection test payload", () => {
    const parsed = parseServerConnectionTestBody({
      baseUrl: "https://10.0.0.2:3443",
      apiKey: "",
    });
    assert.equal(parsed.ok, false);
    if (parsed.ok) {
      return;
    }
    assert.match(parsed.error, /apiKey/);
  });

  it("requires at least one mutable field in server updates", () => {
    const parsed = parseServerUpdateBody({});
    assert.equal(parsed.ok, false);
    if (parsed.ok) {
      return;
    }
    assert.match(parsed.error, /required/);
  });

  it("accepts blank rename value for server updates", () => {
    const parsed = parseServerUpdateBody({ name: "   " });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.value.name, "");
  });

  it("validates app settings update payload", () => {
    const parsed = parseAppSettingsUpdateBody({ themeMode: "light", accentColor: "#1f2937" });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.value.themeMode, "light");
    assert.equal(parsed.value.accentColor, "#1f2937");
  });

  it("rejects invalid app settings update payload", () => {
    const parsed = parseAppSettingsUpdateBody({ themeMode: "midnight" });
    assert.equal(parsed.ok, false);
  });

  it("parses API key test payload", () => {
    const parsed = parseServerApiKeyBody({ apiKey: " next-key " });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.value.apiKey, "next-key");
  });

  it("parses resource identifiers safely", () => {
    const parsed = parseResourceId("docker:abc123", "Container id");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.value, "docker:abc123");
  });
});
