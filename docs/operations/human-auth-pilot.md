# Human authentication pilot contract

Status: code-complete on `feat/human-auth-private-access`; production activation is pending. Auth0 authenticates only. PostgreSQL remains the authority for users, tenant memberships, platform grants and roles.

## Runtime configuration

The API enables human authentication only when every required variable below is present. A partial group makes startup fail with `HUMAN_AUTH_CONFIG_INCOMPLETE`.

| Variable | Secret | Exact requirement |
|---|---:|---|
| `WORKSHOP_ORIGIN` | no | `https://app.bibendia.com` |
| `PLATFORM_ORIGIN` | no | `https://admin.bibendia.com` |
| `OIDC_ISSUER` | no | Auth0 tenant origin, for example `https://TENANT.eu.auth0.com`; normalized with one trailing slash |
| `OIDC_WORKSHOP_CLIENT_ID` | no | client ID of the Workshop Regular Web Application |
| `OIDC_WORKSHOP_CLIENT_SECRET` | yes | client secret of the Workshop application |
| `OIDC_PLATFORM_CLIENT_ID` | no | client ID of the Platform Regular Web Application |
| `OIDC_PLATFORM_CLIENT_SECRET` | yes | client secret of the Platform application |
| `HUMAN_SESSION_KEY` | yes | exactly 32 random bytes encoded as base64url; independent of all OIDC secrets |
| `HUMAN_SESSION_TTL_SECONDS` | no | integer 300–86400; default `28800` |
| `HUMAN_AUTH_PILOT_TENANT_ID` | no | UUID of the existing Jarrisons tenant |

The normal API variables remain required, including `API_DATABASE_URL`, PII keyrings, `APP_VERSION`, `APP_COMMIT_SHA` and the exact proxy/origin configuration. Secrets are injected at runtime and are never build arguments or frontend variables.

## Auth0 applications and URLs

Create two separate **Regular Web Applications**. Public sign-up must be disabled on their database connection. Pilot users are created explicitly; a new Auth0 identity cannot self-provision BibendIA authority.

Workshop application:

- login entry: `https://app.bibendia.com/auth/login`
- allowed callback: `https://app.bibendia.com/auth/callback`
- allowed logout return: `https://app.bibendia.com`
- allowed web origin: `https://app.bibendia.com`

Platform application:

- login entry: `https://admin.bibendia.com/auth/login`
- allowed callback: `https://admin.bibendia.com/auth/callback`
- allowed logout return: `https://admin.bibendia.com`
- allowed web origin: `https://admin.bibendia.com`

Both use Authorization Code Flow with PKCE. The callback audience is selected from the exact request hostname, never from request data. Caddy serves each frontend and proxies same-origin `/auth/*` and `/v1/*` to the API. Cookies have no `Domain` attribute.

Deploy `server/provisioning/auth0-post-login-action.js` in the Auth0 Post Login flow with Action secret `PLATFORM_CLIENT_ID` equal to `OIDC_PLATFORM_CLIENT_ID`. The Action:

1. fails closed if that secret is absent;
2. forces MFA on every Platform login with browser remembrance disabled;
3. reads only `app_metadata.bibendia_user_id`;
4. emits only the ID-token claim `https://bibendia.com/user_id`;
5. never emits roles, tenant IDs, memberships or grants.

The API independently requires MFA evidence in the verified Platform ID token and session.

## Explicit pilot provisioning

Do not run provisioning until the three Auth0 `sub` values and the existing internal UUIDs have been verified. Required one-time inputs are:

- `MIGRATOR_DATABASE_URL`
- `OIDC_ISSUER`
- `HUMAN_AUTH_PILOT_TENANT_ID`
- `PILOT_AKETZA_USER_ID`, `PILOT_AKETZA_OIDC_SUBJECT`
- `PILOT_ZAQ_USER_ID`, `PILOT_ZAQ_OIDC_SUBJECT`
- `PILOT_ARKAITZ_USER_ID`, `PILOT_ARKAITZ_OIDC_SUBJECT`

Run the exact reviewed artifact with `npm run provision:pilot-human-access`. The transaction is idempotent and produces:

- Aketza: active user, exact external identity, global `PLATFORM_ADMIN` grant;
- ZaQ: active user, exact external identity, Jarrisons-scoped `PLATFORM_OPERATOR` grant;
- Arkaitz: active user, exact external identity, active Jarrisons `OWNER` membership.

The command aborts on an `issuer + subject` conflict. Its output gives the `bibendia_user_id` value to place in each Auth0 user's `app_metadata`; it never prints credentials. Review the transaction result before enabling traffic.

## HTTP and session contract

All endpoints are same-origin:

- `GET /auth/login`: sets a 10-minute encrypted OIDC transaction cookie and redirects to Auth0.
- `GET /auth/callback?code=...&state=...`: verifies transaction, code, PKCE, nonce, issuer, client audience, internal user claim, identity and current PostgreSQL authority. It emits a session cookie only after all checks pass.
- `POST /auth/logout`: expires only the current surface cookies and returns `{ "ok": true, "logoutUrl": "..." }`; the frontend navigates to that Auth0 logout URL.
- `GET /auth/session`: returns `401 { "error": "AUTHENTICATION_REQUIRED" }` without a valid current-surface session.

Successful `GET /auth/session` response:

```json
{
  "principal": {
    "kind": "workshop_user",
    "audience": "workshop",
    "userId": "00000000-0000-4000-8000-000000000000",
    "assurance": "single_factor"
  },
  "tenantIds": ["JARRISONS_TENANT_UUID"],
  "expiresAt": "2026-09-29T03:00:00.000Z"
}
```

For Admin, `kind` is `platform_user`, `audience` is `platform` and `assurance` must be `mfa`. `tenantIds` contains the configured Jarrisons pilot tenant for both a matching tenant-scoped grant and a valid global grant. The frontend must not infer roles from this response; protected `/v1/workshop/*` and `/v1/platform/*` APIs remain authoritative.

Cookies are `__Host-bibendia_workshop` and `__Host-bibendia_platform`, with `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain`, and separate authenticated encryption purposes. Every authenticated request rechecks the active user, exact `issuer + subject`, and active membership or grant in PostgreSQL. Suspension therefore revokes access on the next request.

## Post-activation smoke

Use explicitly identified synthetic or pilot accounts and preserve Audit evidence. Expected outcomes:

1. Arkaitz logs in at `app.` and reads Jarrisons: `200`, `workshop_user`.
2. Arkaitz requests a different tenant UUID: `403`, no cross-tenant data.
3. ZaQ logs in at `admin.` with MFA and operates Jarrisons: `200`, `platform_user`.
4. ZaQ requests a different tenant: `403`.
5. Aketza logs in at `admin.` with MFA and exercises an authorized global Platform operation: success according to `PLATFORM_ADMIN` capabilities.
6. Send the Workshop cookie to Admin and the Platform cookie to Workshop: both `401`.
7. Logout each surface, replay after session expiry, suspend the user, suspend Arkaitz's membership, and suspend each Platform grant in isolated cases: the next protected request is `401` or `403` as appropriate and creates no new authority.
8. Restore only the explicitly approved pilot records after the suspension cases; do not alter another tenant.

ElevenLabs, schema 014 and Suppliers are outside this activation contract.
