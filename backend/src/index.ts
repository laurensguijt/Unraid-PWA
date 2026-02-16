import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextFunction, Request, Response } from "express";
import { ensureCsrfCookie } from "./middleware/csrf.js";
import { apiRouter } from "./routes/api.js";

const app = express();
const port = Number(process.env.UNRAID_BFF_PORT ?? 3001);
const allowedOrigins = (process.env.UNRAID_BFF_ORIGIN ?? "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const normalizedAllowedOrigins = new Set(allowedOrigins.map((origin) => origin.toLowerCase()));
const allowAnyOrigin = normalizedAllowedOrigins.has("*");
const trustProxyRaw = (process.env.UNRAID_BFF_TRUST_PROXY ?? "false").trim().toLowerCase();
if (trustProxyRaw === "true") {
  app.set("trust proxy", 1);
} else if (["loopback", "linklocal", "uniquelocal"].includes(trustProxyRaw)) {
  app.set("trust proxy", trustProxyRaw);
}

function getRequestHost(req: Request): string {
  const header = req.header("x-forwarded-host") ?? req.header("host") ?? "";
  return header.split(",")[0]?.trim().toLowerCase() ?? "";
}

function isSameOrigin(origin: string, req: Request): boolean {
  if (!origin) {
    return false;
  }
  try {
    const parsedOrigin = new URL(origin);
    const requestHost = getRequestHost(req);
    if (!requestHost) {
      return false;
    }
    return parsedOrigin.host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}

app.disable("x-powered-by");
app.use(
  "/api",
  cors<Request>((req, callback) => {
    const origin = req.header("origin");
    if (!origin) {
      callback(null, { origin: false });
      return;
    }

    const normalizedOrigin = origin.toLowerCase();
    if (
      allowAnyOrigin ||
      normalizedAllowedOrigins.has(normalizedOrigin) ||
      isSameOrigin(origin, req)
    ) {
      callback(null, { origin: true, credentials: true });
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(ensureCsrfCookie);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "unraid-pwa-bff" });
});

app.use("/api", apiRouter);
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api")) {
    res.status(500).json({
      error: "Internal server error",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
    return;
  }
  next(error);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../public");

app.use(express.static(frontendDistPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/health") {
    next();
    return;
  }
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Unraid PWA BFF listening on port ${port}`);
});
