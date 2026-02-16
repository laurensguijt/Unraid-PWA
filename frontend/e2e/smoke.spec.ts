import { expect, test } from "@playwright/test";

test("smoke: setup, open dashboard, request container restart", async ({ page }) => {
  await page.route("**/api/servers/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        id: "srv-1",
        name: "Primary server",
        baseUrl: "http://tower.local",
        scopes: ["array", "docker", "vms", "info", "vms:create_any", "vms:update_any", "docker:update_any"],
        canWrite: true,
      }),
    });
  });
  await page.route("**/api/servers", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        activeServerId: "srv-1",
        servers: [{ id: "srv-1", name: "Primary server", baseUrl: "http://tower.local", createdAt: "2026-01-01T00:00:00.000Z" }],
      }),
    });
  });
  await page.route("**/api/settings/app", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ themeMode: "dark", accentColor: "orange" }),
    });
  });
  await page.route("**/api/overview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cpuPercent: 18,
        cpuModel: "Intel Core i5",
        memoryPercent: 46,
        memoryUsed: "28 GB",
        memoryTotal: "62 GB",
        notifications: [],
      }),
    });
  });
  await page.route("**/api/array", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ devices: [] }),
    });
  });
  await page.route("**/api/shares", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ shares: [] }),
    });
  });
  await page.route("**/api/docker", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: { running: 1, stopped: 0 },
        containers: [
          {
            id: "apache",
            name: "ApacheGuacamole",
            image: "jasonbean/guacamole",
            network: "bridge",
            endpoint: "0.0.0.0:1111",
            status: "running",
          },
        ],
      }),
    });
  });
  await page.route("**/api/docker/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/vms", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ vms: [] }),
    });
  });

  await page.goto("/");

  // Dashboard visible
  await expect(page.getByRole("heading", { name: /Unraid/i }).first()).toBeVisible();
  await page.getByRole("button", { name: /docker/i }).first().click();
  await expect(page.getByText("Docker Overview")).toBeVisible();

  // Trigger restart action with confirmation
  await page.getByRole("button", { name: "Restart" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
});
