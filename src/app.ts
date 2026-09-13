import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { healthRouter } from "./routes/health";
import { adminRedeemCodesRouter } from "./routes/adminRedeemCodes";
import { redeemRouter } from "./routes/redeem";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
    }),
  );
  app.use(express.json());

  // Simple request logging — never log Authorization headers or body codes.
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  app.use("/v1/health", healthRouter);
  app.use("/v1/admin/redeem-codes", adminRedeemCodesRouter);
  app.use("/v1/redeem", redeemRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
