import { z } from "zod";
import dotenv from "dotenv";

// Loads .env locally. On Vercel, env vars come from the project settings.
dotenv.config();

/** Vercel often sets empty-string env vars; treat those as "unset". */
const emptyToUndefined = (value: unknown): unknown =>
  value === "" || value === null || value === undefined ? undefined : value;

const envSchema = z.object({
  NODE_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(["development", "production", "test"]).default("development"),
  ),
  // Local only. On Vercel, leave PORT unset (or delete it) — serverless ignores it.
  PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(3000),
  ),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("pulsegrid"),
  ),
  ADMIN_API_KEY: z.string().min(16, "ADMIN_API_KEY must be at least 16 characters"),
  CODE_HASH_SECRET: z.string().min(32, "CODE_HASH_SECRET must be at least 32 characters"),
  REDEEM_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default("https://pulsegrid.app/redeem"),
  ),
  /**
   * Comma-separated list of allowed origins.
   * Example: http://localhost:5173,https://your-admin.vercel.app
   */
  CORS_ORIGIN: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("http://localhost:5173"),
  ),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Lazy validation so Vercel builds do not crash before runtime env is available.
 * Throws (does not process.exit) — safer in serverless.
 */
export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment variables: ${details}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Convenience proxy — same `env.X` usage as before. */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    const value = getEnv()[prop as keyof Env];
    return value;
  },
});

export function getCorsOrigins(): string[] {
  return env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
}
