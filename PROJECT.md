# PulseGrid Redeem Code Backend

Express + TypeScript + MongoDB API that manages **tester redemption codes** for PulseGrid.

**Production URL:** `https://pulse-grid-backend-redeem.vercel.app`

---

## Architecture

```
React Admin Panel  ──►  /api/pulsegrid proxy  ──►  this API  ──►  MongoDB
Expo / React Native  ──────────────────────────►  this API  ──►  MongoDB
```

| Client | What it does |
|--------|----------------|
| **Admin panel** | Create, list, revoke codes (via its own server-side proxy so `ADMIN_API_KEY` stays secret) |
| **Mobile app** | Redeem a code with an installation ID |
| **This API** | Generate codes, store hashes only, atomic redeem, revoke |

Stack:

- Node.js + Express + TypeScript
- Official MongoDB driver (not Mongoose)
- Zod validation
- Deployed on Vercel as a serverless function (`api/index.ts`)
- Local dev still uses `npm run dev` → `src/server.ts`

---

## Security model (important)

1. **Never store plaintext codes** in MongoDB — only `HMAC-SHA256(normalizedCode, CODE_HASH_SECRET)`.
2. Plaintext code is returned **once** on create, then gone forever from the API’s perspective.
3. Admin routes require `Authorization: Bearer <ADMIN_API_KEY>`.
4. Redeem is public but needs a valid unused code + `installationId`.
5. Redeems are **atomic** (`findOneAndUpdate`) so two devices cannot redeem the same code.
6. Do **not** change `CODE_HASH_SECRET` after real codes exist — old hashes become unverifiable.

Normalization before hash:

- trim
- uppercase
- remove spaces and hyphens

So `pg-7k4m-x92q-abcd` ≡ `PG-7K4M-X92Q-ABCD`.

---

## Project structure

```
api/index.ts                 Vercel serverless entry (exports request handler)
src/
  server.ts                  Local server (app.listen)
  app.ts                     Express app + CORS + Mongo middleware
  config/env.ts              Env validation (Zod)
  db/mongodb.ts              Mongo connection + indexes
  middleware/
    adminAuth.ts             Bearer ADMIN_API_KEY check
    errorHandler.ts          JSON errors
  routes/
    health.ts                GET /v1/health
    adminRedeemCodes.ts      Admin create / list / revoke
    redeem.ts                POST /v1/redeem
  services/
    redeemCodeService.ts     Business logic (generate, hash, redeem)
  types/redeemCode.ts        Shared types
vercel.json                  Rewrites all traffic → /api
.env.example                 Env template (never commit .env)
POSTMAN.md                   Postman / PowerShell testing guide
VERCEL.md                    Deploy notes
```

---

## Environment variables

Copy `.env.example` → `.env` for local use.

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | Yes | Atlas / Mongo connection string |
| `MONGODB_DB_NAME` | Yes | Usually `pulsegrid` |
| `ADMIN_API_KEY` | Yes | Admin Bearer token (min 16 chars) |
| `CODE_HASH_SECRET` | Yes | HMAC secret (min 32 chars; keep stable) |
| `REDEEM_BASE_URL` | No | Used to build `redeemUrl` (default `https://pulsegrid.app/redeem`) |
| `CORS_ORIGIN` | No | Comma-separated allowed origins |
| `NODE_ENV` | Recommended on Vercel | Set `production` |
| `PORT` | Local only | Default `3000` — **do not set on Vercel** |

### Vercel (this backend project)

Set the same secrets in the Vercel dashboard. Delete empty `PORT` if present.

### Admin panel (separate project)

The admin panel should **not** put `ADMIN_API_KEY` in `VITE_*`.  
It uses a server proxy with:

- `PULSEGRID_API_URL=https://pulse-grid-backend-redeem.vercel.app`
- `ADMIN_API_KEY=<same key>`

---

## MongoDB

Collection: `redeem_codes`

Example document (no plaintext `code` field):

```json
{
  "codeHash": "...",
  "entitlement": "premium_lifetime",
  "status": "ACTIVE",
  "installationId": null,
  "createdAt": "...",
  "redeemedAt": null,
  "expiresAt": null,
  "revokedAt": null,
  "notes": "Beta tester"
}
```

Statuses: `ACTIVE` → `REDEEMED` or `REVOKED`

Indexes (created on connect):

- unique on `codeHash`
- `status`
- `createdAt`

Atlas Network Access must allow Vercel (`0.0.0.0/0` or Atlas’s Vercel integration).

---

## API endpoints

Base (prod): `https://pulse-grid-backend-redeem.vercel.app`  
Base (local): `http://localhost:3000`

### `GET /v1/health` — public

```json
{ "ok": true, "service": "pulsegrid-api" }
```

### `POST /v1/admin/redeem-codes` — admin

Headers: `Authorization: Bearer <ADMIN_API_KEY>`

```json
{
  "entitlement": "premium_lifetime",
  "expiresAt": null,
  "notes": "John - beta tester"
}
```

Returns plaintext `code` + `redeemUrl` **once**.

### `GET /v1/admin/redeem-codes?page=1&limit=50` — admin

Lists codes **without** plaintext. Shows status, dates, notes, `installationId`, etc.

### `POST /v1/admin/redeem-codes/:id/revoke` — admin

`ACTIVE` → `REVOKED`. Cannot revoke a redeemed code.

### `POST /v1/redeem` — public (mobile app)

```json
{
  "code": "PG-XXXX-XXXX-XXXX",
  "installationId": "installation_abc"
}
```

Success:

```json
{
  "success": true,
  "entitlement": "premium_lifetime",
  "installationId": "installation_abc",
  "redeemedAt": "..."
}
```

Failure (invalid / used / revoked / expired): `400` with `INVALID_CODE`.

**Both `code` and `installationId` are required.**

---

## Code format

Example: `PG-7K4M-X92Q-ABCD`

- Prefix `PG`
- Cryptographically random segments
- Alphabet avoids confusing characters (no `O`/`0`, `I`/`1`)

---

## Local development

```bash
npm install
cp .env.example .env   # then fill secrets
npm run dev            # http://localhost:3000
```

Other scripts:

```bash
npm run build   # tsc → dist/
npm start       # node dist/server.js
```

See `POSTMAN.md` for Postman / PowerShell examples.

---

## Deploy (Vercel)

See `VERCEL.md` for full steps.

Summary:

1. Push this repo to GitHub  
2. Import in Vercel  
3. Set env vars (no `PORT`)  
4. Deploy  
5. Test: `GET https://pulse-grid-backend-redeem.vercel.app/v1/health`

Local entry: `src/server.ts`  
Vercel entry: `api/index.ts` (handler wrapping Express)

---

## Wiring clients

### Admin panel

- Calls `/api/pulsegrid/...` on its own origin  
- Proxy forwards to this backend with `ADMIN_API_KEY`  
- Browser only sends portal `admin_token`, never the PulseGrid key  

### Mobile app

- Must call **this** production URL (or local when developing)  
- `POST /v1/redeem` with real user/scanned code — **not** a hardcoded `PG-TEST`  
- Provide a stable `installationId` per install  

---

## Common pitfalls

| Symptom | Likely cause |
|---------|----------------|
| `UNAUTHORIZED` on admin routes | Missing/wrong Bearer `ADMIN_API_KEY` |
| `entitlement is required` / wrong `bodyKeys` | Postman body is leftover user JSON (`name`/`email`/…) |
| `code` / `installationId` Required | Hit `/v1/redeem` without both fields |
| Redeem always fails | App still using hardcoded `PG-TEST` or wrong base URL |
| Create works, redeem fails after secret change | `CODE_HASH_SECRET` rotated — old hashes invalid |
| Vercel `PORT ... greater than 0` | Empty `PORT` env var — delete it on Vercel |
| List has no plaintext codes | By design — only create response has `code` |

---

## Related docs

- `POSTMAN.md` — how to test endpoints  
- `VERCEL.md` — deployment checklist  
- `.env.example` — required variables  

---

## What this project is not

- Not the React admin UI  
- Not the Expo mobile app  
- Not QR image generation (API only returns `redeemUrl` for the admin to turn into a QR later)
