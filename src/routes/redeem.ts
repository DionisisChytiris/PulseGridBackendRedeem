import { Router } from "express";
import { z } from "zod";
import { redeemCode } from "../services/redeemCodeService";

export const redeemRouter = Router();

const redeemBodySchema = z.object({
  code: z.string().min(1).max(64),
  installationId: z.string().min(1).max(256),
});

redeemRouter.post("/", async (req, res, next) => {
  try {
    const body = redeemBodySchema.parse(req.body);
    // Do not log plaintext codes.
    const result = await redeemCode(body.code, body.installationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
