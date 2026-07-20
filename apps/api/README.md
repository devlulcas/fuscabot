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

## Database

Apply `migrations/0000_initial.sql` to a disposable local PostgreSQL database. The migration
installs constraints for canonical-resource identity, one Read Later channel per workspace, and
duplicate delivery protection. Production migrations must run before serving a new deployment.

## Secrets

Discord credentials, the Mistral key, and the session signing secret belong only in API runtime
environment variables. On Deno Deploy, load them as secrets into the appropriate
development/production context; never bundle them with the extension.
