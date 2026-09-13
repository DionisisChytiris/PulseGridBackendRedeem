import { createApp } from "./app";
import { env } from "./config/env";
import { connectMongo, closeMongo } from "./db/mongodb";

async function main(): Promise<void> {
  await connectMongo();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`PulseGrid API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await closeMongo();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start server:", err instanceof Error ? err.message : err);
  process.exit(1);
});
