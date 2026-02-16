import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Activity,
  Archive,
  Bell,
  BellRing,
  Boxes,
  CircleX,
  Cpu,
  Folder,
  Gauge,
  HardDrive,
  LayoutGrid,
  MemoryStick,
  Monitor,
  Network,
  Info,
  Pencil,
  Plus,
  Settings,
  Thermometer,
  Trash2,
} from "lucide-react";
import { callApi, getCsrfFromCookie } from "./api";
import { BadgePill } from "./components/BadgePill";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { FrostedCard } from "./components/FrostedCard";
import { IconRow } from "./components/IconRow";
import { ProgressBar } from "./components/ProgressBar";
import { SectionHeader } from "./components/SectionHeader";
import { SkeletonLine } from "./components/SkeletonLine";
import { StatusPill } from "./components/StatusPill";
import { Toast } from "./components/Toast";
import { DockerLogo } from "./components/DockerLogo";
import {
  dockerIconProxyUrl,
  formatRelativeDaysAgo,
  formatUnraidLine,
  formatUpsRuntime,
  hasLikelyWriteScopes,
  isHttpUrl,
  resolveDockerWebUiUrl,
  toManagementAccessUrl,
  vmActionLabel,
  vmActionsForState,
} from "./lib/ui";
import type {
  ArrayData,
  DockerData,
  Overview,
  PendingAction,
  ServerRecord,
  SharesData,
  Tab,
  VmsData,
} from "./types";

const DEFAULT_ACCENT_COLOR = "#ea580c"; /* orange */

export default function App() {
  const isInitialLoad = useRef(true);
  const [updateIntervalMs, setUpdateIntervalMs] = useState<number>(() => {
    if (typeof window === "undefined") {
      return 5000;
    }
    const saved = window.localStorage.getItem("unraid-pwa-update-interval-ms");
    const parsed = Number(saved);
    if (!Number.isFinite(parsed)) {
      return 5000;
    }
    return Math.min(30000, Math.max(2000, Math.round(parsed)));
  });
  const [tab, setTab] = useState<Tab>("overview");
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [trustSelfSigned, setTrustSelfSigned] = useState(true);
  const [serverName, setServerName] = useState("");
  const [setupDone, setSetupDone] = useState(false);
  const [offline, setOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [isTestingSetup, setIsTestingSetup] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [arrayData, setArrayData] = useState<ArrayData | null>(null);
  const [sharesData, setSharesData] = useState<SharesData | null>(null);
  const [docker, setDocker] = useState<DockerData | null>(null);
  const [vmsData, setVmsData] = useState<VmsData | null>(null);
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"success" | "error" | undefined>(undefined);
  const [scopeInfo, setScopeInfo] = useState<string[]>([]);
  const [missingScopes, setMissingScopes] = useState<string[]>([]);
  const [canWriteFromServer, setCanWriteFromServer] = useState(false);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [renameInput, setRenameInput] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [archivingNotificationId, setArchivingNotificationId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dockerSearch, setDockerSearch] = useState("");
  const [vmSearch, setVmSearch] = useState("");
  const [dockerInfoOpenId, setDockerInfoOpenId] = useState<string | null>(null);
  const [vmInfoOpenId, setVmInfoOpenId] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;

    async function loadStatusAndData() {
      if (isInitialLoad.current) {
        setIsLoading(true);
      }
      try {
        const status = await callApi<{
          configured: boolean;
          baseUrl?: string;
          name?: string;
          trustSelfSigned?: boolean;
          scopes?: string[];
          canWrite?: boolean;
        }>("/api/servers/status");
        if (!status.configured) {
          if (!stop) {
            setSetupDone(false);
            setIsLoading(false);
            isInitialLoad.current = false;
          }
          return;
        }
        if (status.configured && !stop) {
          setSetupDone(true);
          setScopeInfo(status.scopes ?? []);
          setCanWriteFromServer(Boolean(status.canWrite));
          if (status.baseUrl) {
            setServerUrl(status.baseUrl);
          }
          if (status.name) {
            setServerName(status.name);
          }
          if (typeof status.trustSelfSigned === "boolean") {
            setTrustSelfSigned(status.trustSelfSigned);
          }
        }
        const [serverList, appSettings] = await Promise.all([
          callApi<{
            activeServerId: string | null;
            servers: Array<ServerRecord & { scopes: string[] }>;
          }>("/api/servers"),
          callApi<{ themeMode: "dark" | "light"; accentColor: string }>("/api/settings/app"),
        ]);
        if (!stop) {
          setServers(serverList.servers);
          setActiveServerId(serverList.activeServerId);
          setThemeMode(appSettings.themeMode);
          setAccentColor(appSettings.accentColor);
        }

        const settled = await Promise.allSettled([
          callApi<Overview>("/api/overview"),
          callApi<ArrayData>("/api/array"),
          callApi<SharesData>("/api/shares"),
          callApi<DockerData>("/api/docker"),
          callApi<VmsData>("/api/vms"),
        ]);
        if (!stop) {
          let successCount = 0;
          if (settled[0].status === "fulfilled") {
            setOverview(settled[0].value);
            successCount += 1;
          }
          if (settled[1].status === "fulfilled") {
            setArrayData(settled[1].value);
            successCount += 1;
          }
          if (settled[2].status === "fulfilled") {
            setSharesData(settled[2].value);
            successCount += 1;
          }
          if (settled[3].status === "fulfilled") {
            setDocker(settled[3].value);
            successCount += 1;
          }
          if (settled[4].status === "fulfilled") {
            setVmsData(settled[4].value);
            successCount += 1;
          }
          setOffline(successCount === 0);
          if (successCount === 0) {
            setMessage("Connected server, but no data endpoints returned yet. Check API scopes and GraphQL mappings.");
          }
        }
      } catch {
        if (!stop) {
          setOffline(true);
        }
      } finally {
        if (!stop) {
          if (isInitialLoad.current) {
            setIsLoading(false);
            isInitialLoad.current = false;
          }
        }
      }
    }

    loadStatusAndData().catch(() => undefined);
    const interval = window.setInterval(loadStatusAndData, updateIntervalMs);
    return () => {
      stop = true;
      window.clearInterval(interval);
    };
  }, [updateIntervalMs, reloadNonce]);

  useEffect(() => {
    window.localStorage.setItem("unraid-pwa-update-interval-ms", String(updateIntervalMs));
  }, [updateIntervalMs]);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => {
      setMessage("");
      setMessageVariant(undefined);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function handleSetup(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setMessageVariant(undefined);
    setIsSavingSetup(true);

    try {
      const test = await runSetupConnectionTest();
      if (!test) {
        return;
      }
      const csrf = getCsrfFromCookie();
      await callApi("/api/servers", {
        method: "POST",
        headers: {
          "x-csrf-token": csrf ?? "",
        },
        body: JSON.stringify({
          name: serverName,
          baseUrl: serverUrl,
          apiKey,
          trustSelfSigned,
          requestedScopes: test.scopes,
        }),
      });
      setSetupDone(true);
      setMessage("Server setup complete.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Setup failed.");
    } finally {
      setIsSavingSetup(false);
    }
  }

  async function runSetupConnectionTest(): Promise<{ scopes: string[]; missingScopes: string[] } | null> {
    const test = await callApi<{
      ok: boolean;
      scopes: string[];
      missingScopes: string[];
      canWrite?: boolean;
    }>("/api/servers/test", {
      method: "POST",
      body: JSON.stringify({ baseUrl: serverUrl, apiKey, trustSelfSigned }),
    });
    if (!test.ok) {
      setMessage("Connection test failed.");
      return null;
    }
    setScopeInfo(test.scopes);
    setMissingScopes(test.missingScopes);
    setCanWriteFromServer(Boolean(test.canWrite));
    return { scopes: test.scopes, missingScopes: test.missingScopes };
  }

  async function handleTestConnection() {
    if (!serverUrl || !apiKey) {
      setMessage("Fill in server URL and API key first.");
      setMessageVariant("error");
      return;
    }
    setMessage("");
    setMessageVariant(undefined);
    setIsTestingSetup(true);
    try {
      const test = await runSetupConnectionTest();
      if (test) {
        setMessage("Connection OK.");
        setMessageVariant("success");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection test failed.");
      setMessageVariant("error");
    } finally {
      setIsTestingSetup(false);
    }
  }

  async function runAction() {
    if (!pendingAction) {
      return;
    }
    const csrf = getCsrfFromCookie();
    try {
      const endpoint =
        pendingAction.target === "docker"
          ? `/api/docker/${pendingAction.id}/${pendingAction.action}`
          : pendingAction.target === "vm"
            ? `/api/vms/${pendingAction.id}/${pendingAction.action}`
            : `/api/array/${pendingAction.action}`;
      await callApi(endpoint, {
        method: "POST",
        headers: {
          "x-csrf-token": csrf ?? "",
        },
      });
      setMessage(`${pendingAction.target} ${pendingAction.action} requested.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function refreshServerSettingsData() {
    const [serverList, appSettings] = await Promise.all([
      callApi<{
        activeServerId: string | null;
        servers: ServerRecord[];
      }>("/api/servers"),
      callApi<{ themeMode: "dark" | "light"; accentColor: string }>("/api/settings/app"),
    ]);
    setServers(serverList.servers);
    setActiveServerId(serverList.activeServerId);
    setThemeMode(appSettings.themeMode);
    setAccentColor(appSettings.accentColor);
  }

  async function activateServer(id: string) {
    const csrf = getCsrfFromCookie();
    await callApi(`/api/servers/${id}/activate`, {
      method: "POST",
      headers: { "x-csrf-token": csrf ?? "" },
    });
    await refreshServerSettingsData();
    setMessage("Active server changed.");
    setReloadNonce((current) => current + 1);
  }

  async function renameServerById(id: string) {
    const csrf = getCsrfFromCookie();
    const name = (renameInput[id] ?? "").trim();
    await callApi(`/api/servers/${id}`, {
      method: "PUT",
      headers: { "x-csrf-token": csrf ?? "" },
      body: JSON.stringify({ name }),
    });
    await refreshServerSettingsData();
    setMessage("Server name updated.");
  }

  async function setServerTrustSelfSigned(id: string, value: boolean) {
    const csrf = getCsrfFromCookie();
    await callApi(`/api/servers/${id}`, {
      method: "PUT",
      headers: { "x-csrf-token": csrf ?? "" },
      body: JSON.stringify({ trustSelfSigned: value }),
    });
    await refreshServerSettingsData();
    if (activeServerId === id) {
      setTrustSelfSigned(value);
    }
    setMessage(`Trust self-signed ${value ? "enabled" : "disabled"} for server.`);
  }

  async function removeServer(id: string) {
    const csrf = getCsrfFromCookie();
    await callApi(`/api/servers/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf ?? "" },
    });
    await refreshServerSettingsData();
    setMessage("Server removed.");
  }

  async function saveAppSettings(nextThemeMode: "dark" | "light", nextAccent: string) {
    const csrf = getCsrfFromCookie();
    await callApi("/api/settings/app", {
      method: "PUT",
      headers: { "x-csrf-token": csrf ?? "" },
      body: JSON.stringify({ themeMode: nextThemeMode, accentColor: nextAccent }),
    });
    setThemeMode(nextThemeMode);
    setAccentColor(nextAccent);
    setMessage("App settings saved.");
  }

  async function archiveNotificationById(notificationId: string) {
    const csrf = getCsrfFromCookie();
    setArchivingNotificationId(notificationId);
    try {
      await callApi(`/api/notifications/${encodeURIComponent(notificationId)}/archive`, {
        method: "POST",
        headers: { "x-csrf-token": csrf ?? "" },
      });
      setMessage("Notification archived.");
      setReloadNonce((current) => current + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Archive failed.");
    } finally {
      setArchivingNotificationId(null);
    }
  }

  const filteredContainers = useMemo(() => {
    const containers = docker?.containers ?? [];
    const query = dockerSearch.trim().toLowerCase();
    if (!query) {
      return containers;
    }
    return containers.filter((container) =>
      [container.name, container.image, container.stateLabel, container.network]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [docker, dockerSearch]);
  const filteredShares = useMemo(() => sharesData?.shares ?? [], [sharesData]);
  const filteredVms = useMemo(() => {
    const vms = vmsData?.vms ?? [];
    const query = vmSearch.trim().toLowerCase();
    if (!query) {
      return vms;
    }
    return vms.filter((vm) =>
      [vm.name, vm.stateLabel, vm.status].join(" ").toLowerCase().includes(query),
    );
  }, [vmsData, vmSearch]);
  const parityDisks = useMemo(
    () =>
      (arrayData?.devices ?? [])
        .filter((device) => device.isParity)
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })),
    [arrayData],
  );
  const arrayDisks = useMemo(
    () =>
      (arrayData?.devices ?? [])
        .filter((device) => !device.isParity && device.diskType === "array")
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })),
    [arrayData],
  );
  const poolDisks = useMemo(
    () =>
      (arrayData?.devices ?? [])
        .filter((device) => !device.isParity && device.diskType === "pool")
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })),
    [arrayData],
  );
  const canWriteControls = useMemo(() => {
    if (canWriteFromServer) {
      return true;
    }
    return hasLikelyWriteScopes(scopeInfo);
  }, [canWriteFromServer, scopeInfo]);
  const activeServer = useMemo(
    () => servers.find((server) => server.id === activeServerId) ?? null,
    [servers, activeServerId],
  );
  const selectedDocker = useMemo(
    () => (docker?.containers ?? []).find((container) => container.id === dockerInfoOpenId) ?? null,
    [docker, dockerInfoOpenId],
  );
  const selectedVm = useMemo(
    () => (vmsData?.vms ?? []).find((vm) => vm.id === vmInfoOpenId) ?? null,
    [vmsData, vmInfoOpenId],
  );
  const headerServerName = activeServer?.name || overview?.serverName || serverName || "Unraid";

  const effectiveTheme = themeMode;
  const accentRgb = useMemo(() => {
    const normalized = accentColor.trim();
    const hex = /^#([0-9a-f]{6})$/i.exec(normalized);
    if (!hex) {
      return "234, 88, 12"; /* DEFAULT_ACCENT_COLOR RGB */
    }
    const value = hex[1];
    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }, [accentColor]);

  const TAB_LABELS: Record<string, string> = {
    overview: "Dash",
    array: "Storage",
    shares: "Shares",
    docker: "Docker",
    vms: "VM",
  };
  const tabs = [
    { id: "overview", icon: Gauge },
    { id: "array", icon: HardDrive },
    { id: "shares", icon: Folder },
    { id: "docker", icon: Boxes },
    { id: "vms", icon: Monitor },
  ] as const;
  const tabTitle = tab === "overview" ? "Unraid" : (TAB_LABELS[tab] ?? tab);
  const appStyle = useMemo(
    () =>
      ({
        "--accent-rgb": accentRgb,
      }) as CSSProperties,
    [accentRgb],
  );

  function renderMaybeUrl(value: string, label?: string) {
    if (!isHttpUrl(value)) {
      return <small className="url-text">{value}</small>;
    }
    return (
      <a className="url-link" href={value} target="_blank" rel="noreferrer">
        {label ?? value}
      </a>
    );
  }

  const managementAccessUrl = useMemo(() => toManagementAccessUrl(serverUrl), [serverUrl]);

  return (
    <main className={`app theme-${effectiveTheme}`} style={appStyle}>
      <div className="gradient" />
      <section className="panel">
        <header className="header">
          <div className="header-title-stack">
            <h1>{setupDone ? (tab === "overview" ? headerServerName : tabTitle) : "Unraid"}</h1>
            {setupDone && tab === "overview" ? (
              <small className={offline ? "header-status offline" : "header-status online"}>
                <span className="header-status-dot" aria-hidden />
                {offline ? "offline" : "online"}
              </small>
            ) : null}
          </div>
          <div className="header-actions">
            {setupDone && servers.length > 1 && activeServerId ? (
              <select
                className="server-switcher"
                value={activeServerId}
                onChange={(event) => void activateServer(event.target.value)}
                aria-label="Switch active server"
              >
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
            ) : null}
            {setupDone ? (
              <button
                className="circle-button"
                type="button"
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={18} />
              </button>
            ) : null}
          </div>
        </header>

        {!setupDone && (
          <form className="card" onSubmit={handleSetup}>
            <SectionHeader title="First run setup" right={scopeInfo.length ? <BadgePill value={`${scopeInfo.length} scopes`} /> : undefined} />
            <label>
              Server name
              <input
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Leave blank to use Unraid server name"
              />
            </label>
            <label>
              Server base URL
              <input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://<server-ip>:3443"
                required
              />
            </label>
            <label>
              API key
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="unraid-api-key"
                required
              />
              {managementAccessUrl && (
                <small className="setup-help-inline">
                  Get API key:{" "}
                  <a className="url-link" href={managementAccessUrl} target="_blank" rel="noreferrer">
                    {managementAccessUrl}
                  </a>
                </small>
              )}
              <details className="setup-scope-help">
                <summary>API permissions</summary>
                <small><strong>Read-only (viewer):</strong> READ_ANY or viewer role for array, docker, vms, info</small>
                <br />
                <small><strong>Full control:</strong> CREATE_ANY, UPDATE_ANY, DELETE_ANY (or admin role)</small>
              </details>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={trustSelfSigned}
                onChange={(e) => setTrustSelfSigned(e.target.checked)}
              />
              Trust self signed certificates
            </label>
            <div className="actions">
              <button type="button" className="secondary" disabled={isTestingSetup || isSavingSetup} onClick={() => void handleTestConnection()}>
                {isTestingSetup ? "Testing..." : "Test connection"}
              </button>
              <button type="submit" disabled={isSavingSetup || isTestingSetup}>
                {isSavingSetup ? "Connecting..." : "Save and connect"}
              </button>
            </div>
            {scopeInfo.length > 0 && (
              <small>
                Detected scopes: {scopeInfo.join(", ")}
              </small>
            )}
            {missingScopes.length > 0 && (
              <small>
                Missing recommended read scopes: {missingScopes.join(", ")}
              </small>
            )}
          </form>
        )}

        {setupDone && tab === "overview" && isLoading && (
          <FrostedCard>
            <SectionHeader title="Loading overview" />
            <SkeletonLine />
            <SkeletonLine width="70%" />
          </FrostedCard>
        )}

        {setupDone && tab === "overview" && overview && !isLoading && (
          <>
            <FrostedCard>
              <SectionHeader title="Usage" />
              <IconRow label="CPU" value={`${overview.cpuPercent}%`} icon={Cpu} />
              <ProgressBar value={overview.cpuPercent} />
              <small>
                {overview.cpuModel} - {overview.cpuCores || "?"} cores / {overview.cpuThreads || "?"} threads @{" "}
                {overview.cpuSpeedGhz ? `${overview.cpuSpeedGhz.toFixed(2)} GHz` : "-"}
              </small>
              <IconRow label="Memory" value={`${overview.memoryPercent}%`} icon={MemoryStick} />
              <ProgressBar value={overview.memoryPercent} />
              <small>{overview.memoryUsed} / {overview.memoryTotal}</small>
              <small>Free: {overview.memoryFree}</small>
            </FrostedCard>
            <FrostedCard>
              <SectionHeader title="System" />
              <IconRow label="Hostname" value={overview.hostname} icon={Network} />
              <IconRow label="Uptime" value={overview.uptime} icon={Activity} />
              <IconRow label="Motherboard" value={overview.motherboard} icon={HardDrive} />
              <IconRow
                label="Unraid"
                value={formatUnraidLine(overview.osDistro, overview.licenseType, overview.unraidVersion)}
                icon={HardDrive}
              />
              <IconRow label="Kernel" value={overview.kernelVersion} icon={Cpu} />
            </FrostedCard>
            <FrostedCard>
              <SectionHeader title="Array Health" />
              <IconRow label="State" value={overview.arrayState} icon={HardDrive} />
              <IconRow label="Used" value={overview.arrayUsed} icon={Gauge} />
              <IconRow label="Free" value={overview.arrayFree} icon={CircleX} />
              <IconRow label="Total" value={overview.arrayTotal} icon={LayoutGrid} />
              <IconRow label="Usage" value={`${overview.arrayUsagePercent}%`} icon={Gauge} />
              <ProgressBar value={overview.arrayUsagePercent} />
            </FrostedCard>
            <FrostedCard>
              <SectionHeader title="Parity" />
              <IconRow
                label="Parity status"
                value={
                  overview.parity.status.toLowerCase() === "completed"
                    ? `${overview.parity.status} (${overview.parity.errors} errors)`
                    : overview.parity.status
                }
                icon={Activity}
              />
              {(overview.parity.running || overview.parity.status.toLowerCase() === "running") && (
                <>
                  <IconRow label="Parity progress" value={`${overview.parity.progress}%`} icon={Gauge} />
                  <IconRow label="Speed" value={overview.lastParityCheck.speed} icon={HardDrive} />
                  <IconRow label="Parity errors" value={String(overview.parity.errors)} icon={CircleX} />
                </>
              )}
              <IconRow label="Last run" value={formatRelativeDaysAgo(overview.lastParityCheck.date)} icon={Activity} />
              <IconRow label="Duration" value={overview.lastParityCheck.duration} icon={Gauge} />
            </FrostedCard>
            {overview.ups.devices.length > 0 && (
              <FrostedCard>
                <SectionHeader title="Backups / UPS" right={<BadgePill value={overview.ups.devices.length} />} />
                {overview.ups.devices.map((device) => (
                  <div key={device.id} className="list-item">
                    <div className="row">
                      <strong>{device.model || device.name}</strong>
                      <StatusPill
                        status={device.status.toLowerCase().includes("online") ? "running" : "stopped"}
                        label={device.status.toLowerCase().includes("online") ? "active" : "not active"}
                      />
                    </div>
                    {device.name && device.name !== device.model ? <small>{device.name}</small> : null}
                    <div className="array-grid">
                      <IconRow label="Battery" value={`${device.batteryLevel}%`} icon={Gauge} />
                      <IconRow label="Runtime" value={formatUpsRuntime(device.estimatedRuntimeSeconds)} icon={Activity} />
                      <IconRow label="Health" value={device.batteryHealth} icon={CircleX} />
                    </div>
                    <IconRow label="Load" value={`${Math.max(0, Math.min(100, device.loadPercentage))}%`} icon={Cpu} />
                    <ProgressBar value={Math.max(0, Math.min(100, device.loadPercentage))} />
                    <div className="array-grid">
                      <IconRow label="Input" value={`${device.inputVoltage || 0} V`} icon={Network} />
                      <IconRow label="Output" value={`${device.outputVoltage || 0} V`} icon={Network} />
                    </div>
                  </div>
                ))}
              </FrostedCard>
            )}
            <FrostedCard>
              <SectionHeader title="Notifications" right={<BadgePill value={overview.unreadNotifications.total} />} />
              <div className="array-grid">
                <IconRow label="Alerts" value={String(overview.unreadNotifications.alert)} icon={CircleX} />
                <IconRow label="Warnings" value={String(overview.unreadNotifications.warning)} icon={Thermometer} />
                <IconRow label="Info" value={String(overview.unreadNotifications.info)} icon={Activity} />
              </div>
              {overview.notifications.slice(0, 5).map((item) => (
                <div key={item.id} className="notification">
                  <div className="row notification-top">
                    <div className="notification-title-wrap">
                      {item.type === "alert" ? (
                        <CircleX size={16} className="notification-icon alert" aria-hidden />
                      ) : item.type === "warning" ? (
                        <BellRing size={16} className="notification-icon warning" aria-hidden />
                      ) : (
                        <Bell size={16} className="notification-icon info" aria-hidden />
                      )}
                      <strong>{item.title}</strong>
                    </div>
                    <button
                      className="icon-button notification-archive"
                      type="button"
                      disabled={!canWriteControls || archivingNotificationId === item.id}
                      onClick={() => void archiveNotificationById(item.id)}
                      aria-label={`Archive notification ${item.title}`}
                      title="Archive notification"
                    >
                      <Archive size={14} />
                    </button>
                  </div>
                  <span>{item.category} - {new Date(item.date).toLocaleDateString()}</span>
                  <p>{item.snippet}</p>
                </div>
              ))}
              {overview.notifications.length === 0 && overview.unreadNotifications.total === 0 && (
                <small>No active warnings/alerts.</small>
              )}
              {overview.notifications.length === 0 && overview.unreadNotifications.total > 0 && (
                <small>Unread notifications exist, but details could not be loaded yet.</small>
              )}
            </FrostedCard>
            <FrostedCard>
              <SectionHeader title="Network Access URLs" right={<BadgePill value={overview.accessUrls.length} />} />
              {overview.accessUrls.slice(0, 8).map((url, index) => (
                <div key={`${url.type}-${url.name}-${index}`} className="list-item">
                  <div className="row">
                    <strong>{url.type}</strong>
                    <BadgePill value={url.name || "-"} />
                  </div>
                  {(() => {
                    const uniqueUrls = Array.from(
                      new Set([url.ipv4, url.ipv6].filter((value) => value && value !== "-")),
                    );
                    if (uniqueUrls.length === 0) {
                      return <small className="url-text">-</small>;
                    }
                    return (
                      <div className="url-stack">
                        {uniqueUrls.map((value) => (
                          <div key={value}>{renderMaybeUrl(value)}</div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ))}
              {overview.accessUrls.length === 0 && <small>No access URLs available.</small>}
            </FrostedCard>
          </>
        )}

        {setupDone && tab === "array" && arrayData && (
          <>
            <FrostedCard>
              <SectionHeader
                title="Array Overview"
                right={<BadgePill value={arrayData.devices.length} />}
              />
              <div className="array-grid">
                <IconRow label="State" value={arrayData.state} icon={HardDrive} />
                <IconRow label="Used" value={arrayData.capacity.used} icon={Gauge} />
                <IconRow label="Free" value={arrayData.capacity.free} icon={CircleX} />
                <IconRow label="Total" value={arrayData.capacity.total} icon={LayoutGrid} />
              </div>
              <ProgressBar value={arrayData.capacity.usagePercent} />
              <div className="actions">
                <button
                  disabled={!canWriteControls}
                  onClick={() => setPendingAction({ target: "array", action: "start" })}
                >
                  Start array
                </button>
                <button
                  disabled={!canWriteControls}
                  onClick={() => setPendingAction({ target: "array", action: "stop" })}
                >
                  Stop array
                </button>
              </div>
            </FrostedCard>

            <FrostedCard>
              <SectionHeader title="Parity disks" right={<BadgePill value={parityDisks.length} />} />
              {parityDisks.map((device, index) => (
                <div key={device.id} className="list-item">
                  <div className="row">
                    <strong>{`Parity disk ${index + 1}`}</strong>
                    <BadgePill value={device.id} />
                  </div>
                  <div className="array-grid">
                    <IconRow label="Temp" value={device.temp} icon={Thermometer} />
                    <IconRow label="Size" value={device.size} icon={LayoutGrid} />
                    <IconRow label="Errors" value={String(device.errors)} icon={Activity} />
                  </div>
                  <ProgressBar value={device.usagePercent} />
                </div>
              ))}
              {parityDisks.length === 0 && <small>No parity disks detected.</small>}
            </FrostedCard>

            <FrostedCard>
              <SectionHeader title="Array disks" right={<BadgePill value={arrayDisks.length} />} />
              {arrayDisks.map((device, index) => (
                <div key={device.id} className="list-item">
                  <div className="row">
                    <strong>{`Array disk ${index + 1}`}</strong>
                    <BadgePill value={device.id} />
                  </div>
                  <div className="array-grid">
                    <IconRow label="Temp" value={device.temp} icon={Thermometer} />
                    <IconRow label="Filesystem" value={device.filesystem} icon={HardDrive} />
                    <IconRow label="Size" value={device.size} icon={LayoutGrid} />
                    <IconRow label="Errors" value={String(device.errors)} icon={Activity} />
                    <IconRow label="Used" value={device.used} icon={Gauge} />
                    <IconRow label="Free" value={device.free} icon={CircleX} />
                  </div>
                  <ProgressBar value={device.usagePercent} />
                </div>
              ))}
              {arrayDisks.length === 0 && <small>No array disks detected.</small>}
            </FrostedCard>

            <FrostedCard>
              <SectionHeader title="Pool disks" right={<BadgePill value={poolDisks.length} />} />
              {poolDisks.map((device, index) => (
                <div key={device.id} className="list-item">
                  <div className="row">
                    <strong>{`Pool disk ${index + 1}`}</strong>
                    <BadgePill value={device.id} />
                  </div>
                  <div className="array-grid">
                    <IconRow label="Temp" value={device.temp} icon={Thermometer} />
                    <IconRow label="Filesystem" value={device.filesystem} icon={HardDrive} />
                    <IconRow label="Size" value={device.size} icon={LayoutGrid} />
                    <IconRow label="Errors" value={String(device.errors)} icon={Activity} />
                    <IconRow label="Used" value={device.used} icon={Gauge} />
                    <IconRow label="Free" value={device.free} icon={CircleX} />
                  </div>
                  <ProgressBar value={device.usagePercent} />
                </div>
              ))}
              {poolDisks.length === 0 && <small>No pool disks detected.</small>}
            </FrostedCard>
          </>
        )}

        {setupDone && tab === "shares" && (
          <>
            {filteredShares.map((share) => (
              <FrostedCard key={share.id}>
                <div className="row">
                  <h3>{share.name}</h3>
                  <BadgePill value={share.location} />
                </div>
                <IconRow label="Split Level" value={share.splitLevel} />
                <IconRow label="Allocator" value={share.allocator} icon={LayoutGrid} />
                <IconRow label="Used" value={share.used} icon={Gauge} />
                <IconRow label="Free" value={share.free} icon={CircleX} />
                <ProgressBar value={share.usagePercent} />
              </FrostedCard>
            ))}
          </>
        )}

        {setupDone && tab === "docker" && (
          <>
            <FrostedCard>
              <SectionHeader title="Docker Overview" />
              <label className="search-inline-label">
                <input
                  className="search-inline-input"
                  value={dockerSearch}
                  onChange={(event) => setDockerSearch(event.target.value)}
                  placeholder="Search dockers..."
                />
              </label>
              <IconRow label="Running" value={`${docker?.summary.running ?? 0}`} icon={Activity} />
              <IconRow label="Stopped" value={`${docker?.summary.stopped ?? 0}`} icon={CircleX} />
              <IconRow label="Updates" value={`${docker?.summary.updatesAvailable ?? 0}`} icon={Plus} />
            </FrostedCard>
            {filteredContainers.map((container) => (
              <FrostedCard key={container.id}>
                <div className="row">
                  <div className="docker-title">
                    <DockerLogo
                      name={container.name}
                      iconUrl={container.iconUrl}
                      fallbackIconUrl={dockerIconProxyUrl(container.id)}
                    />
                    <h3>{container.name}</h3>
                  </div>
                  <div className="docker-card-actions">
                    <StatusPill status={container.status} />
                    <button
                      className="icon-button notification-archive"
                      type="button"
                      onClick={() => setDockerInfoOpenId(container.id)}
                      aria-label={`Open info for ${container.name}`}
                      title="Container details"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                </div>
                <small>{container.image}</small>
                {(container.updateAvailable || container.rebuildReady) && (
                  <small>
                    Update status: {container.updateAvailable ? "update available" : "up to date"}
                    {container.rebuildReady ? " (rebuild ready)" : ""}
                  </small>
                )}
              </FrostedCard>
            ))}
          </>
        )}

        {setupDone && tab === "docker" && selectedDocker && (
          <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Docker details"
            onClick={() => setDockerInfoOpenId(null)}
          >
            <div className="dialog settings-dialog docker-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="row docker-dialog-header">
                <div className="docker-title">
                  <DockerLogo
                    name={selectedDocker.name}
                    iconUrl={selectedDocker.iconUrl}
                    fallbackIconUrl={dockerIconProxyUrl(selectedDocker.id)}
                  />
                  <div className="docker-dialog-title">
                    <h3>{selectedDocker.name}</h3>
                    <small className="docker-dialog-image">{selectedDocker.image}</small>
                  </div>
                </div>
                <div className="docker-card-actions">
                  <StatusPill status={selectedDocker.status} />
                  <button className="secondary dialog-close-button" type="button" onClick={() => setDockerInfoOpenId(null)}>
                    Close
                  </button>
                </div>
              </div>

              <div className="docker-detail-grid">
                <div className="docker-detail-item">
                  <small>State</small>
                  <strong>{selectedDocker.stateLabel}</strong>
                </div>
                <div className="docker-detail-item">
                  <small>Auto start</small>
                  <strong>{selectedDocker.autoStart ? "yes" : "no"}</strong>
                </div>
                <div className="docker-detail-item">
                  <small>Created</small>
                  <strong>{selectedDocker.createdAt}</strong>
                </div>
                <div className="docker-detail-item">
                  <small>Network</small>
                  <strong>{selectedDocker.network}</strong>
                </div>
              </div>

              <IconRow label="Ports" value={selectedDocker.ports} icon={LayoutGrid} />
              <div className="icon-row">
                <div className="icon-row-left">
                  <Network size={15} className="row-icon" />
                  <small>Web UI</small>
                </div>
                {(() => {
                  const resolved = resolveDockerWebUiUrl(selectedDocker.endpoint, activeServer?.baseUrl);
                  if (resolved) {
                    return (
                      <a className="url-link" href={resolved} target="_blank" rel="noreferrer">
                        {resolved}
                      </a>
                    );
                  }
                  return renderMaybeUrl(selectedDocker.endpoint);
                })()}
              </div>
              <div className="actions">
                <button
                  disabled={!canWriteControls}
                  onClick={() =>
                    setPendingAction({ target: "docker", id: selectedDocker.id, action: "start" })
                  }
                >
                  Start
                </button>
                <button
                  disabled={!canWriteControls}
                  onClick={() =>
                    setPendingAction({ target: "docker", id: selectedDocker.id, action: "stop" })
                  }
                >
                  Stop
                </button>
                <button
                  disabled={!canWriteControls}
                  onClick={() =>
                    setPendingAction({
                      target: "docker",
                      id: selectedDocker.id,
                      action: "restart",
                    })
                  }
                >
                  Restart
                </button>
              </div>
              {!canWriteControls && (
                <small>Write controls disabled: current API scopes are read-only.</small>
              )}
            </div>
          </div>
        )}

        {setupDone && tab === "vms" && vmsData && (
          <>
            <FrostedCard>
              <SectionHeader title="VM Overview" />
              <label className="search-inline-label">
                <input
                  className="search-inline-input"
                  value={vmSearch}
                  onChange={(event) => setVmSearch(event.target.value)}
                  placeholder="Search VMs..."
                />
              </label>
              <div className="array-grid">
                <IconRow label="Running" value={String(vmsData.summary.running)} icon={Activity} />
                <IconRow label="Stopped" value={String(vmsData.summary.stopped)} icon={CircleX} />
                <IconRow label="Paused" value={String(vmsData.summary.paused)} icon={Monitor} />
                <IconRow label="Other" value={String(vmsData.summary.other)} icon={LayoutGrid} />
              </div>
            </FrostedCard>
            <FrostedCard>
              <SectionHeader title="VMs" right={<BadgePill value={filteredVms.length} />} />
              {filteredVms.map((vm) => (
                <div key={vm.id} className="list-item vm-item">
                  <div className="row">
                    <strong>{vm.name}</strong>
                    <div className="docker-card-actions">
                      <StatusPill status={vm.status} />
                      <button
                        className="icon-button notification-archive"
                        type="button"
                        onClick={() => setVmInfoOpenId(vm.id)}
                        aria-label={`Open info for ${vm.name}`}
                        title="VM details"
                      >
                        <Info size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </FrostedCard>
          </>
        )}

        {setupDone && tab === "vms" && selectedVm && (
          <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="VM details"
            onClick={() => setVmInfoOpenId(null)}
          >
            <div className="dialog settings-dialog docker-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="row docker-dialog-header">
                <div className="docker-dialog-title">
                  <h3>{selectedVm.name}</h3>
                  <small className="docker-dialog-image">{selectedVm.id}</small>
                </div>
                <div className="docker-card-actions">
                  <StatusPill status={selectedVm.status} />
                  <button className="secondary dialog-close-button" type="button" onClick={() => setVmInfoOpenId(null)}>
                    Close
                  </button>
                </div>
              </div>

              <div className="actions">
                {vmActionsForState(selectedVm.stateLabel).map((action) => (
                  <button
                    key={action}
                    className={action === "forceStop" || action === "reset" ? "secondary" : undefined}
                    disabled={!canWriteControls}
                    onClick={() => setPendingAction({ target: "vm", id: selectedVm.id, action })}
                  >
                    {vmActionLabel(action)}
                  </button>
                ))}
              </div>
              {!canWriteControls && (
                <small>Write controls disabled: current API scopes are read-only.</small>
              )}
            </div>
          </div>
        )}

        {setupDone && settingsOpen && (
          <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onClick={() => setSettingsOpen(false)}
          >
            <div className="dialog settings-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="row">
                <h3>Settings</h3>
                <button className="secondary" type="button" onClick={() => setSettingsOpen(false)}>
                  Close
                </button>
              </div>
              <small>Manage servers and app preferences.</small>
              <FrostedCard>
                <SectionHeader title="Server management" right={<BadgePill value={servers.length} />} />
                {servers.map((server) => (
                  <div key={server.id} className="list-item">
                    <div className="row">
                      <strong>{server.name}</strong>
                      {activeServerId === server.id ? <BadgePill value="Active" /> : null}
                    </div>
                    {renderMaybeUrl(server.baseUrl)}
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={server.trustSelfSigned}
                        onChange={(event) =>
                          void setServerTrustSelfSigned(server.id, event.target.checked)
                        }
                      />
                      Trust self signed certificates
                    </label>
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={activeServerId === server.id}
                        onClick={() => void activateServer(server.id)}
                      >
                        Use
                      </button>
                      <button className="secondary" onClick={() => setRenameInput((prev) => ({ ...prev, [server.id]: server.name }))}>
                        <Pencil size={14} /> Rename
                      </button>
                      <button className="secondary" onClick={() => void removeServer(server.id)}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                    {renameInput[server.id] !== undefined && (
                      <div className="actions">
                        <input
                          value={renameInput[server.id]}
                          onChange={(event) =>
                            setRenameInput((prev) => ({ ...prev, [server.id]: event.target.value }))
                          }
                          placeholder="Leave blank to use Unraid server name"
                        />
                        <button onClick={() => void renameServerById(server.id)}>Save</button>
                      </div>
                    )}
                  </div>
                ))}
                <div className="actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      setServerName("");
                      setServerUrl("");
                      setApiKey("");
                      setScopeInfo([]);
                      setMissingScopes([]);
                      setTrustSelfSigned(true);
                      setSetupDone(false);
                      setSettingsOpen(false);
                    }}
                  >
                    <Plus size={14} /> Add server
                  </button>
                </div>
              </FrostedCard>
              <FrostedCard>
                <SectionHeader title="App settings" />
                <div className="settings-grid">
                  <label>
                    Theme mode
                    <select
                      value={themeMode}
                      onChange={(event) =>
                        void saveAppSettings(
                          event.target.value as "dark" | "light",
                          accentColor,
                        )
                      }
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </label>
                  <label>
                    Accent color
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(event) =>
                        void saveAppSettings(
                          themeMode,
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    Update interval ({Math.round(updateIntervalMs / 1000)}s)
                    <input
                      type="range"
                      min={2}
                      max={30}
                      step={1}
                      value={Math.round(updateIntervalMs / 1000)}
                      onChange={(event) => {
                        const seconds = Number(event.target.value);
                        const nextMs = Math.min(30000, Math.max(2000, Math.round(seconds * 1000)));
                        setUpdateIntervalMs(nextMs);
                      }}
                    />
                  </label>
                </div>
              </FrostedCard>
            </div>
          </div>
        )}

        {setupDone && (
          <nav className="tabbar">
            {tabs.map((item) => (
              <button
                key={item.id}
                className={tab === item.id ? "active" : ""}
                onClick={() => setTab(item.id)}
              >
                <span className="tab-icon"><item.icon size={14} /></span>
                <span className="tab-label">{TAB_LABELS[item.id] ?? item.id}</span>
              </button>
            ))}
          </nav>
        )}

        <ConfirmDialog
          open={Boolean(pendingAction)}
          title="Confirm action"
          message={
            pendingAction
              ? pendingAction.target === "docker"
                ? `Do you want to ${pendingAction.action} container ${pendingAction.id}?`
                : pendingAction.target === "vm"
                  ? `Do you want to ${pendingAction.action} VM ${pendingAction.id}?`
                  : `Do you want to ${pendingAction.action} the array?`
              : ""
          }
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void runAction()}
        />

        <Toast message={message} variant={messageVariant} />
      </section>
    </main>
  );
}
