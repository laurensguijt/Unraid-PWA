import type {
  ArrayResponse,
  DockerResponse,
  OverviewResponse,
  VmsResponse,
} from "../types/api.js";

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toStringValue(value: unknown, fallback = "-"): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function toBigNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let current = Math.max(0, value);
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  const rounded = current >= 100 ? current.toFixed(0) : current.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

function formatEpochSeconds(value: unknown): string {
  const seconds = toNumber(value, 0);
  if (seconds <= 0) {
    return "-";
  }
  return new Date(seconds * 1000).toLocaleString();
}

function formatDurationSeconds(value: unknown): string {
  const seconds = toNumber(value, 0);
  if (seconds <= 0) {
    return "-";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const restSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${restSeconds}s`;
  }
  return `${restSeconds}s`;
}

function formatUptime(value: unknown): string {
  function formatUptimeSeconds(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      return "-";
    }
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return formatUptimeSeconds(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return "-";
    }
    if (/^\d+$/.test(trimmed)) {
      return formatUptimeSeconds(Number(trimmed));
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      const diffSeconds = Math.floor((Date.now() - parsed) / 1000);
      if (diffSeconds > 0) {
        return formatUptimeSeconds(diffSeconds);
      }
    }
    return trimmed;
  }
  return "-";
}

function formatLicenseType(value: unknown): string {
  const raw = toStringValue(value, "-");
  if (raw === "-") {
    return raw;
  }
  const lower = raw.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatDiskTemp(value: unknown): string {
  const n = toNumber(value, Number.NaN);
  if (!Number.isFinite(n) || n <= 0) {
    return "-";
  }
  return `${Math.round(n)} C`;
}

export function mapOverview(data: unknown): OverviewResponse {
  const record = data as {
    core?: {
      vars?: { name?: unknown; version?: unknown; regTy?: unknown };
      info?: {
        time?: unknown;
        cpu?: { brand?: unknown; cores?: unknown; threads?: unknown; speed?: unknown };
        os?: { distro?: unknown; platform?: unknown; kernel?: unknown; hostname?: unknown; uptime?: unknown };
        baseboard?: { manufacturer?: unknown; model?: unknown };
        cpuUsage?: unknown;
        memoryUsage?: unknown;
        memoryUsed?: unknown;
        memoryTotal?: unknown;
        cpuModel?: unknown;
      };
      metrics?: {
        cpu?: { percentTotal?: unknown };
        memory?: { percentTotal?: unknown; used?: unknown; total?: unknown; free?: unknown };
      };
      array?: {
        state?: unknown;
        capacity?: { kilobytes?: { used?: unknown; free?: unknown; total?: unknown } };
        parityCheckStatus?: {
          date?: unknown;
          duration?: unknown;
          speed?: unknown;
          status?: unknown;
          progress?: unknown;
          errors?: unknown;
          running?: unknown;
        };
      };
    };
    notifications?: {
      notifications?: {
        overview?: { unread?: { info?: unknown; warning?: unknown; alert?: unknown; total?: unknown } };
        warningsAndAlerts?: Array<Record<string, unknown>>;
        list?: Array<Record<string, unknown>>;
      };
    };
    network?: {
      network?: {
        accessUrls?: Array<Record<string, unknown>>;
      };
    };
    ups?: {
      upsDevices?: Array<{
        id?: unknown;
        name?: unknown;
        model?: unknown;
        status?: unknown;
        battery?: {
          chargeLevel?: unknown;
          estimatedRuntime?: unknown;
          health?: unknown;
        };
        power?: {
          inputVoltage?: unknown;
          outputVoltage?: unknown;
          loadPercentage?: unknown;
        };
      }>;
    };
    info?: {
      time?: unknown;
      cpu?: { brand?: unknown; cores?: unknown; threads?: unknown; speed?: unknown };
      os?: { distro?: unknown; platform?: unknown; kernel?: unknown; hostname?: unknown; uptime?: unknown };
      baseboard?: { manufacturer?: unknown; model?: unknown };
      cpuUsage?: unknown;
      memoryUsage?: unknown;
      memoryUsed?: unknown;
      memoryTotal?: unknown;
      cpuModel?: unknown;
    };
    metrics?: {
      cpu?: { percentTotal?: unknown };
      memory?: { percentTotal?: unknown; used?: unknown; total?: unknown; free?: unknown };
    };
    array?: {
      state?: unknown;
      capacity?: { kilobytes?: { used?: unknown; free?: unknown; total?: unknown } };
      parityCheckStatus?: {
        date?: unknown;
        duration?: unknown;
        speed?: unknown;
        status?: unknown;
        progress?: unknown;
        errors?: unknown;
        running?: unknown;
      };
    };
    vars?: { name?: unknown; version?: unknown; regTy?: unknown };
  };
  const core = record.core ?? {};
  const info = core.info ?? record.info ?? {};
  const metrics = core.metrics ?? record.metrics ?? {};
  const array = core.array ?? record.array ?? {};
  const capacity = array.capacity?.kilobytes ?? {};
  const unread = record.notifications?.notifications?.overview?.unread ?? {};
  const warningsAndAlerts =
    record.notifications?.notifications?.warningsAndAlerts ??
    record.notifications?.notifications?.list ??
    [];
  const accessUrls = record.network?.network?.accessUrls ?? [];
  const upsDevices = record.ups?.upsDevices ?? [];

  const cpuPercent = Math.round(
    toNumber(metrics.cpu?.percentTotal, toNumber(info.cpuUsage)),
  );
  const memoryPercent = Math.round(
    toNumber(metrics.memory?.percentTotal, toNumber(info.memoryUsage)),
  );
  const memoryUsed = toBigNumber(metrics.memory?.used, toBigNumber(info.memoryUsed));
  const memoryTotal = toBigNumber(metrics.memory?.total, toBigNumber(info.memoryTotal));
  const memoryFree = toBigNumber(metrics.memory?.free);
  const arrayUsedKb = toBigNumber(capacity.used);
  const arrayFreeKb = toBigNumber(capacity.free);
  const arrayTotalKb = toBigNumber(capacity.total);
  const arrayUsagePercent = arrayTotalKb > 0 ? Math.round((arrayUsedKb / arrayTotalKb) * 100) : 0;

  return {
    cpuPercent,
    cpuModel: toStringValue(info.cpu?.brand, toStringValue(info.cpuModel, "Unknown CPU")),
    cpuCores: toNumber(info.cpu?.cores),
    cpuThreads: toNumber(info.cpu?.threads),
    cpuSpeedGhz: toNumber(info.cpu?.speed),
    memoryPercent,
    memoryUsed: memoryUsed > 0 ? formatBytes(memoryUsed) : "-",
    memoryTotal: memoryTotal > 0 ? formatBytes(memoryTotal) : "-",
    memoryFree: memoryFree > 0 ? formatBytes(memoryFree) : "-",
    serverName: toStringValue(core.vars?.name, toStringValue(record.vars?.name, "Unraid")),
    licenseType: formatLicenseType(core.vars?.regTy ?? record.vars?.regTy),
    unraidVersion: toStringValue(core.vars?.version, toStringValue(record.vars?.version, "-")),
    kernelVersion: toStringValue(info.os?.kernel, "-"),
    osDistro: toStringValue(info.os?.distro, "-"),
    osType: toStringValue(info.os?.platform, "-"),
    hostname: toStringValue(info.os?.hostname, "-"),
    motherboard: [toStringValue(info.baseboard?.manufacturer, ""), toStringValue(info.baseboard?.model, "")]
      .join(" ")
      .trim() || "-",
    uptime: formatUptime(info.os?.uptime),
    serverTime: toStringValue(info.time, "-"),
    arrayState: toStringValue(array.state, "-"),
    arrayUsagePercent,
    arrayUsed: arrayUsedKb > 0 ? formatBytes(arrayUsedKb * 1024) : "-",
    arrayFree: arrayFreeKb > 0 ? formatBytes(arrayFreeKb * 1024) : "-",
    arrayTotal: arrayTotalKb > 0 ? formatBytes(arrayTotalKb * 1024) : "-",
    parity: {
      status: toStringValue(array.parityCheckStatus?.status, "-"),
      progress: Math.min(100, Math.max(0, toNumber(array.parityCheckStatus?.progress))),
      errors: toNumber(array.parityCheckStatus?.errors),
      running: Boolean(array.parityCheckStatus?.running),
    },
    lastParityCheck: {
      date: toStringValue(array.parityCheckStatus?.date, "-"),
      duration: formatDurationSeconds(array.parityCheckStatus?.duration),
      speed: toStringValue(array.parityCheckStatus?.speed, "-"),
    },
    ups: {
      devices: upsDevices.map((device) => ({
        id: toStringValue(device.id),
        name: toStringValue(device.name, "-"),
        model: toStringValue(device.model, "-"),
        status: toStringValue(device.status, "-"),
        batteryLevel: toNumber(device.battery?.chargeLevel, 0),
        estimatedRuntimeSeconds: toNumber(device.battery?.estimatedRuntime, 0),
        batteryHealth: toStringValue(device.battery?.health, "-"),
        inputVoltage: toNumber(device.power?.inputVoltage, 0),
        outputVoltage: toNumber(device.power?.outputVoltage, 0),
        loadPercentage: toNumber(device.power?.loadPercentage, 0),
      })),
    },
    unreadNotifications: {
      info: toNumber(unread.info),
      warning: toNumber(unread.warning),
      alert: toNumber(unread.alert),
      total: toNumber(unread.total),
    },
    accessUrls: accessUrls.map((item) => ({
      type: toStringValue(item.type, "-"),
      name: toStringValue(item.name, "-"),
      ipv4: toStringValue(item.ipv4, "-"),
      ipv6: toStringValue(item.ipv6, "-"),
    })),
    notifications: warningsAndAlerts.map((item) => ({
      id: toStringValue(item.id),
      type: (() => {
        const importance = toStringValue(item.importance, "warning").toLowerCase();
        if (importance === "alert") {
          return "alert" as const;
        }
        if (importance === "info") {
          return "info" as const;
        }
        return "warning" as const;
      })(),
      title: toStringValue(item.title, "Notification"),
      category: toStringValue(item.importance, "warning"),
      date: toStringValue(item.timestamp, new Date().toISOString()),
      snippet: toStringValue(item.description, ""),
    })),
  };
}

export function mapDocker(data: unknown): DockerResponse {
  const record = data as {
    containers?: Array<Record<string, unknown>>;
    dockerContainers?: Array<Record<string, unknown>>;
    docker?: { containers?: Array<Record<string, unknown>> };
  };
  const source = record.containers ?? record.dockerContainers ?? record.docker?.containers ?? [];
  const containers = source.map((item) => {
    const toPortValue = (value: unknown): string | null => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return String(Math.round(value));
      }
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
      return null;
    };
    const state = toStringValue(item.state, "unknown").toLowerCase();
    const statusFromLegacy = toStringValue(item.status, "").toLowerCase();
    const rawStatus =
      state === "running"
        ? "running"
        : state === "exited"
          ? "stopped"
          : statusFromLegacy === "running" || statusFromLegacy === "stopped"
            ? statusFromLegacy
            : "unknown";
    const status: "running" | "stopped" | "unknown" =
      rawStatus === "running" || rawStatus === "stopped" ? rawStatus : "unknown";
    const names = Array.isArray(item.names) ? (item.names as unknown[]) : [];
    const preferredName = toStringValue(names[0], "").replace(/^\//, "");
    const ports = Array.isArray(item.ports) ? (item.ports as Array<Record<string, unknown>>) : [];
    const portSummary = ports
      .slice(0, 4)
      .map((port) => {
        const privatePort = toPortValue(port.privatePort);
        const publicPort = toPortValue(port.publicPort);
        const protocol = toStringValue(port.type, "tcp").toLowerCase();
        if (!privatePort && !publicPort) {
          return "";
        }
        if (publicPort && privatePort) {
          return `${publicPort}->${privatePort}/${protocol}`;
        }
        return `${publicPort ?? privatePort}/${protocol}`;
      })
      .filter((item) => item.length > 0)
      .join(", ");
    const hasMorePorts = ports.length > 4;
    const stateLabel = toStringValue(item.state, "UNKNOWN");
    const labels =
      item.labels && typeof item.labels === "object" && !Array.isArray(item.labels)
        ? (item.labels as Record<string, unknown>)
        : {};
    const endpoint = toStringValue(
      item.webUiUrl,
      toStringValue(item.endpoint, toStringValue(labels["net.unraid.docker.webui"], "-")),
    );
    const hostConfig = (item.hostConfig ?? {}) as { networkMode?: unknown };
    const iconFromLabel = toStringValue(labels["net.unraid.docker.icon"], "");
    const iconUrl = toStringValue(item.iconUrl, iconFromLabel);
    return {
      id: toStringValue(item.id),
      name: preferredName || toStringValue(item.name),
      image: toStringValue(item.image),
      iconUrl,
      network: toStringValue(item.network, toStringValue(hostConfig.networkMode, "bridge")),
      endpoint,
      ports: portSummary ? (hasMorePorts ? `${portSummary}...` : portSummary) : "-",
      createdAt: formatEpochSeconds(item.created),
      autoStart: Boolean(item.autoStart),
      updateAvailable: Boolean(item.isUpdateAvailable),
      rebuildReady: Boolean(item.isRebuildReady),
      stateLabel,
      status,
    };
  });
  const running = containers.filter((item) => item.status === "running").length;
  const updatesAvailable = containers.filter((item) => item.updateAvailable || item.rebuildReady).length;
  return {
    summary: {
      running,
      stopped: Math.max(0, containers.length - running),
      updatesAvailable,
    },
    containers,
  };
}

export function mapArray(data: unknown): ArrayResponse {
  const record = data as {
    devices?: Array<Record<string, unknown>>;
    arrayDevices?: Array<Record<string, unknown>>;
    array?: {
      devices?: Array<Record<string, unknown>>;
      parities?: Array<Record<string, unknown>>;
      disks?: Array<Record<string, unknown>>;
      caches?: Array<Record<string, unknown>>;
      state?: unknown;
      capacity?: { kilobytes?: { used?: unknown; free?: unknown; total?: unknown } };
      parityCheckStatus?: { status?: unknown; progress?: unknown; errors?: unknown; running?: unknown };
    };
  };
  const arrayRoot = record.array ?? {};
  const capacity = arrayRoot.capacity?.kilobytes ?? {};
  const usedKb = toBigNumber(capacity.used);
  const freeKb = toBigNumber(capacity.free);
  const totalKb = toBigNumber(capacity.total);
  const usagePercent = totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : 0;
  const fallbackSource =
    record.devices ??
    record.arrayDevices ??
    record.array?.devices ??
    [];
  const paritySource = record.array?.parities ?? [];
  const dataDiskSource = record.array?.disks ?? [];
  const cacheSource = record.array?.caches ?? [];

  const typedSource: Array<{ item: Record<string, unknown>; sourceKind: "parity" | "array" | "pool" | "unknown" }> =
    paritySource.length > 0 || dataDiskSource.length > 0 || cacheSource.length > 0
      ? [
          ...paritySource.map((item) => ({ item, sourceKind: "parity" as const })),
          ...dataDiskSource.map((item) => ({ item, sourceKind: "array" as const })),
          ...cacheSource.map((item) => ({ item, sourceKind: "pool" as const })),
        ]
      : fallbackSource.map((item) => ({ item, sourceKind: "unknown" as const }));

  return {
    state: toStringValue(arrayRoot.state, "-"),
    capacity: {
      used: usedKb > 0 ? formatBytes(usedKb * 1024) : "-",
      free: freeKb > 0 ? formatBytes(freeKb * 1024) : "-",
      total: totalKb > 0 ? formatBytes(totalKb * 1024) : "-",
      usagePercent,
    },
    parity: {
      status: toStringValue(arrayRoot.parityCheckStatus?.status, "-"),
      progress: Math.min(100, Math.max(0, toNumber(arrayRoot.parityCheckStatus?.progress))),
      errors: toNumber(arrayRoot.parityCheckStatus?.errors),
      running: Boolean(arrayRoot.parityCheckStatus?.running),
    },
    devices: typedSource.map(({ item, sourceKind }) => {
      const apiType = toStringValue(item.type, "").toUpperCase();
      const isParity = sourceKind === "parity" || apiType === "PARITY";
      const isPool = sourceKind === "pool" || apiType === "CACHE";
      const diskType: "array" | "pool" = isPool ? "pool" : "array";
      const role = isParity ? "parity" : isPool ? "pool" : "array";
      return {
        id: toStringValue(item.id),
        role,
        diskType,
        isParity,
        pool: toStringValue(item.pool, role),
        filesystem: toStringValue(item.filesystem, toStringValue(item.fsType, "unknown")),
        temp: formatDiskTemp(item.temp),
        size: formatBytes(toBigNumber(item.size) * 1024),
        used: formatBytes(toBigNumber(item.used, toBigNumber(item.fsUsed)) * 1024),
        errors: toNumber(item.errors, toNumber(item.numErrors)),
        free: formatBytes(toBigNumber(item.free, toBigNumber(item.fsFree)) * 1024),
        usagePercent: Math.min(
          100,
          Math.max(
            0,
            toNumber(
              item.usagePercent,
              (() => {
                const size = toBigNumber(item.size);
                const used = toBigNumber(item.used, toBigNumber(item.fsUsed));
                return size > 0 ? (used / size) * 100 : 0;
              })(),
            ),
          ),
        ),
      };
    }),
  };
}

export function mapVms(data: unknown): VmsResponse {
  const record = data as {
    vms?: Array<Record<string, unknown>> | { domains?: Array<Record<string, unknown>> };
    virtualMachines?: Array<Record<string, unknown>>;
    virtualization?: { vms?: Array<Record<string, unknown>> };
  };
  const source =
    (Array.isArray(record.vms) ? record.vms : undefined) ??
    record.virtualMachines ??
    record.virtualization?.vms ??
    (!Array.isArray(record.vms) ? record.vms?.domains : []) ??
    [];
  const mapped = source.map((item) => {
      const rawStatus = toStringValue(item.status, toStringValue(item.state, "unknown")).toLowerCase();
      const status: "running" | "stopped" | "unknown" =
        rawStatus === "running" || rawStatus === "shutoff" || rawStatus === "stopped"
          ? rawStatus === "running"
            ? "running"
            : "stopped"
          : "unknown";
      return {
        id: toStringValue(item.id),
        name: toStringValue(item.name),
        status,
        stateLabel: toStringValue(item.state, toStringValue(item.status, "UNKNOWN")),
      };
    });
  const summary = mapped.reduce(
    (acc, vm) => {
      const state = vm.stateLabel.toUpperCase();
      if (vm.status === "running") {
        acc.running += 1;
      } else if (vm.status === "stopped") {
        acc.stopped += 1;
      } else if (state === "PAUSED") {
        acc.paused += 1;
      } else {
        acc.other += 1;
      }
      return acc;
    },
    { running: 0, stopped: 0, paused: 0, other: 0 },
  );
  return {
    summary,
    vms: mapped,
  };
}
