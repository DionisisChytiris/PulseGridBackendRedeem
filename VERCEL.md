# Deploying PulseGrid API to Vercel

This API runs as a **Vercel serverless function** (`api/index.ts`) in production.
Locally you still use `npm run dev` (Express + `app.listen`).

## 1. MongoDB Atlas

1. Use your Atlas cluster (or create one).
2. Database Access → user with read/write.
3. Network Access → allow **`0.0.0.0/0`** (required for Vercel serverless IPs), or use Atlas’s Vercel integration if you prefer.
4. Copy the connection string into `MONGODB_URI`.

## 2. Environment variables in Vercel

Project → **Settings → Environment Variables**. Add:

| Name | Notes |
|------|--------|
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DB_NAME` | e.g. `pulsegrid` |
| `ADMIN_API_KEY` | Same value your admin panel uses (min 16 chars) |
| `CODE_HASH_SECRET` | Keep stable after you generate real codes (min 32 chars) |
| `REDEEM_BASE_URL` | e.g. `https://pulsegrid.app/redeem` |
| `CORS_ORIGIN` | Admin origin(s), comma-separated |
| `NODE_ENV` | `production` |

Do **not** set `PORT` on Vercel (or set it blank). Serverless does not use it.
If you already added an empty `PORT`, delete that variable and redeploy.

Example `CORS_ORIGIN`:

```text
http://localhost:5173,https://your-admin.vercel.app
```

Do **not** commit `.env`.

## 3. Deploy

### Option A — Vercel Dashboard

1. Import this GitHub repo in Vercel.
2. Framework Preset: **Other**
3. Build Command: leave default / empty (Vercel compiles `api/`)
4. Output Directory: leave empty
5. Add the env vars above
6. Deploy

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
vercel env pull   # optional, for local sync
vercel --prod
```

## 4. Test production

After deploy, your base URL looks like:

`https://your-project.vercel.app`

```http
GET https://your-project.vercel.app/v1/health
```

```http
POST https://your-project.vercel.app/v1/admin/redeem-codes
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json

{
  "entitlement": "premium_lifetime",
  "notes": "Vercel test"
}
```

Point your React admin panel API base URL at this Vercel domain.

## 5. How the project is wired

| File | Role |
|------|------|
| `api/index.ts` | Vercel entry — exports the Express app (no `listen`) |
| `vercel.json` | Rewrites all routes to `/api` |
| `src/server.ts` | Local only — `npm run dev` / `npm start` |
| `src/app.ts` | Shared Express app + Mongo connect middleware |

## 6. Notes / limits

- Cold starts: first request after idle may be slower (Mongo connect).
- Free hobby plans have serverless timeouts/limits — fine for this small API.
- If create/list fails after deploy, check Vercel function logs and Atlas Network Access first.
