import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().min(1).default("pulsegrid"),
  ADMIN_API_KEY: z.string().min(16, "ADMIN_API_KEY must be at least 16 characters"),
  CODE_HASH_SECRET: z.string().min(32, "CODE_HASH_SECRET must be at least 32 characters"),
  REDEEM_BASE_URL: z.string().url().default("https://pulsegrid.app/redeem"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
