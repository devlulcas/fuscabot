# Discord Link Library

A private, extension-first library that durably captures links, prepares useful
context, and publishes reviewed snapshots to Discord. PostgreSQL is the source
of truth; Discord is an outbound destination.

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
```

## Repository layout

```text
apps/api          Deno + Hono HTTP API and Drizzle schema
apps/extension    Vite + React Manifest V3 extension
packages/contracts Shared boundary schemas and pure domain rules
```
