import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { callApi, isApiAbortError } from "../api";
import type { ArrayData, DockerData, Overview, ServerRecord, SharesData, VmsData } from "../types";

type ServerStatusResponse = {
  configured: boolean;
  baseUrl?: string;
  name?: string;
  accentColor?: string;
  trustSelfSigned?: boolean;
  scopes?: string[];
  canWrite?: boolean;
};

type UseUnraidPollingInput = {
  updateIntervalMs: number;
  reloadNonce: number;
  setSetupDone: Dispatch<SetStateAction<boolean>>;
  setOffline: Dispatch<SetStateAction<boolean>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setScopeInfo: Dispatch<SetStateAction<string[]>>;
  setCanWriteFromServer: Dispatch<SetStateAction<boolean>>;
  setServerUrl: Dispatch<SetStateAction<string>>;
  setServerName: Dispatch<SetStateAction<string>>;
  setTrustSelfSigned: Dispatch<SetStateAction<boolean>>;
  setServers: Dispatch<SetStateAction<ServerRecord[]>>;
  setActiveServerId: Dispatch<SetStateAction<string | null>>;
  setThemeMode: Dispatch<SetStateAction<"dark" | "light">>;
  setAccentColor: Dispatch<SetStateAction<string>>;
  setOverview: Dispatch<SetStateAction<Overview | null>>;
  setArrayData: Dispatch<SetStateAction<ArrayData | null>>;
  setSharesData: Dispatch<SetStateAction<SharesData | null>>;
  setDocker: Dispatch<SetStateAction<DockerData | null>>;
  setVmsData: Dispatch<SetStateAction<VmsData | null>>;
  setMessage: Dispatch<SetStateAction<string>>;
};

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_POLL_DELAY_MS = 60_000;
const MAX_BACKOFF_MULTIPLIER = 8;
const HIDDEN_TAB_MULTIPLIER = 3;

function isDocumentHidden(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return document.visibilityState === "hidden";
}

function nextDelay(baseMs: number, consecutiveFailures: number): number {
  const visibilityAdjusted = isDocumentHidden()
    ? Math.min(baseMs * HIDDEN_TAB_MULTIPLIER, MAX_POLL_DELAY_MS)
    : baseMs;
  const backoff = consecutiveFailures > 0
    ? Math.min(2 ** consecutiveFailures, MAX_BACKOFF_MULTIPLIER)
    : 1;
  return Math.min(visibilityAdjusted * backoff, MAX_POLL_DELAY_MS);
}

export function useUnraidPolling(input: UseUnraidPollingInput): void {
  const isInitialLoad = useRef(true);
  const failureCountRef = useRef(0);
  const cycleRef = useRef(0);

  useEffect(() => {
    cycleRef.current = 0;
    failureCountRef.current = 0;
    let stop = false;
    let running = false;
    let rerunImmediately = false;
    let timerId: number | null = null;
    let activeController: AbortController | null = null;

    function clearTimer() {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    }

    function scheduleNext(delayMs: number) {
      if (stop) {
        return;
      }
      clearTimer();
      timerId = window.setTimeout(() => {
        void runCycle();
      }, delayMs);
    }

    async function loadStatusAndData(signal: AbortSignal, cycle: number) {
      if (isInitialLoad.current) {
        input.setIsLoading(true);
      }

      const status = await callApi<ServerStatusResponse>("/api/servers/status", {
        signal,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      if (!status.configured) {
        if (!stop) {
          input.setSetupDone(false);
          input.setIsLoading(false);
          isInitialLoad.current = false;
        }
        return;
      }

      if (!stop) {
        input.setSetupDone(true);
        input.setScopeInfo(status.scopes ?? []);
        input.setCanWriteFromServer(Boolean(status.canWrite));
        if (status.baseUrl) {
          input.setServerUrl(status.baseUrl);
        }
        if (status.name) {
          input.setServerName(status.name);
        }
        if (status.accentColor) {
          input.setAccentColor(status.accentColor);
        }
        if (typeof status.trustSelfSigned === "boolean") {
          input.setTrustSelfSigned(status.trustSelfSigned);
        }
      }

      const shouldRefreshServerList = cycle === 0 || cycle % 6 === 0;
      if (shouldRefreshServerList) {
        const [serverList, appSettings] = await Promise.all([
          callApi<{
            activeServerId: string | null;
            servers: Array<ServerRecord & { scopes: string[] }>;
          }>("/api/servers", { signal, timeoutMs: REQUEST_TIMEOUT_MS }),
          callApi<{ themeMode: "dark" | "light"; accentColor: string }>("/api/settings/app", {
            signal,
            timeoutMs: REQUEST_TIMEOUT_MS,
          }),
        ]);

        if (!stop) {
          input.setServers(serverList.servers);
          input.setActiveServerId(serverList.activeServerId);
          input.setThemeMode(appSettings.themeMode);
          const activeServerAccent = serverList.servers.find(
            (server) => server.id === serverList.activeServerId,
          )?.accentColor;
          input.setAccentColor(activeServerAccent ?? appSettings.accentColor);
        }
      }

      const hidden = isDocumentHidden();
      const settled = hidden
        ? await Promise.allSettled([
            callApi<Overview>("/api/overview", {
              signal,
              timeoutMs: REQUEST_TIMEOUT_MS,
            }),
          ])
        : await Promise.allSettled([
            callApi<Overview>("/api/overview", {
              signal,
              timeoutMs: REQUEST_TIMEOUT_MS,
            }),
            callApi<ArrayData>("/api/array", {
              signal,
              timeoutMs: REQUEST_TIMEOUT_MS,
            }),
            callApi<SharesData>("/api/shares", {
              signal,
              timeoutMs: REQUEST_TIMEOUT_MS,
            }),
            callApi<DockerData>("/api/docker", {
              signal,
              timeoutMs: REQUEST_TIMEOUT_MS,
            }),
            callApi<VmsData>("/api/vms", {
              signal,
              timeoutMs: REQUEST_TIMEOUT_MS,
            }),
          ]);

      if (!stop) {
        let successCount = 0;

        if (settled[0].status === "fulfilled") {
          input.setOverview(settled[0].value);
          successCount += 1;
        }

        if (!hidden && settled[1]?.status === "fulfilled") {
          input.setArrayData(settled[1].value);
          successCount += 1;
        }
        if (!hidden && settled[2]?.status === "fulfilled") {
          input.setSharesData(settled[2].value);
          successCount += 1;
        }
        if (!hidden && settled[3]?.status === "fulfilled") {
          input.setDocker(settled[3].value);
          successCount += 1;
        }
        if (!hidden && settled[4]?.status === "fulfilled") {
          input.setVmsData(settled[4].value);
          successCount += 1;
        }

        input.setOffline(successCount === 0);
        if (successCount === 0) {
          input.setMessage(
            "Connected server, but no data endpoints returned yet. Check API scopes and GraphQL mappings.",
          );
        }
      }
    }

    async function runCycle() {
      if (stop || running) {
        return;
      }

      running = true;
      const cycle = cycleRef.current;
      cycleRef.current += 1;
      const controller = new AbortController();
      activeController = controller;

      try {
        await loadStatusAndData(controller.signal, cycle);
        failureCountRef.current = 0;
      } catch (error) {
        if (!stop) {
          if (!isApiAbortError(error) || error.timedOut) {
            failureCountRef.current += 1;
            input.setOffline(true);
          }
        }
      } finally {
        if (!stop && isInitialLoad.current) {
          input.setIsLoading(false);
          isInitialLoad.current = false;
        }

        running = false;
        activeController = null;

        if (!stop) {
          if (rerunImmediately) {
            rerunImmediately = false;
            scheduleNext(0);
            return;
          }
          scheduleNext(nextDelay(input.updateIntervalMs, failureCountRef.current));
        }
      }
    }

    function refreshNow() {
      clearTimer();
      failureCountRef.current = 0;
      if (activeController) {
        rerunImmediately = true;
        activeController.abort();
        return;
      }
      void runCycle();
    }

    const handleVisibilityChange = () => {
      if (!isDocumentHidden()) {
        refreshNow();
      }
    };

    const handleOnline = () => {
      refreshNow();
    };

    const handleOffline = () => {
      input.setOffline(true);
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    void runCycle();

    return () => {
      stop = true;
      clearTimer();
      if (activeController) {
        activeController.abort();
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [
    input.updateIntervalMs,
    input.reloadNonce,
    input.setSetupDone,
    input.setOffline,
    input.setIsLoading,
    input.setScopeInfo,
    input.setCanWriteFromServer,
    input.setServerUrl,
    input.setServerName,
    input.setTrustSelfSigned,
    input.setServers,
    input.setActiveServerId,
    input.setThemeMode,
    input.setAccentColor,
    input.setOverview,
    input.setArrayData,
    input.setSharesData,
    input.setDocker,
    input.setVmsData,
    input.setMessage,
  ]);
}
