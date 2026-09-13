import type { IncomingMessage, ServerResponse } from "http";
import type { Express } from "express";
import { createApp } from "../src/app";

/**
 * Vercel serverless entry.
 * Export a request handler function (required by Vercel), not only the Express app instance.
 * Local development still uses `npm run dev` → src/server.ts (app.listen).
 */
let app: Express | null = null;

function getApp(): Express {
  if (!app) {
    app = createApp();
  }
  return app;
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  getApp()(req, res);
}
