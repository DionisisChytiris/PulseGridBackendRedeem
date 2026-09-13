import { createHmac, randomBytes } from "crypto";
import { ObjectId, MongoServerError } from "mongodb";
import { env } from "../config/env";
import { getRedeemCodesCollection } from "../db/mongodb";
import { AppError } from "../middleware/errorHandler";
import type {
  Entitlement,
  RedeemCodeCreateResponse,
  RedeemCodeDocument,
  RedeemCodePublicView,
  RedeemSuccessResponse,
} from "../types/redeemCode";

/** Alphabet avoids O/0 and I/1 to reduce typing confusion. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PREFIX = "PG";
const CODE_SEGMENT_LENGTH = 4;
const CODE_SEGMENT_COUNT = 3;
/** Normalized form is PREFIX + body, e.g. PG7K4MX92QABCD (hyphens removed). */
const NORMALIZED_CODE_LENGTH =
  CODE_PREFIX.length + CODE_SEGMENT_LENGTH * CODE_SEGMENT_COUNT;
const MAX_GENERATE_RETRIES = 5;

export interface CreateRedeemCodeInput {
  entitlement: Entitlement;
  expiresAt: Date | null;
  notes: string | null;
}

export interface ListRedeemCodesResult {
  items: RedeemCodePublicView[];
  page: number;
  limit: number;
  total: number;
}

/**
 * Normalize a redemption code before hashing or comparison.
 * trim → uppercase → strip spaces and hyphens
 */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Format normalized body as PG-XXXX-XXXX-XXXX for display / redeemUrl.
 */
export function formatCode(normalizedBody: string): string {
  const segments: string[] = [];
  for (let i = 0; i < CODE_SEGMENT_COUNT; i++) {
    const start = i * CODE_SEGMENT_LENGTH;
    segments.push(normalizedBody.slice(start, start + CODE_SEGMENT_LENGTH));
  }
  return `${CODE_PREFIX}-${segments.join("-")}`;
}

/**
 * SECURITY: Hash codes with HMAC-SHA256 using CODE_HASH_SECRET.
 * Plaintext codes are never stored in MongoDB.
 */
export function hashCode(normalizedCode: string): string {
  return createHmac("sha256", env.CODE_HASH_SECRET)
    .update(normalizedCode)
    .digest("hex");
}

/** Cryptographically secure random code body (no Math.random). */
function generateCodeBody(): string {
  const bytes = randomBytes(CODE_SEGMENT_LENGTH * CODE_SEGMENT_COUNT);
  let body = "";
  for (let i = 0; i < bytes.length; i++) {
    body += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return body;
}

function toPublicView(doc: RedeemCodeDocument): RedeemCodePublicView {
  return {
    id: doc._id.toHexString(),
    entitlement: doc.entitlement,
    status: doc.status,
    installationId: doc.installationId,
    createdAt: doc.createdAt.toISOString(),
    redeemedAt: doc.redeemedAt ? doc.redeemedAt.toISOString() : null,
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
    revokedAt: doc.revokedAt ? doc.revokedAt.toISOString() : null,
    notes: doc.notes,
  };
}

export async function createRedeemCode(
  input: CreateRedeemCodeInput,
): Promise<RedeemCodeCreateResponse> {
  const collection = getRedeemCodesCollection();

  for (let attempt = 0; attempt < MAX_GENERATE_RETRIES; attempt++) {
    const body = generateCodeBody();
    const plaintext = formatCode(body);
    // Hash the normalized form (without hyphens) so typed variants match.
    const normalized = normalizeCode(plaintext);
    const codeHash = hashCode(normalized);

    const now = new Date();
    const doc: RedeemCodeDocument = {
      _id: new ObjectId(),
      codeHash,
      entitlement: input.entitlement,
      status: "ACTIVE",
      installationId: null,
      createdAt: now,
      redeemedAt: null,
      expiresAt: input.expiresAt,
      revokedAt: null,
      notes: input.notes,
    };

    try {
      await collection.insertOne(doc);

      // Plaintext code is returned once here and never persisted.
      return {
        ...toPublicView(doc),
        code: plaintext,
        redeemUrl: `${env.REDEEM_BASE_URL.replace(/\/$/, "")}/${plaintext}`,
      };
    } catch (err) {
      // Unique index collision on codeHash — generate a new code and retry.
      if (err instanceof MongoServerError && err.code === 11000) {
        continue;
      }
      throw err;
    }
  }

  throw new AppError(
    500,
    "CODE_GENERATION_FAILED",
    "Unable to generate a unique redemption code. Please try again.",
  );
}

export async function listRedeemCodes(
  page: number,
  limit: number,
): Promise<ListRedeemCodesResult> {
  const collection = getRedeemCodesCollection();
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    collection.countDocuments(),
    collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  return {
    items: docs.map(toPublicView),
    page,
    limit,
    total,
  };
}

export async function revokeRedeemCode(id: string): Promise<RedeemCodePublicView> {
  if (!ObjectId.isValid(id)) {
    throw new AppError(400, "INVALID_ID", "Invalid redeem code id.");
  }

  const collection = getRedeemCodesCollection();
  const objectId = new ObjectId(id);
  const existing = await collection.findOne({ _id: objectId });

  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Redeem code not found.");
  }

  if (existing.status === "REDEEMED") {
    throw new AppError(
      400,
      "ALREADY_REDEEMED",
      "A redeemed code cannot be revoked.",
    );
  }

  if (existing.status === "REVOKED") {
    return toPublicView(existing);
  }

  const now = new Date();
  const result = await collection.findOneAndUpdate(
    { _id: objectId, status: "ACTIVE" },
    { $set: { status: "REVOKED", revokedAt: now } },
    { returnDocument: "after" },
  );

  if (!result) {
    throw new AppError(
      400,
      "REVOKE_FAILED",
      "Unable to revoke this code. It may no longer be active.",
    );
  }

  return toPublicView(result);
}

/**
 * Atomically redeem a code.
 * Uses findOneAndUpdate with status=ACTIVE (+ expiry check) so concurrent
 * redeem requests cannot both succeed.
 */
export async function redeemCode(
  code: string,
  installationId: string,
): Promise<RedeemSuccessResponse> {
  const normalized = normalizeCode(code);

  if (normalized.length !== NORMALIZED_CODE_LENGTH) {
    throw new AppError(
      400,
      "INVALID_CODE",
      "The redemption code is invalid or unavailable.",
    );
  }

  const codeHash = hashCode(normalized);
  const now = new Date();
  const collection = getRedeemCodesCollection();

  // Atomic: only ACTIVE, non-expired codes match and transition to REDEEMED.
  const updated = await collection.findOneAndUpdate(
    {
      codeHash,
      status: "ACTIVE",
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    },
    {
      $set: {
        status: "REDEEMED",
        installationId,
        redeemedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    // Generic message — do not reveal whether the code exists, is revoked, etc.
    throw new AppError(
      400,
      "INVALID_CODE",
      "The redemption code is invalid or unavailable.",
    );
  }

  return {
    success: true,
    entitlement: updated.entitlement,
    installationId,
    redeemedAt: now.toISOString(),
  };
}
