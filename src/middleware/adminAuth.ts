import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

/**
 * Simple V1 admin auth via static API key.
 * Expects: Authorization: Bearer <ADMIN_API_KEY>
 * Replace with proper admin auth later.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Missing or invalid Authorization header.",
    });
    return;
  }

  const providedKey = header.slice("Bearer ".length).trim();

  if (!secureCompare(providedKey, env.ADMIN_API_KEY)) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Invalid API key.",
    });
    return;
  }

  next();
}

/** Constant-time string comparison to reduce timing-attack risk. */
function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
