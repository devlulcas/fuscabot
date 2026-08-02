# Discord Link Library

![Fuscabot Archive: A public collection of useful links](apps/web/public/assets/social/fuscabot-og-e923a46a.jpg)

An extension-first library that captures and enriches links, publishes reviewed
snapshots to Discord, and exposes only explicitly published resources through a
read-only bilingual archive. PostgreSQL is the source of truth.

## Requirements

- Deno 2.4.2 or newer (2.9.x is used during initial development)
- Node.js 22 or newer for the Vitest worker runtime invoked by Deno tasks
- PostgreSQL for persistent API development
- Chrome or Chromium for loading the unpacked extension

## Commands

```sh
deno task check
deno task dev
deno task dev:api
deno task build:web
deno task test:web:e2e
deno task build:extension
deno task db:generate
deno task db:migrate
```

## Repository layout

```text
apps/api          Importable Deno + Hono API runtime and Drizzle schema
apps/extension    Vite + React Manifest V3 extension
apps/web          SvelteKit + Svelte 5 public archive and deploy entrypoint
packages/contracts Shared boundary schemas and pure domain rules
```

## Deployment boundary

The SvelteKit application is the main Deno Deploy runtime. It imports
`@fuscabot/api` only from server modules, reads the public archive through a
typed backend facade, and forwards `/v1/**` requests to Hono without rewriting
their method, headers, body, query, or response. `/health` is the only health
probe. The extension-facing API contracts and OAuth callback URL remain
unchanged.
