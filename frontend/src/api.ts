const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

export async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiBase ? `${apiBase}${path}` : path;
  const headers = new Headers(init?.headers ?? undefined);
  const hasBody = init?.body !== undefined && init.body !== null;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers,
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
}

export function getCsrfFromCookie(): string | undefined {
  const chunk = document.cookie
    .split("; ")
    .find((item) => item.startsWith("unpwa_csrf="));
  return chunk?.split("=")[1];
}
