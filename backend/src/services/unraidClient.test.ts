import { describe, expect, it } from "vitest";
import { hasWriteScopes } from "./unraidClient.js";

describe("hasWriteScopes", () => {
  it("accepts explicit write-like scopes", () => {
    expect(hasWriteScopes(["docker:update_any"])).toBe(true);
    expect(hasWriteScopes(["admin"])).toBe(true);
  });

  it("defaults to true when scopes are uncertain", () => {
    expect(hasWriteScopes([])).toBe(true);
    expect(hasWriteScopes(["read:monitoring"])).toBe(true);
  });

  it("returns false for clearly read-only scope sets", () => {
    expect(hasWriteScopes(["read:docker", "read:vms", "read:array"])).toBe(false);
  });
});
