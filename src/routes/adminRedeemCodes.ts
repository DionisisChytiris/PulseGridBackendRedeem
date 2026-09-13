import { Router } from "express";
import { z } from "zod";
import { adminAuth } from "../middleware/adminAuth";
import { AppError } from "../middleware/errorHandler";
import {
  createRedeemCode,
  listRedeemCodes,
  revokeRedeemCode,
} from "../services/redeemCodeService";

export const adminRedeemCodesRouter = Router();

adminRedeemCodesRouter.use(adminAuth);

const createBodySchema = z.object({
  // preprocess + string-first so a missing field says "required" instead of a misleading literal error
  entitlement: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z
      .string({
        required_error: "entitlement is required",
        invalid_type_error: "entitlement must be a string",
      })
      .pipe(z.literal("premium_lifetime")),
  ),
  expiresAt: z
    .union([z.string().datetime(), z.null()])
    .optional()
    .default(null),
  notes: z.union([z.string().max(500), z.null()]).optional().default(null),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

/**
 * express.json() only populates req.body when Content-Type is application/json.
 * Without that, Zod sees {} and reports a misleading error on entitlement.
 */
function requireJsonObjectBody(body: unknown): asserts body is Record<string, unknown> {
  if (
    body == null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body as object).length === 0
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "JSON body required. In Postman use Body → raw → JSON (Content-Type: application/json).",
    );
  }
}

adminRedeemCodesRouter.post("/", async (req, res, next) => {
  try {
    requireJsonObjectBody(req.body);

    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: parsed.error.flatten().fieldErrors,
        // Helps debug Postman mistakes (wrong key, Text mode, typos) without exposing secrets.
        debug: {
          bodyKeys: Object.keys(req.body),
          receivedEntitlement: req.body.entitlement ?? null,
        },
      });
      return;
    }

    const result = await createRedeemCode({
      entitlement: parsed.data.entitlement,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      notes: parsed.data.notes,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

adminRedeemCodesRouter.get("/", async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await listRedeemCodes(query.page, query.limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

adminRedeemCodesRouter.post("/:id/revoke", async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const result = await revokeRedeemCode(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
