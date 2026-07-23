# Fuscabot Chrome extension

Manifest V3 side-panel client built with Vite, React, React Router DOM, TanStack
Query, TypeScript, and CSS Modules. The context-menu flow persists a capture
through the API before relying on the review UI; if extraction or persistence
fails, the panel retains an editable manual fallback.

## Develop

Requires Deno 2.x and Node.js 22+ for Vitest's worker runtime.

```sh
deno task check
deno task build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load
unpacked**, and select `apps/extension/dist`.

The manifest allows the development API (`http://localhost:8000`) and the
production API (`https://fuscabot.xyz`). Production is the default; use Settings
to select localhost during development. Only extension session/UI data is stored
locally; Discord and Mistral credentials belong on the backend.

The Chrome icon set uses the shared website favicon artwork at 16, 32, 48, and
128 pixels and is copied into the unpacked build by Vite's public-directory
pipeline.

## Structure

- `src/service-worker.ts`: context menus, explicit metadata extraction, durable
  capture request, side-panel coordination.
- `src/side-panel`: React hash router, persisted Query cache, platform adapters,
  CSS Modules, and Capture, Library, Channels, Tags, and Settings routes.
- `src/shared`: API, configuration, storage-facing types, and pure helpers.
- `vite.config.ts`: multi-entry side-panel and service-worker production build.

The API routes follow the implementation plan's `/v1` resource shape. The
extension rotates expired application sessions automatically, polls enrichment,
keeps manual editing available on failure, and can publish to the public archive
without requiring a Discord destination.
