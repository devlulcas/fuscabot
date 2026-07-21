# FuscaBot resilience evidence

Verified on 2026-07-21 against the repository quality gate.

| Objective                    | Evidence                                                                                                                                                                                                                                                                                                                 | Result | Residual risk / decision                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 readiness/startup         | `server_test.ts`; `/healthz` is dependency-free, `/readyz` probes PostgreSQL, initialization is single-flight with a retry cooldown; deploy runs migrations before startup                                                                                                                                               | Pass   | Discord and Mistral are deliberately not liveness dependencies                                                                                  |
| B2 bounded input/errors      | `json_body.ts`; declared and streamed 128 KiB limits, fatal JSON decoding, request IDs and security/cache headers in `app_test.ts`                                                                                                                                                                                       | Pass   | Limit is configurable in application dependencies for tests                                                                                     |
| B3 rate limiting             | `rate_limit_repository.ts`, migration `0005_rate_limits.sql`, `rate_limit_test.ts`; atomic durable buckets, route policies, `Retry-After`, preflight bypass                                                                                                                                                              | Pass   | Anonymous pre-auth traffic uses a conservative shared bucket because untrusted forwarding headers are not treated as client identity            |
| B4 OAuth/session/CORS        | exact extension origins and Chromium callback validation; state expiry/tamper/replay tests; single-flight extension refresh and atomic credential clearing                                                                                                                                                               | Pass   | Localhost API overrides remain available only for loopback development                                                                          |
| B5 XSS/content               | centralized web/Discord URL validation, escaped hostile-text tests, explicit MV3 CSP, Discord schema/limit tests and suppressed mentions                                                                                                                                                                                 | Pass   | The side panel's existing HTML templates remain under review; all remote interpolations use escaping helpers                                    |
| B6 Drizzle/SQL/authorization | Drizzle owns all application repository operations: resources, channel setup, enrichment, durable delivery, auth/session, tags, workspace bootstrap, and rate limiting. Repository audits reject direct queries and `sql.raw`; workspace predicates, row locks, claim uniqueness, and delivery transitions remain tested | Pass   | Fixed Drizzle `sql` expressions are limited to bound search predicates and enrichment duration calculation; no request value becomes SQL syntax |
| B7 external/delivery         | bounded Discord/OAuth fetch and response reads; capture persists before separate enrichment; Discord ambiguous outcomes enter `unknown`, block retry, and participate in uniqueness guard                                                                                                                                | Pass   | Unknown Discord sends require deliberate reconciliation rather than automatic resend                                                            |
| Full verification gate       | `deno task check`                                                                                                                                                                                                                                                                                                        | Pass   | No live Discord/Mistral traffic was used                                                                                                        |

## Reviewed runtime raw-SQL exceptions

- `db/migrations.ts`: forward-only migration execution and advisory locking.
- `server.ts`: bounded readiness `SELECT 1`.
- Drizzle generates and binds all runtime application repository queries.

## Production configuration checks

- Set `ALLOWED_EXTENSION_ORIGINS` to the exact production
  `chrome-extension://<id>` origin.
- Keep `APP_SESSION_SIGNING_SECRET`, Discord credentials, Mistral credentials,
  and `DATABASE_URL` only in deployment secrets.
- Run `deno task migrate` before starting/deploying the runtime.
- Use `/healthz` for liveness and `/readyz` for readiness.
