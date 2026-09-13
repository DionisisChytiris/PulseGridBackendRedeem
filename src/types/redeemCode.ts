import { ObjectId } from "mongodb";

/** Supported entitlements. Add new values here as product needs grow. */
export type Entitlement = "premium_lifetime";

export type RedeemCodeStatus = "ACTIVE" | "REDEEMED" | "REVOKED";

/**
 * MongoDB document for a redemption code.
 * SECURITY: Never store the plaintext code — only codeHash (HMAC-SHA256).
 */
export interface RedeemCodeDocument {
  _id: ObjectId;
  codeHash: string;
  entitlement: Entitlement;
  status: RedeemCodeStatus;
  installationId: string | null;
  createdAt: Date;
  redeemedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  notes: string | null;
}

/** Safe fields returned by admin list/revoke (never includes plaintext code). */
export interface RedeemCodePublicView {
  id: string;
  entitlement: Entitlement;
  status: RedeemCodeStatus;
  installationId: string | null;
  createdAt: string;
  redeemedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  notes: string | null;
}

/** Admin create response — plaintext code returned only at generation time. */
export interface RedeemCodeCreateResponse extends RedeemCodePublicView {
  code: string;
  redeemUrl: string;
}

export interface RedeemSuccessResponse {
  success: true;
  entitlement: Entitlement;
  installationId: string;
  redeemedAt: string;
}
