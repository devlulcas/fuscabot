# Minimalist UI to React Migration Plan

## Goal

Replace the extension side panel's imperative HTML renderer with a React 19,
Vite, React Router DOM, and TanStack Query application while preserving the
service worker, API contracts, extension permissions, appearance, and workflows.

The migration is a single atomic cutover. It does not maintain a legacy bridge
or dual side-panel entry.

## Conventions and toolchain

- Use kebab-case for every migrated side-panel file and directory. React symbols
  remain PascalCase and ordinary TypeScript symbols remain camelCase.
- Keep Deno as the only dependency manager, task entry point, workspace, and
  lockfile owner. Consume npm packages through `deno.json`; the UI-test task may
  invoke Node for Vitest's worker runtime.
- Use one plain Vite multi-entry build for the side panel and framework-free
  service worker. Do not add CRXJS, a package.json, or a second lockfile.
- Emit a deterministic `service-worker.js`; keep UI chunks local and compatible
  with Manifest V3 CSP.
- Keep route modules statically imported initially. Add code splitting only for
  a future measured, genuinely heavy optional feature.
- Bundle size is not a release gate for this installed extension. Request
  behavior, rendering responsiveness, and bounded background work are gates.

## Ownership boundaries

### React Router

Use `createHashRouter` and retain `/capture/:captureId?`, `/library`,
`/channels`, `/tags`, and `/settings`.

React Router owns route matching, navigation, URL state, error elements,
not-found handling, and synchronous validation or redirects. Loaders must never
fetch, read storage, or return promises. Do not use Router actions.

Library search, state, domain, enrichment status, sort, and page live in URL
search parameters. An uncontrolled filter form commits them together on submit.
Back, forward, reload, and direct links must restore the same query.

### TanStack Query

TanStack Query exclusively owns side-panel API and Chrome-storage async state.
The MV3 service worker retains direct, durable API/storage orchestration and
does not use Query Core.

Centralize stable query keys for configuration, session, guilds, pending
captures, resource details, normalized resource lists, channels, and tags.
Components must not copy query data into local state or context.

Freshness policy:

- Active capture state is immediately stale and synchronized.
- Resource details and Library pages are fresh for 5 minutes.
- Session, guilds, channels, and tags are fresh for 30 minutes.
- Successful writes and matching runtime events invalidate immediately.

Retry eligible reads at most twice with capped exponential delay. Retry network
errors, 408, 429, and 5xx responses; respect retry metadata when present. Never
retry other 4xx responses or mutations automatically.

Use response-driven mutations rather than optimistic writes. Show scoped pending
and error states, write authoritative returned entities into exact caches, and
invalidate affected query families:

- Resource edits update detail and invalidate Library variants.
- Archive, restore, delete, delivery, enrichment retry, and bulk actions
  invalidate affected details and lists; deletion removes detail entries.
- Channel updates replace the returned channel; sync replaces the channel list.
- Tag changes invalidate tag variants; updates and merges also invalidate
  resources containing embedded tag data.
- Runtime capture messages invalidate only the matching pending/detail keys.

### Persistence

Use `PersistQueryClientProvider` with a custom asynchronous IndexedDB persister.
Persist every safe successful query, but never pending/error queries,
credential-bearing configuration, mutations, or retry state.

- Maximum persisted age: 24 hours.
- `gcTime` must be compatible with the maximum age.
- Gate route content until restoration completes.
- The buster contains a manually incremented cache-schema version, normalized
  API base URL, and session ID.
- On OAuth replacement, logout, refresh failure, or API-base change, clear the
  in-memory cache and IndexedDB record, persist the new explicit configuration,
  and reload while preserving the hash.

Chrome storage remains authoritative for credentials, configuration, and
pending-capture records. Restored data stays visible if background refresh
fails, with a visible stale/error state and manual retry. Mutations are never
queued for offline replay.

### Local and global state

Keep form drafts, selection, disclosure state, and transient feedback at their
closest owner. Do not create a global Context + `useReducer` provider without a
concrete cross-route client-only state domain. If one becomes necessary, expose
`{ state, actions, meta }` and keep its reducer private.

Use uncontrolled native forms, `FormData`, browser constraints, and pure
normalizers by default. Control only inputs with live UI dependencies. Protect
unsaved Capture, channel, tag, and API URL edits with Router blocking and
`beforeunload`; do not block Library filters or immediately persisted appearance
changes.

Do not use `useEffect` for data fetching, derived state, prop mirroring, or
user-driven mutations. Runtime integration is a single platform bridge that
invalidates Query keys and has explicit teardown.

## Capture synchronization

The capture route reads the service worker's keyed pending record, then the API
resource. Chrome runtime messages provide immediate exact-key invalidation. A
2-second fallback interval runs only while pending state is `extracting` or
`preparing`, or resource enrichment is `preparing`.

Stop polling on `ready`, `failed`, route change, unmount, hidden/background
panel, disabled query, exhausted bounded retries, or 30 successful non-terminal
responses. After that one-minute fallback budget, retain the last state and rely
on exact runtime invalidation or a manual retry instead of generating unbounded
traffic. Duplicate runtime messages must deduplicate through Query. Channels and
tags are shared cached queries and must not refetch with each resource poll.
Start independent reads together.

## Components, errors, and styling

- Route modules orchestrate queries and mutations. Components own one visible
  concern and remain small and explicit.
- Extract pure TypeScript functions before hooks. Pure modules must not import
  React, Router, Query hooks, Chrome globals, or DOM APIs.
- Prefer composition and explicit variants over boolean-prop proliferation.
  Avoid inline component definitions and premature memoization.
- Use explicit Query loading/error states by default. Suspense is selective and
  requires a stable fallback plus actionable error boundary.
- Keep the shell navigable during recoverable route failures. Auth failures use
  an inline boundary that preserves the requested route; Settings remains
  available.

Retain only design tokens, reset/document rules, themes, and global
accessibility foundations in global CSS. Move navigation, components, forms,
surfaces, loading UI, layouts, and pages into colocated CSS Modules.

Preserve the existing visual language while fixing accessibility and interaction
issues: semantic controls, labels, visible focus, keyboard flow, status
announcements, reduced motion, stable loading dimensions, long-content handling,
safe external links, and usable side-panel widths. Apply the Web Interface
Guidelines and the Vercel React performance and composition guidance during
review.

## Pagination contract

Extend `GET /v1/resources` metadata:

```ts
type ResourceListMeta = {
  limit: number;
  offset: number;
  hasMore: boolean;
};
```

The API fetches `limit + 1`, returns at most `limit`, and derives `hasMore` from
the extra row. The extension client returns `{ items, pageInfo }`. Library uses
a fixed page size of 25 and URL-driven Previous/Next controls.

## Implementation sequence

1. Add reliable pagination metadata and shared/client parsing.
2. Replace the extension build with Deno-managed Vite multi-entry output.
3. Add Query keys, retry policy, IndexedDB persistence, restoration gate, cache
   identity reset, and Chrome runtime bridge.
4. Add the hash router, shell, auth boundary, route errors, and shared UI.
5. Migrate Capture, Library, Channels, Tags, and Settings to React.
6. Move existing styles into global foundations and CSS Modules.
7. Remove `innerHTML` rendering, manual listener rebinding, manual hash routing,
   timer lifecycle helpers, obsolete global CSS, and the old build script.
8. Update tests and documentation, run the full repository check, and build the
   production unpacked extension.

## Verification

Automated coverage must include:

- URL codec normalization, canonical serialization, pagination, and history.
- Query keys, bounded retries, invalidation scope, abort behavior, and terminal
  capture polling.
- Duplicate runtime notifications, exact capture invalidation, no channel/tag
  refetch per resource poll, and cancellation on route exit.
- Persistence restore, expiry, buster mismatch, identity reset, and IndexedDB
  failure handling.
- Resource, bulk, delivery, channel, tag, OAuth, and appearance mutations.
- Pagination API metadata for empty, partial, exact, and additional pages.
- Direct capture UUIDs, invalid IDs, auth recovery, not-found routes, loading,
  empty, stale/error, and unsaved-form states.
- Route-level axe checks plus existing API, contract, service-worker, security,
  and capture tests.
- Production Vite build under Manifest V3 CSP.

Manual unpacked-extension QA covers context-menu capture, long enrichment,
duplicate updates, close/reopen restoration, unreachable API with cached data,
OAuth replacement, API-base reset, Library history/pagination, all mutations,
themes, keyboard/focus flow, reduced motion, long content, and narrow widths.

Completion requires no side-panel `innerHTML`, manual DOM listener rebinding,
async Router loaders/actions, effect-based fetching, duplicate server caches, or
unbounded capture polling. All migrated side-panel paths must be kebab-case and
only foundation CSS may remain global.
