# Fuscabot Archive implementation plan

Repository: `devlulcas/fuscabot`\
Production origin: `https://fuscabot.xyz`

## Outcome

Add a bilingual, public, read-only, server-rendered archive to the existing Deno
Deploy application. The browser extension remains the only authenticated
administration surface. Visitors may see only resources explicitly published
through the extension.

The archive is named **Fuscabot Archive**. It uses the botanical editorial
direction in `design.md`, remains useful without JavaScript, and does not add a
second deployment, CMS, cookie-based session, or public JSON API.

Implementation is complete only after migrations, tests, documentation,
integration, and a successful push to `main`. Production deployment is a
separate, explicit step.

## Publication behavior

- The extension's Publish action first saves the draft, then independently
  attempts website publication and delivery to the selected Discord channel.
- The UI identifies both destinations before publishing. It does not show a
  confirmation dialog.
- A missing Discord destination does not block website publication.
- Partial successes remain successful and are reported per destination. Website
  and Discord failures have targeted retry actions.
- Publishing an already-public resource is a website no-op, but may deliver to
  another Discord channel. A successful delivery cannot be duplicated to the
  same channel except through the existing failed-delivery retry flow.
- Website visibility is explicit and independent of Discord delivery state.
  "Remove from public site" unpublishes without deleting Discord messages or the
  saved resource.
- Permanent resource deletion also removes its public page.
- Archive is removed from the product. Existing archived resources return to the
  active library, with Inbox/Read Later/Shared still derived from delivery
  history, and permanent Remove is the remaining destructive lifecycle action.
- Publication requires a non-empty title and a normalized HTTP(S) URL.
  Enrichment, summary, selected text, tags, and images are optional.
- A public slug is created on first publication from a normalized title plus an
  eight-character random suffix. It is immutable while the resource exists.
  Unpublishing retains it; republishing reuses it, sets a fresh publication
  timestamp, and returns the resource to the front of the archive.
- Public pages always render the latest safe resource fields. Editing a public
  resource does not require republishing.

The public projection contains only:

- public slug and publication/update timestamps;
- title and optional summary;
- optional selected text;
- source domain and a validated canonical-or-normalized outbound URL;
- tag slugs and English/Brazilian Portuguese display labels.

It never contains personal notes, descriptions, original URLs, preview images,
tag aliases, internal resource/workspace IDs, enrichment data, Discord data,
delivery history, authentication data, or session data.

Discord messages retain the reviewed plain-Markdown format and link directly to
the safe source URL rather than the archive page. Personal notes may remain in
that Discord snapshot but are never part of the website projection.

## Data and authenticated interfaces

Add nullable `public_slug` and `public_published_at` columns, a unique public
slug index, publication-order indexes, and a dedicated public search vector
containing only public fields. Public search must never match or rank on notes,
descriptions, original URLs, aliases, enrichment data, or other private fields.

Remove `archived_at` only after restoring archived records to the active
library. Inbox/Read Later/Shared continue to derive from delivery history.
Remove Archive from schemas, patches, bulk actions, derived states, query
parameters, and extension controls. Retain atomic bulk deletion.

Authenticated interfaces:

- `POST /v1/resources/:id/publication`
  - accepts `{ channelId?: UUID }`;
  - validates ownership and publication eligibility;
  - attempts website and requested Discord targets independently;
  - returns per-target statuses from `published`, `already_published`, `sent`,
    `already_sent`, `failed`, `unavailable`, and `not_requested`;
  - includes only sanitized error text, retryability, safe public/Discord URLs,
    and required delivery identifiers.
- `DELETE /v1/resources/:id/publication`
  - removes public visibility while preserving the slug.
- Authenticated resource responses add
  `publicPublication: { slug, publishedAt, url } | null`.
- Resource listing accepts independent `visibility=public|private` filtering;
  omitted visibility means all resources.

Authentication, owner/workspace scoping, existing CORS restrictions, and
authenticated rate limits remain mandatory. All `/v1/*` responses use
`Cache-Control: no-store`.

## Public website

Create `apps/web` as a Deno workspace package using Hono JSX SSR. It exports an
injectable router/factory and narrow archive-reader interface. The existing API
runtime constructs the PostgreSQL reader and mounts the router into the same
dynamic application.

Routes:

- `/` redirects according to `Accept-Language` to `/pt-br/` for Brazilian
  Portuguese preferences and `/en/` otherwise, with `Vary: Accept-Language`.
- `/en/` and `/pt-br/` show the newest-first archive, free-text search,
  localized tag filtering, and conventional pagination.
- `/en/links/:slug` and `/pt-br/links/:slug` show resource details.
- `/robots.txt`, `/sitemap.xml`, fingerprinted `/assets/*`, and localized
  generic 404 pages are public.
- `/health` and `/healthz` remain dependency-free JSON health endpoints.
  `/readyz` and public archive routes remain database-aware.

Translate interface copy, accessibility labels, and metadata templates only.
Authored resource content remains unchanged. The extension presents the
localized public URL matching the resource output language.

Search and browsing:

- twenty resources per page;
- query text is trimmed and limited to 100 characters;
- search and one tag filter may be combined;
- title and tag matches rank above summary, domain, and selected-text matches;
- publication time is the deterministic tie-breaker;
- invalid query shapes return a localized `400`, while an unknown tag returns an
  empty `200` result.

The site is named **Fuscabot Archive**, with localized descriptive subtitles.
Use the text-first `design.md` visual system, self-hosted Libre Caslon Text,
Source Serif 4, and JetBrains Mono, and no remote preview images. Provide
semantic landmarks, a skip link, visible keyboard focus, reduced-motion support,
accessible pagination, localized link labels, self-canonical URLs, `hreflang`
alternates, and Open Graph metadata.

## Extension presentation

- Make Botanical the default light theme.
- Retain coordinated dark and system modes; remove redundant legacy light
  themes.
- Preserve the current information architecture while improving spacing,
  scrollbars, contrast, responsive layouts, and keyboard/focus behavior.
- Show a Public badge and independent All/Public/Private library filtering.
- Remove Archive actions and filters.
- Add "Remove from public site" under More Actions.
- Show separate website and Discord publication results and retry controls.

## Security and caching

- Render authored content with escaped JSX only. Never use raw authored HTML.
- Validate every outbound URL as credential-free HTTP(S).
- Public/private/unknown slugs return the same generic public 404.
- Preserve request IDs and structured logs without query values, titles, notes,
  URLs, tokens, or private resource data.
- Use a restrictive HTML CSP, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`,
  `frame-ancestors 'none'`, and compatible cross-origin resource policies.
- Do not enable public CORS.
- Key public limits by the `Deno.serve` remote address and hash keys through the
  existing PostgreSQL limiter: 120 page requests per minute and 30 search
  requests per minute. Health and immutable assets are exempt. Return `429` with
  `Retry-After`.
- Dynamic public pages use ETags and
  `Cache-Control: public, max-age=0, must-revalidate`, ensuring origin
  revalidation before serving an unpublished resource.
- Fingerprinted static assets use a one-year immutable policy. Robots and
  sitemap responses use ETags and revalidation.
- Health, errors, authenticated routes, and mutable/private responses use
  `no-store`.

## Umami

Analytics is absent in development and tests unless configured. Production uses:

```text
UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
UMAMI_WEBSITE_ID=b7f428a4-b9d3-402d-a8ec-f5ba944f728f
```

Render Umami's deferred automatic tracker with:

- `data-website-id`;
- `data-do-not-track="true"`;
- `data-exclude-search="true"`;
- `data-exclude-hash="true"`;
- `data-domains="fuscabot.xyz"`.

Allow `https://cloud.umami.is` in `script-src` and `connect-src` only when both
configuration values validate. Automatic analytics may receive the localized
page path and document title, but never search parameters, hashes, notes, or
unpublished data. Track source-link clicks as `outbound-link` with source domain
as the only custom event property and no inline event handler.

`PUBLIC_SITE_ORIGIN` is required and must be an exact HTTPS origin in
production. Local HTTP origins are allowed only for local development.

## Parallel implementation boundaries

After this plan is committed, create three sibling worktrees from the same
foundation:

1. `agent/publication-backend`: database migration, shared contracts, safe
   projection/search repository, authenticated publication endpoints, Archive
   removal, idempotency, and backend tests.
2. `agent/public-web`: isolated SSR router, bilingual components and styles,
   archive-reader interface, SEO, analytics markup, security/caching behavior,
   and rendering tests. This worktree does not edit root deployment files.
3. `agent/extension-publication-ui`: combined publication UX, destination
   results/retries, visibility controls, unpublish/remove behavior, Archive
   removal, themes, and extension tests.

The coordinator owns root workspace tasks, runtime mounting, environment
validation, dependency construction, cross-package integration, documentation,
and conflict resolution. Feature commits are preserved when integrated.

Agents must avoid coordinator-owned files. If implementation reveals a genuine
contradiction not resolved here, report it to the coordinator; the coordinator
records it in `doubts.md` and pauses only the affected branch.

## Verification and delivery

Tests must prove:

- archived-to-Inbox migration and complete Archive removal;
- authenticated publication, ownership, eligibility, partial outcomes, targeted
  retries, idempotency, additional Discord destinations, unpublish, republish,
  deletion, and visibility filtering;
- public search and HTML cannot expose or match private fields;
- both locales, negotiation, search ranking, tags, pagination, escaping,
  metadata, sitemap, robots, ETags, caching, CSP, rate limiting, and generic 404
  behavior;
- Umami is absent without configuration and emits the approved script, privacy
  attributes, and outbound event markup when configured;
- extension publication outcomes, public URLs, filters, removed Archive UI,
  theme persistence, keyboard navigation, and responsive layouts;
- existing API, authentication, CORS, Discord, and enrichment behavior remains
  intact.

Run and fix:

```sh
deno task fmt
deno task check
deno task build:extension
```

Complete manual desktop, mobile, no-JavaScript, and extension side-panel smoke
tests. Integrate feature commits into `main`, remove only clean worktrees after
verification, and push `main`. Do not deploy production.
