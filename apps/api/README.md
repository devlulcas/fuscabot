# Fuscabot API

The API is a Deno/Hono service. Its modules do not connect to PostgreSQL or external services at
import time, which keeps health checks, tests, and Deno Deploy startup deterministic.

## Local development

Copy `.env.example` to `.env`, fill only the values needed for the feature being tested, and
export/load the variables before starting the process. Production requires PostgreSQL; tests use
injectable in-memory/fake repositories where appropriate.

```sh
deno task dev
deno task test
deno task check
```

`GET /health` is intentionally available without a database connection.

## Discord connection

The extension uses Chrome's controlled web-auth flow. It opens `/v1/auth/discord/start`, the API
validates a single-use persisted OAuth state and the configured owner Discord user ID, then hands a
15-minute access token plus a rotating, revocable refresh token back through Chrome's controlled
redirect. Only token hashes are stored. API routes under `/v1` require that bearer session except
for Discord start/callback and session refresh.

The configured Discord OAuth callback remains:

```text
https://fuscabot.devlulcas.deno.net/v1/auth/discord/callback
```

## Database

Run `deno task migrate` to apply every numbered migration. The runner records checksums and refuses
changed migrations. Constraints cover canonical identity, one Read Later channel, active enrichment
claims, and duplicate delivery protection; a weighted GIN full-text index supports library search.
Production runs the same advisory-lock/checksum boundary lazily before the first protected API
request, after the HTTP listener is available.

For local access to the managed development timeline, use `deno task --tunnel migrate` or
`deno task --tunnel dev`.

## Backup and export

Managed PostgreSQL is the source of truth. Before destructive schema changes, take a provider
snapshot/export from the Prisma Postgres project attached as `fuscabot-db`. A portable export must
include all public tables plus the `schema_migrations` ledger. Periodically verify restoration into
a disposable database; Discord messages are outbound snapshots, not backups.

## Secrets

Discord credentials, the Mistral key, and the session signing secret belong only in API runtime
environment variables. On Deno Deploy, load them as secrets into the appropriate
development/production context; never bundle them with the extension.
