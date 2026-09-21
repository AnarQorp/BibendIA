# Platform Admin v0 backend contract

Status: approved design contract. The tenant control subset documented below is implemented by P0.5;
other endpoints remain design contracts until their backlog item says so.

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

- `GET /tenants/:tenantId/control`
- `POST /tenants/:tenantId/lifecycle`
- `POST /tenants/:tenantId/kill-switch/enable`
- `POST /tenants/:tenantId/kill-switch/disable`

Control read response:

```json
{"data":{"lifecycle":"pilot","lifecycleUpdatedAt":"ISO-8601|null","lifecycleUpdatedBy":{"type":"platform_user","id":"uuid"},"lifecycleReason":"reason|null","killSwitch":{"enabled":false,"updatedAt":"ISO-8601|null","updatedBy":null,"reason":null},"version":3},"correlationId":"string"}
```

Command body:

```json
{"reason":"operator-visible reason","idempotencyKey":"string","expectedVersion":3}
```

The lifecycle command additionally requires `target` equal to `provisioning`, `pilot`, `active`,
`suspended` or `deactivated`. Unknown fields are rejected. Success returns `{ receipt,
correlationId }`; the receipt carries the before/after values, control version, event ID, timestamp
and evidence reference. Concurrent state mismatch or invalid transition returns `409`; an
operational lock returns `423`; missing capability/scope returns `403`.

`SUPPORT_READONLY` may call the control read within its grant scope but can never call either
mutation. Deactivated is terminal. The backend, not the UI, owns the transition matrix.

## UI safety requirements

- UI role checks improve UX but never replace API authorization.
- Destructive/sensitive actions require explicit confirmation and reason.
- PII is redacted by default; Admin v0 has no impersonation.
- Unknown fields are not rendered as trusted HTML.
- Kill switch state must be visible on every tenant detail screen.
