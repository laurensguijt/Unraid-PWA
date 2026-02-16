export type SetupPayload = {
  baseUrl: string;
  apiKey: string;
  name?: string;
  requestedScopes?: string[];
  trustSelfSigned?: boolean;
};

export type OverviewResponse = {
  cpuPercent: number;
  cpuModel: string;
  cpuCores: number;
  cpuThreads: number;
  cpuSpeedGhz: number;
  memoryPercent: number;
  memoryUsed: string;
  memoryTotal: string;
  memoryFree: string;
  serverName: string;
  licenseType: string;
  unraidVersion: string;
  kernelVersion: string;
  osDistro: string;
  osType: string;
  hostname: string;
  motherboard: string;
  uptime: string;
  serverTime: string;
  arrayState: string;
  arrayUsagePercent: number;
  arrayUsed: string;
  arrayFree: string;
  arrayTotal: string;
  parity: {
    status: string;
    progress: number;
    errors: number;
    running: boolean;
  };
  lastParityCheck: {
    date: string;
    duration: string;
    speed: string;
  };
  ups: {
    devices: Array<{
      id: string;
      name: string;
      model: string;
      status: string;
      batteryLevel: number;
      estimatedRuntimeSeconds: number;
      batteryHealth: string;
      inputVoltage: number;
      outputVoltage: number;
      loadPercentage: number;
    }>;
  };
  unreadNotifications: {
    info: number;
    warning: number;
    alert: number;
    total: number;
  };
  accessUrls: Array<{
    type: string;
    name: string;
    ipv4: string;
    ipv6: string;
  }>;
  notifications: Array<{
    id: string;
    type: "info" | "warning" | "alert";
    title: string;
    category: string;
    date: string;
    snippet: string;
  }>;
};

export type ArrayResponse = {
  state: string;
  capacity: {
    used: string;
    free: string;
    total: string;
    usagePercent: number;
  };
  parity: {
    status: string;
    progress: number;
    errors: number;
    running: boolean;
  };
  devices: Array<{
    id: string;
    role: string;
    diskType: "array" | "pool";
    isParity: boolean;
    pool: string;
    filesystem: string;
    temp: string;
    size: string;
    used: string;
    errors: number;
    free: string;
    usagePercent: number;
  }>;
};

export type DockerResponse = {
  summary: { running: number; stopped: number; updatesAvailable: number };
  containers: Array<{
    id: string;
    name: string;
    image: string;
    iconUrl: string;
    network: string;
    endpoint: string;
    ports: string;
    createdAt: string;
    autoStart: boolean;
    updateAvailable: boolean;
    rebuildReady: boolean;
    stateLabel: string;
    status: "running" | "stopped" | "unknown";
  }>;
};

export type VmsResponse = {
  summary: {
    running: number;
    stopped: number;
    paused: number;
    other: number;
  };
  vms: Array<{
    id: string;
    name: string;
    status: "running" | "stopped" | "unknown";
    stateLabel: string;
  }>;
};

export type SharesResponse = {
  shares: Array<{
    id: string;
    name: string;
    allocator: string;
    splitLevel: string;
    size: string;
    used: string;
    free: string;
    cached: string;
    usagePercent: number;
    location: string;
  }>;
};
