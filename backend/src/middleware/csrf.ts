import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";

const cookieName = "unpwa_csrf";
const headerName = "x-csrf-token";

export function ensureCsrfCookie(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies[cookieName]) {
    const forwardedProto = req.header("x-forwarded-proto");
    const isSecure = req.secure || forwardedProto === "https";
    res.cookie(cookieName, crypto.randomUUID(), {
      httpOnly: false,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
    });
  }
  next();
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const cookieToken = req.cookies[cookieName];
  const headerToken = req.header(headerName);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ error: "CSRF validation failed." });
    return;
  }
  next();
}
