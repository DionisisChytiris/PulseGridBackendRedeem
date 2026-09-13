import { createApp } from "../src/app";

/**
 * Vercel serverless entry.
 * Local development still uses `npm run dev` → src/server.ts (app.listen).
 * Do not call app.listen() here.
 */
export default createApp();
