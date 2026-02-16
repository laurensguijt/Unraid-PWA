import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { hasLikelyWriteScopes, toManagementAccessUrl } from "../lib/ui";
import type {
  ArrayData,
  DockerData,
  Overview,
  PendingAction,
  ServerRecord,
  SharesData,
  Tab,
  VmsData,
} from "../types";
import { useUnraidActions } from "./useUnraidActions";
import { useUnraidPolling } from "./useUnraidPolling";

const DEFAULT_ACCENT_COLOR = "#ea580c";

export function useUnraidAppController() {
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
  const [messageVariant, setMessageVariant] = useState<"success" | "error" | undefined>(
    undefined,
  );

  const [scopeInfo, setScopeInfo] = useState<string[]>([]);
  const [missingScopes, setMissingScopes] = useState<string[]>([]);
  const [canWriteFromServer, setCanWriteFromServer] = useState(false);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerRecord[]>([]);

  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [renameInput, setRenameInput] = useState<Record<string, string>>({});
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [archivingNotificationId, setArchivingNotificationId] = useState<string | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addServerOpen, setAddServerOpen] = useState(false);
  const [dockerSearch, setDockerSearch] = useState("");
  const [vmSearch, setVmSearch] = useState("");
  const [dockerInfoOpenId, setDockerInfoOpenId] = useState<string | null>(null);
  const [vmInfoOpenId, setVmInfoOpenId] = useState<string | null>(null);

  useUnraidPolling({
    updateIntervalMs,
    reloadNonce,
    setSetupDone,
    setOffline,
    setIsLoading,
    setScopeInfo,
    setCanWriteFromServer,
    setServerUrl,
    setServerName,
    setTrustSelfSigned,
    setServers,
    setActiveServerId,
    setThemeMode,
    setAccentColor,
    setOverview,
    setArrayData,
    setSharesData,
    setDocker,
    setVmsData,
    setMessage,
  });

  const actions = useUnraidActions({
    serverName,
    serverUrl,
    apiKey,
    trustSelfSigned,
    renameInput,
    apiKeyInput,
    activeServerId,
    pendingAction,
    setMessage,
    setMessageVariant,
    setIsSavingSetup,
    setIsTestingSetup,
    setScopeInfo,
    setMissingScopes,
    setCanWriteFromServer,
    setSetupDone,
    setServers,
    setActiveServerId,
    setThemeMode,
    setAccentColor,
    setTrustSelfSigned,
    setReloadNonce,
    setPendingAction,
    setArchivingNotificationId,
    setServerName,
    setServerUrl,
    setApiKey,
    setApiKeyInput,
    setAddServerOpen,
    setSettingsOpen,
  });

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

    return () => {
      window.clearTimeout(timer);
    };
  }, [message]);

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

  const filteredVms = useMemo(() => {
    const vms = vmsData?.vms ?? [];
    const query = vmSearch.trim().toLowerCase();
    if (!query) {
      return vms;
    }

    return vms.filter((vm) => [vm.name, vm.stateLabel, vm.status].join(" ").toLowerCase().includes(query));
  }, [vmsData, vmSearch]);

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
  const managementAccessUrl = useMemo(() => toManagementAccessUrl(serverUrl), [serverUrl]);

  const accentRgb = useMemo(() => {
    const normalized = accentColor.trim();
    const hex = /^#([0-9a-f]{6})$/i.exec(normalized);
    if (!hex) {
      return "234, 88, 12";
    }

    const value = hex[1];
    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }, [accentColor]);

  const appStyle = useMemo(
    () =>
      ({
        "--accent-rgb": accentRgb,
      }) as CSSProperties,
    [accentRgb],
  );

  return {
    tab,
    setTab,
    setupDone,
    offline,
    isLoading,
    overview,
    arrayData,
    sharesData,
    docker,
    vmsData,
    message,
    messageVariant,
    scopeInfo,
    missingScopes,
    canWriteFromServer,
    activeServerId,
    servers,
    themeMode,
    accentColor,
    renameInput,
    setRenameInput,
    apiKeyInput,
    setApiKeyInput,
    pendingAction,
    setPendingAction,
    archivingNotificationId,
    settingsOpen,
    setSettingsOpen,
    addServerOpen,
    setAddServerOpen,
    dockerSearch,
    setDockerSearch,
    vmSearch,
    setVmSearch,
    updateIntervalMs,
    setUpdateIntervalMs,
    dockerInfoOpenId,
    setDockerInfoOpenId,
    vmInfoOpenId,
    setVmInfoOpenId,
    serverName,
    setServerName,
    serverUrl,
    setServerUrl,
    apiKey,
    setApiKey,
    trustSelfSigned,
    setTrustSelfSigned,
    isSavingSetup,
    isTestingSetup,
    filteredContainers,
    filteredVms,
    canWriteControls,
    activeServer,
    selectedDocker,
    selectedVm,
    headerServerName,
    managementAccessUrl,
    appStyle,
    ...actions,
  };
}
