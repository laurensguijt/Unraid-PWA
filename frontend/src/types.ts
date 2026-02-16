export type Tab = "overview" | "array" | "shares" | "docker" | "vms";

export type Overview = {
  cpuPercent: number;
  cpuModel: string;
  cpuCores: number;
  cpuThreads: number;
  cpuSpeedGhz: number;
  memoryPercent: number;
  memoryUsed: string;
  memoryTotal: string;
  memoryAvailable: string;
  memoryCache: string;
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

export type ArrayData = {
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

export type DockerData = {
  summary: { running: number; stopped: number };
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
    stateLabel: string;
    status: "running" | "stopped" | "unknown";
  }>;
};

export type VmsData = {
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

export type SharesData = {
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

export type ServerRecord = {
  id: string;
  name: string;
  accentColor: string;
  baseUrl: string;
  trustSelfSigned: boolean;
  createdAt: string;
};

export type DockerAction = "start" | "stop" | "restart";
export type VmAction = "start" | "stop" | "pause" | "resume" | "forceStop" | "reboot" | "reset";
export type ArrayAction = "start" | "stop";

export type PendingAction =
  | { target: "docker"; id: string; action: DockerAction }
  | { target: "vm"; id: string; action: VmAction }
  | { target: "array"; action: ArrayAction };
