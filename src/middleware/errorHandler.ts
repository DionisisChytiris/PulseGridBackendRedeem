import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "The requested resource was not found.",
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Log server errors without leaking secrets or stack traces to clients in production.
  console.error("Unhandled error:", err instanceof Error ? err.message : err);

  const isDev = env.NODE_ENV === "development";
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: isDev && err instanceof Error
      ? err.message
      : "An unexpected error occurred.",
  });
}
