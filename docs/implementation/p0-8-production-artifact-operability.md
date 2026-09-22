# P0.8 Production Artifact & Operability

P0.8 adds no product behavior. It establishes compiled API/Worker/Migrator artifacts, exact schema compatibility, startup validation, health contracts, structured logs, safe shutdown, and the application-side deployment contract in `docs/operations/production-runtime-contract.md`.

Security invariants:

- API and Worker use different database login URLs and never migrate.
- only a login able to assume `bibendia_migrator` may run production migrations;
- runtime readiness requires exact migrations 001–009 and the expected DB role membership;
- PII keyrings are validated before the API listens;
- disabled integrations do not require future credentials;
- Worker is disabled by default and any `WORKER_MODE` other than `disabled` is refused because no production outbound adapter exists;
- health and structured errors expose stable codes, not underlying exception messages or configuration;
- immutable artifact identity is present in labels and logs.

The canonical Web3/security documents referenced by the shared CODEX skill are not present in this repository. This implementation therefore follows the local P0 ADRs, contracts and P0.1–P0.7 implementation evidence without inventing missing canon.
