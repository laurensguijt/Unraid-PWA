const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

type ApiRequestInit = RequestInit & {
  timeoutMs?: number;
};

export class ApiAbortError extends Error {
  readonly timedOut: boolean;

  constructor(message: string, timedOut: boolean) {
    super(message);
    this.name = "ApiAbortError";
    this.timedOut = timedOut;
  }
}

export function isApiAbortError(error: unknown): error is ApiAbortError {
  return error instanceof ApiAbortError;
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }
  return error instanceof Error && error.name === "AbortError";
}

function combineSignals(signals: AbortSignal[]): {
  signal?: AbortSignal;
  cleanup: () => void;
} {
  if (signals.length === 0) {
    return {
      cleanup: () => {},
    };
  }

  if (signals.length === 1) {
    return {
      signal: signals[0],
      cleanup: () => {},
    };
  }

  const controller = new AbortController();
  const listeners = signals.map((signal) => {
    const onAbort = () => {
      controller.abort(signal.reason);
    };
    if (signal.aborted) {
      onAbort();
      return { signal, onAbort, attached: false };
    }
    signal.addEventListener("abort", onAbort, { once: true });
    return { signal, onAbort, attached: true };
  });

  return {
    signal: controller.signal,
    cleanup: () => {
      listeners.forEach((item) => {
        if (item.attached) {
          item.signal.removeEventListener("abort", item.onAbort);
        }
      });
    },
  };
}

export async function callApi<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const url = apiBase ? `${apiBase}${path}` : path;
  const headers = new Headers(init?.headers ?? undefined);
  const hasBody = init?.body !== undefined && init.body !== null;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const timeoutMs = Number.isFinite(init?.timeoutMs)
    ? Math.max(0, Number(init?.timeoutMs))
    : DEFAULT_REQUEST_TIMEOUT_MS;
  const timeoutController = timeoutMs > 0 ? new AbortController() : null;
  let timeoutId: number | undefined;
  let didTimeout = false;
  if (timeoutController) {
    timeoutId = window.setTimeout(() => {
      didTimeout = true;
      timeoutController.abort();
    }, timeoutMs);
  }

  const { signal, cleanup } = combineSignals(
    [init?.signal, timeoutController?.signal].filter((value): value is AbortSignal => Boolean(value)),
  );

  try {
    const response = await fetch(url, {
      ...init,
      credentials: "include",
      headers,
      signal,
    });
    if (!response.ok) {
      const body = await response.text();
      let parsedMessage = "";
      if (body) {
        try {
          const parsed = JSON.parse(body) as { error?: string; detail?: string };
          parsedMessage = [parsed.error, parsed.detail].filter(Boolean).join(": ");
        } catch {
          parsedMessage = "";
        }
      }
      throw new Error(parsedMessage || body || `${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (isAbortLikeError(error)) {
      if (didTimeout) {
        throw new ApiAbortError(`Request timed out after ${timeoutMs}ms`, true);
      }
      throw new ApiAbortError("Request cancelled", false);
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    cleanup();
  }
}

export function getCsrfFromCookie(): string | undefined {
  const chunk = document.cookie
    .split("; ")
    .find((item) => item.startsWith("unpwa_csrf="));
  return chunk?.split("=")[1];
}
