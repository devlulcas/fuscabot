# Discord Link Library

A private, extension-first library that durably captures links, prepares useful
context, and publishes reviewed snapshots to Discord. PostgreSQL is the source
of truth; Discord is an outbound destination.

The implementation follows
[discord-link-library-plan.md](./discord-link-library-plan.md). Work is tracked
in [TASKS.md](./TASKS.md).

## Requirements

- Deno 2.4.2 or newer (2.9.x is used during initial development)
- PostgreSQL for persistent API development
- Chrome or Chromium for loading the unpacked extension

## Commands

```sh
deno task check
deno task dev:api
deno task build:extension
```

Application-specific setup lives under `apps/api` and `apps/extension`. Never
place Discord, Mistral, OAuth, or session secrets in the extension.

## Repository layout

```text
apps/api          Deno + Hono HTTP API and Drizzle schema
apps/extension    Plain TypeScript Manifest V3 extension
packages/contracts Shared boundary schemas and pure domain rules
```

Production deployment targets the current Deno Deploy platform through
`deno deploy`. Deployment identity is intentionally not committed until the Deno
organization and app are selected.
