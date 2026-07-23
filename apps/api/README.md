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

`GET /health` is intentionally available without a database connection. The same process serves the
public archive at `/`; public pages require a ready database and never infer visibility from Inbox
or Discord delivery state.

## Discord connection

The extension uses Chrome's controlled web-auth flow. It opens `/v1/auth/discord/start`, the API
validates a single-use persisted OAuth state and the configured owner Discord user ID, then hands a
15-minute access token plus a rotating, revocable refresh token back through Chrome's controlled
redirect. Only token hashes are stored. API routes under `/v1` require that bearer session except
for Discord start/callback and session refresh.

The configured Discord OAuth callback remains:

```text
https://fuscabot.xyz/v1/auth/discord/callback
```

## Database

Run `deno task db:generate` after changing the Drizzle schema, `deno task db:check` to validate
generated migrations, and `deno task migrate` to apply them. Never edit generated migration SQL
manually. Constraints cover canonical identity, one Read Later channel, active enrichment claims,
and duplicate delivery protection; separate weighted GIN indexes support private library search and
the allow-listed public archive search projection.

For local access to the managed development timeline, use `deno task --tunnel migrate` or
`deno task --tunnel dev`.

## Backup and export

Managed PostgreSQL is the source of truth. Before destructive schema changes, take a provider
snapshot/export from the Prisma Postgres project attached as `fuscabot-db`. A portable export must
include all public tables plus Drizzle's migration journal. Periodically verify restoration into a
disposable database; Discord messages are outbound snapshots, not backups.

## Secrets

Discord credentials, the Mistral key, and the session signing secret belong only in API runtime
environment variables. On Deno Deploy, load them as secrets into the appropriate
development/production context; never bundle them with the extension.

## Public archive configuration

Production requires the exact public origin:

```text
PUBLIC_SITE_ORIGIN=https://fuscabot.xyz
```

Optional Umami tracking is enabled only when both values are present:

```text
UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
UMAMI_WEBSITE_ID=b7f428a4-b9d3-402d-a8ec-f5ba944f728f
```

`UMAMI_HOST_URL` may override the collection origin for a self-hosted tracker. Public HTML is
revalidated on every request with ETags; static fingerprinted assets are immutable. Run
`deno task migrate` before starting the application. Inbox, Read Later, and Shared derive from
delivery history.
