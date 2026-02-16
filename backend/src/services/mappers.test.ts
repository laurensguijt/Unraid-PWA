import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapArray, mapDocker, mapOverview, mapVms } from "./mappers.js";

describe("mappers", () => {
  it("maps overview safely with defaults", () => {
    const result = mapOverview({ info: { cpuUsage: 33.8, memoryUsage: 52.2 } });
    assert.equal(result.cpuPercent, 34);
    assert.equal(result.memoryPercent, 52);
    assert.equal(result.cpuModel, "Unknown CPU");
  });

  it("maps docker and computes summary", () => {
    const result = mapDocker({
      containers: [
        { id: "a", name: "A", image: "x", status: "running" },
        { id: "b", name: "B", image: "y", status: "stopped" },
      ],
    });
    assert.equal(result.summary.running, 1);
    assert.equal(result.summary.stopped, 1);
  });

  it("clamps array usage percentage", () => {
    const result = mapArray({
      devices: [{ id: "disk1", usagePercent: 140 }],
    });
    assert.equal(result.devices[0].usagePercent, 100);
  });

  it("normalizes vm status", () => {
    const result = mapVms({
      vms: [{ id: "vm1", name: "VM1", status: "paused" }],
    });
    assert.equal(result.vms[0].status, "unknown");
  });
});
