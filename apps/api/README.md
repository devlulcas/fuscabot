# Fuscabot API

The API is a Deno/Hono service. Its modules do not connect to PostgreSQL or external services at
import time, which keeps health checks, tests, and Deno Deploy startup deterministic.

## Local development

Copy `.env.example` to `.env`, fill only the values needed for the feature being tested, and
export/load the variables before starting the process. The current in-memory repository supports the
initial capture slice without PostgreSQL.

```sh
deno task dev
deno task test
deno task check
```

`GET /health` is intentionally available without a database connection.

## Discord connection

The extension uses Chrome's controlled web-auth flow. It opens `/v1/auth/discord/start`, the API
validates a signed OAuth state and the configured owner Discord user ID, then hands a one-hour
application session back through Chrome's `chromiumapp.org` redirect. API routes under `/v1` require
that bearer session except for the Discord start/callback endpoints.

The configured Discord OAuth callback remains:

```text
https://fuscabot.devlulcas.deno.net/v1/auth/discord/callback
```

## Database

Apply `migrations/0000_initial.sql` to a disposable local PostgreSQL database. The migration
installs constraints for canonical-resource identity, one Read Later channel per workspace, and
duplicate delivery protection. Production migrations must run before serving a new deployment.

## Secrets

Discord credentials, the Mistral key, and the session signing secret belong only in API runtime
environment variables. On Deno Deploy, load them as secrets into the appropriate
development/production context; never bundle them with the extension.
