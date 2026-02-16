import type { NextFunction, Request, Response } from "express";

const requestsByIp = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const LIMIT = 20;
let lastCleanupAt = Date.now();

function cleanup(now: number): void {
  if (now - lastCleanupAt < WINDOW_MS) {
    return;
  }
  for (const [key, timestamps] of requestsByIp.entries()) {
    const recent = timestamps.filter((item) => now - item < WINDOW_MS);
    if (recent.length === 0) {
      requestsByIp.delete(key);
    } else {
      requestsByIp.set(key, recent);
    }
  }
  lastCleanupAt = now;
}

export function writeRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  cleanup(now);
  const key = req.ip ?? "unknown";
  const existing = requestsByIp.get(key) ?? [];
  const recent = existing.filter((item) => now - item < WINDOW_MS);
  if (recent.length >= LIMIT) {
    res.status(429).json({ error: "Write rate limit exceeded." });
    return;
  }
  recent.push(now);
  requestsByIp.set(key, recent);
  next();
}
