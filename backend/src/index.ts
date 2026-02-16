import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureCsrfCookie } from "./middleware/csrf.js";
import { apiRouter } from "./routes/api.js";

const app = express();
const port = Number(process.env.UNRAID_BFF_PORT ?? 3001);
const allowedOrigins = (process.env.UNRAID_BFF_ORIGIN ?? "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const allowAnyOrigin = allowedOrigins.includes("*");

app.disable("x-powered-by");
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowAnyOrigin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(ensureCsrfCookie);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "unraid-pwa-bff" });
});

app.use("/api", apiRouter);

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
