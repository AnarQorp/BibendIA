# Workshop API contract

Status: P0.3 backend contract. Authentication remains fail-closed until the production OIDC
adapter is selected and configured.

## Tenant selection

Workshop tenant resources use `/v1/workshop/tenants/:tenantId/*`. The path tenant is a requested
selector only. The API converts it to a trusted TenantContext after validating the authenticated
internal user, active membership and required capability. A tenant in headers, query or body is
ignored and cannot override the path/authorized context.

## Appointments

`GET /v1/workshop/tenants/:tenantId/appointments`

Required principal: `workshop_user` with an active membership granting
`workshop:appointments:read`.

Success:

```json
{"data":[],"correlationId":"req-id"}
```

Errors:

- `400 INVALID_TENANT_SELECTOR`
- `401 AUTHENTICATION_REQUIRED` or `AUTHENTICATION_EXPIRED`
- `403 PRINCIPAL_NOT_ALLOWED`, `PRINCIPAL_INACTIVE` or `TENANT_ACCESS_DENIED`

The former `GET /v1/appointments` plus `x-tenant-id` contract is removed. It must not be used by
Workshop clients.
