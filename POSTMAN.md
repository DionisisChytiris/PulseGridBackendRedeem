# Testing the PulseGrid API with Postman

Base URL (local): `http://localhost:3000`

Before testing:

1. Copy `.env.example` to `.env` and fill in `MONGODB_URI`, `ADMIN_API_KEY`, and `CODE_HASH_SECRET`.
2. Start the server: `npm run dev`
3. Confirm health works: `GET http://localhost:3000/v1/health`

---

## Important Postman settings

For every JSON POST request:

1. Open the **Body** tab
2. Choose **raw**
3. Set the right-hand dropdown to **JSON** (not Text)
4. Headers should show `Content-Type: application/json`

If you leave Body as Text, or send the wrong JSON fields, you will get a `400 VALIDATION_ERROR`.

---

## 1. Health check

- **Method:** `GET`
- **URL:** `http://localhost:3000/v1/health`
- **Auth:** none
- **Body:** none

Expected response:

```json
{
  "ok": true,
  "service": "pulsegrid-api"
}
```

---

## 2. Create a redeem code (admin)

- **Method:** `POST`
- **URL:** `http://localhost:3000/v1/admin/redeem-codes`
- **Auth:** Authorization → Bearer Token → paste your `ADMIN_API_KEY` from `.env`
- **Body (raw → JSON):**

```json
{
  "entitlement": "premium_lifetime",
  "notes": "Postman test"
}
```

Optional fields:

```json
{
  "entitlement": "premium_lifetime",
  "expiresAt": null,
  "notes": "John - beta tester"
}
```

Expected: `201` with a plaintext `code` and `redeemUrl`.

**Save the `code` and `id` from this response.**  
The plaintext code is only returned at creation time. List endpoints never return it.

### Common mistake

Do **not** send a body like this:

```json
{
  "name": "...",
  "email": "...",
  "password": "...",
  "role": "..."
}
```

That body belongs to another API. This endpoint only accepts redeem-code fields (`entitlement`, `notes`, optional `expiresAt`).

---

## 3. List redeem codes (admin)

- **Method:** `GET`
- **URL:** `http://localhost:3000/v1/admin/redeem-codes?page=1&limit=50`
- **Auth:** Bearer `ADMIN_API_KEY`
- **Body:** none

Returns status, notes, dates, etc. Does **not** return plaintext codes.

---

## 4. Redeem a code (mobile / public)

- **Method:** `POST`
- **URL:** `http://localhost:3000/v1/redeem`
- **Auth:** none
- **Body (raw → JSON):**

```json
{
  "code": "PG-XXXX-XXXX-XXXX",
  "installationId": "install_test_1"
}
```

Replace `PG-XXXX-XXXX-XXXX` with the real code from the create response.

Expected success:

```json
{
  "success": true,
  "entitlement": "premium_lifetime",
  "installationId": "install_test_1",
  "redeemedAt": "..."
}
```

Redeeming the same code again should fail with `INVALID_CODE`.

---

## 5. Revoke a code (admin)

- **Method:** `POST`
- **URL:** `http://localhost:3000/v1/admin/redeem-codes/<id>/revoke`
- **Auth:** Bearer `ADMIN_API_KEY`
- **Body:** none

Replace `<id>` with the code document `id` from create/list.

Only `ACTIVE` codes can be revoked. Already `REDEEMED` codes cannot be revoked.

---

## Quick URL cheat sheet

| Action | Method | URL |
|--------|--------|-----|
| Health | `GET` | `/v1/health` |
| Create code | `POST` | `/v1/admin/redeem-codes` |
| List codes | `GET` | `/v1/admin/redeem-codes?page=1&limit=50` |
| Revoke code | `POST` | `/v1/admin/redeem-codes/:id/revoke` |
| Redeem code | `POST` | `/v1/redeem` |

---

## Reading errors

Always open the Postman **response Body**, not only the status text.

Examples:

- `"entitlement is required"` + `debug.bodyKeys` includes `name` / `email` → wrong JSON body
- `"JSON body required..."` → Body is not raw JSON / Content-Type is wrong
- `"code"` / `"installationId"` Required → you posted to `/v1/redeem` instead of `/v1/admin/redeem-codes`
- `"UNAUTHORIZED"` → missing or wrong Bearer token on an admin route
