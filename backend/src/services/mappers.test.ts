import { describe, expect, it } from "vitest";
import { mapArray, mapDocker, mapOverview, mapVms } from "./mappers.js";

describe("mappers", () => {
  it("maps overview safely with defaults", () => {
    const result = mapOverview({ info: { cpuUsage: 33.8, memoryUsage: 52.2 } });
    expect(result.cpuPercent).toBe(34);
    expect(result.memoryPercent).toBe(52);
    expect(result.cpuModel).toBe("Unknown CPU");
  });

  it("maps docker and computes summary", () => {
    const result = mapDocker({
      containers: [
        { id: "a", name: "A", image: "x", status: "running" },
        { id: "b", name: "B", image: "y", status: "stopped" },
      ],
    });
    expect(result.summary.running).toBe(1);
    expect(result.summary.stopped).toBe(1);
  });

  it("clamps array usage percentage", () => {
    const result = mapArray({
      devices: [{ id: "disk1", usagePercent: 140 }],
    });
    expect(result.devices[0].usagePercent).toBe(100);
  });

  it("normalizes vm status", () => {
    const result = mapVms({
      vms: [{ id: "vm1", name: "VM1", status: "paused" }],
    });
    expect(result.vms[0].status).toBe("unknown");
  });
});
