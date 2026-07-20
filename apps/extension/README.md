# Fuscabot Chrome extension

Manifest V3 side-panel client built with browser APIs, plain TypeScript, HTML,
and CSS. The context-menu flow persists a capture through the API before relying
on the review UI; if extraction or persistence fails, the panel retains an
editable manual fallback.

## Develop

Requires Deno 2.x.

```sh
deno task check
deno task build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load
unpacked**, and select `apps/extension/dist`.

The manifest allows only the development API (`http://localhost:8000`) and the
placeholder production origin (`https://api.fuscabot.dev`). Update the latter
before release. Configure the base URL and authenticated app session in the
Settings view. Only extension session/UI data is stored locally; Discord and
Mistral credentials belong on the backend.

## Structure

- `src/service-worker.ts`: context menus, explicit metadata extraction, durable
  capture request, side-panel coordination.
- `src/side-panel`: hash router and Capture, Library, and Settings views.
- `src/shared`: API, configuration, storage-facing types, and pure helpers.
- `scripts/build.ts`: dependency-free Deno builder. Source TypeScript
  deliberately uses browser-compatible syntax; the builder copies it as
  JavaScript and rewrites local import extensions.

The API routes follow the implementation plan's `/v1` resource shape. Manual
states remain usable when enrichment fails, and standard publication stays
disabled until the user selects a destination.
