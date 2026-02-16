import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasWriteScopes } from "./unraidClient.js";

describe("hasWriteScopes", () => {
  it("accepts explicit write-like scopes", () => {
    assert.equal(hasWriteScopes(["docker:update_any"]), true);
    assert.equal(hasWriteScopes(["admin"]), true);
  });

  it("defaults to true when scopes are uncertain", () => {
    assert.equal(hasWriteScopes([]), true);
    assert.equal(hasWriteScopes(["read:monitoring"]), true);
  });

  it("returns false for clearly read-only scope sets", () => {
    assert.equal(hasWriteScopes(["read:docker", "read:vms", "read:array"]), false);
  });
});
