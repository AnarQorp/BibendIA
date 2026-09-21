# Platform Admin v0 backend contract

Status: approved design contract; endpoints are not implemented until their backlog item says so.

This is the contract raQel may use to build `admin.bibendia.com`. Base path: `/v1/platform`.
All responses include `correlationId`. Errors use `{ code, message, correlationId }` and never
return secrets or raw provider payloads.

## Tenant summary

`GET /tenants` returns:

```json
{"data":[{"id":"uuid","name":"Jarrisons","status":"pilot","operatingMode":"pilot_supervised","killSwitch":{"enabled":false},"health":{"channels":"ok","integrations":"degraded","outbox":"ok"},"usageMonth":{"conversations":0,"voiceMinutes":0,"estimatedCost":{"amount":"0.00","currency":"EUR"}}}],"correlationId":"uuid"}
```

`POST /tenants` accepts a deliberately small payload:

```json
{"name":"Jarrisons","workshop":{"name":"Jarrisons","timezone":"Europe/Madrid"},"operatingMode":"pilot_supervised","idempotencyKey":"string"}
```

It returns `201` with `{ tenant, workshop, receipt, correlationId }`.

## Tenant detail resources

- `GET /tenants/:tenantId`
- `GET|POST|PATCH /tenants/:tenantId/memberships`
- `GET|POST|PATCH /tenants/:tenantId/channel-endpoints`
- `GET|POST|PATCH /tenants/:tenantId/integrations`
- `GET /tenants/:tenantId/agent-config/versions`
- `POST /tenants/:tenantId/agent-config/versions/:version/activate`
- equivalent Policy version endpoints
- `GET /tenants/:tenantId/activity?cursor=&limit=`
- `GET /tenants/:tenantId/usage-costs?from=&to=`
- `GET /tenants/:tenantId/incidents?status=`
- `GET /tenants/:tenantId/audit?cursor=&limit=`

Provider credentials are write-only secret references. Read models expose only provider, status,
capabilities, verification state and safe error summaries.

## Lifecycle and kill switch commands

- `POST /tenants/:tenantId/activate`
- `POST /tenants/:tenantId/suspend`
- `POST /tenants/:tenantId/resume`
- `POST /tenants/:tenantId/deactivate`
- `POST /tenants/:tenantId/kill-switch/enable`
- `POST /tenants/:tenantId/kill-switch/disable`

Command body:

```json
{"reason":"operator-visible reason","idempotencyKey":"string","expectedVersion":3}
```

Success returns `{ tenant, receipt, correlationId }`. Concurrent state mismatch returns `409
VERSION_CONFLICT`; missing capability returns `403 FORBIDDEN`; step-up required returns `403
STEP_UP_REQUIRED`.

## UI safety requirements

- UI role checks improve UX but never replace API authorization.
- Destructive/sensitive actions require explicit confirmation and reason.
- PII is redacted by default; Admin v0 has no impersonation.
- Unknown fields are not rendered as trusted HTML.
- Kill switch state must be visible on every tenant detail screen.
