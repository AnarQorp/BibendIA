# P0.2 Authentication Boundary Report

Status: boundary complete; production OIDC adapter intentionally pending IdP approval.

## Delivered

- A vendor-neutral `AuthenticationAdapter` port.
- A typed `PrincipalContext` for `workshop_user`, `platform_user` and `service`.
- Explicit audience separation: `workshop`, `platform`, `provider`, `internal`.
- Human session metadata required by future revocation and step-up: stable user/subject,
  session ID, authentication/expiry time and assurance (`single_factor` or `mfa`).
- A global Fastify authentication boundary. Every registered route must declare an auth policy.
- Production-safe default adapter that authenticates nobody.
- Exact-origin CORS configuration for Workshop and Platform origins.
- A deterministic adapter under `server/test/` only. Its constructor rejects production mode.

No password store, IdP, tenant membership lookup or provider signature implementation was added.

## Route policy

| Route | Policy |
|---|---|
| `GET /health` | explicitly public |
| `GET /v1/appointments` | Workshop audience + `workshop_user` |
| `POST /v1/voice/tools/create-appointment` | Provider audience + `service` |
| any route without policy | fail closed with `ROUTE_SECURITY_POLICY_MISSING` |

The legacy `x-tenant-id` still exists inside the authenticated Workshop handler. It is not fixed
or treated as safe by P0.2; replacing it with membership-derived context is P0.3.

## Trust boundaries

1. The HTTP request supplies credentials, never a trusted principal.
2. The authentication adapter validates credentials for one expected audience and emits a
   `PrincipalContext` or no principal.
3. The global boundary independently checks audience and principal kind.
4. Handlers receive only the validated context. Tenant authorization remains a separate P0.3
   decision and must occur before a tenant transaction.
5. Adapter errors are logged generically; tokens and provider errors are not logged.

## Fail-closed behavior

- Missing credentials: `401 AUTHENTICATION_REQUIRED`.
- Invalid/adapter error: same generic 401.
- Valid principal for a wrong audience/kind: `403 PRINCIPAL_NOT_ALLOWED`.
- Missing route policy: 500 and no handler execution.
- No production adapter configured: all private routes return 401.

## Workshop versus Platform

The boundary requires distinct audiences. A Workshop principal cannot enter a Platform route and
vice versa. The future OIDC implementation must use separate clients/audiences and host-only
session cookies. Platform authentication will require MFA; `assurance` is already represented.

## Provider ingress

P0.2 reserves the `service` principal and `provider` audience but does not pretend bearer test
tokens are provider authentication. Twilio/ElevenLabs signature verification, raw-body handling,
freshness/replay protection and DID binding remain P0.4.

## Tests

Positive:

- explicitly public route;
- Workshop principal on Workshop audience;
- Platform principal on Platform audience;
- service principal on Provider audience;
- authenticated provider reaches domain validation.

Negative:

- absent credentials;
- adapter failure;
- missing route policy;
- Workshop/Platform cross-audience attempts;
- service principal on Workshop route;
- Workshop principal on provider tool;
- test adapter construction in production.

## Pending IdP decision

The selected provider must support OIDC discovery/JWKS, separate clients/audiences, MFA for Admin,
session revocation/logout, EU DPA/residency requirements and key rotation. Selection and final
integration require approval. Domain and authorization code will depend only on the adapter port.

## Coordination with ZaQ

No new live secret is required by this block. Current non-secret configuration adds exact
`WORKSHOP_ORIGIN` and `PLATFORM_ORIGIN` values.

After IdP approval, runtime configuration is expected to include issuer/discovery URL, separate
Workshop/Platform client IDs/audiences, BFF client secret where required, and a session encryption/
signing secret. ZaQ owns injection/rotation and Caddy routing; application code owns validation,
cookie policy and principal construction.
