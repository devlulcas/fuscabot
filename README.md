# Discord Link Library

![Fuscabot Archive: A public collection of useful links](apps/web/public/social/fuscabot-og-e923a46a.jpg)

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
deno task dev:api
deno task build:extension
deno task db:generate
deno task db:migrate
```

## Repository layout

```text
apps/api          Deno + Hono HTTP API and Drizzle schema
apps/extension    Vite + React Manifest V3 extension
apps/web          Hono JSX public archive
packages/contracts Shared boundary schemas and pure domain rules
```
