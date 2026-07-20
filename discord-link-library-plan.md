# Discord Link Library — Implementation Plan

## 1. Product summary

Build a private, extension-first link library for capturing interesting resources and sharing them into a Discord server with useful context.

The product is for a single primary user. It must make it easy to capture a page, understand it later, search it, and publish it to the correct Discord text channel. Discord is an output destination and social archive; PostgreSQL is the source of truth.

### The core problem it solves

- Discord channels are useful for sharing but poor as a personal link library.
- Links can be sent to the wrong channel or without enough explanation.
- Discord search is not a reliable way to rediscover previously shared material.
- There is no external, structured list of shared links.

### Product principles

1. **Capture must never lose a link.** A deliberate capture is saved to the backend immediately, even if AI enrichment fails or the side panel closes.
2. **AI assists; the user decides.** AI may draft context, tags, and a channel suggestion, but it never silently publishes or picks a low-confidence destination.
3. **One resource, many deliveries.** The same article/tool can be shared in multiple Discord channels without duplicating it in the library.
4. **The extension is the product surface in v1.** There is no standalone web dashboard initially.
5. **Use minimal dependencies and web/platform APIs where they fit.** Prefer TypeScript, HTML, modern CSS, native extension APIs, Hono, PostgreSQL, and `fetch` over large wrappers.
6. **Keep external credentials private.** Mistral and Discord bot secrets are only stored on the backend.

## 2. Confirmed v1 decisions

| Area | Decision |
| --- | --- |
| Primary UI | Chrome extension side panel, with a toolbar action and context-menu capture action. |
| Extension stack | Plain TypeScript, HTML, and modern CSS modules. No WXT or UI framework. |
| Backend | Deno runtime on the new Deno Deploy platform, Hono, managed Deno PostgreSQL, `pg`, and Drizzle. |
| Discord integration | A Discord bot using the REST API via native `fetch`; no Discord SDK and no Gateway/reply handling. |
| AI | Mistral API, called only by the backend. |
| Channels | Import only standard Discord text channels. Exclude forums, threads, categories, announcements, voice channels, etc. |
| Read Later | Select an existing Discord text channel. The bot never creates, deletes, or reorganizes server channels. |
| Capture persistence | Context-menu capture creates a backend Inbox item before opening the side panel. |
| Selected text | Preserve selected text as a quoted highlight/context for the captured resource. |
| Destination selection | High-confidence AI suggestions may be preselected and are always editable. Low confidence leaves destination unselected; standard publishing requires a user choice. |
| Discord context | AI-generated context defaults to Portuguese. Original title, URL, and selected quote preserve their source language. The resource can override output language. |
| Personal note | Optional. AI context is used by default; the user may add or replace it. |
| Tags | One canonical tag with English and Portuguese labels/aliases, rather than separate duplicate tags. |
| Duplicate handling | Store original and normalized canonical URLs. The same canonical resource can have multiple Discord deliveries. |
| Published messages | A delivery is a snapshot. Editing a resource later does not silently edit already-published Discord messages. |
| Future integration | Design outbound deliveries so Raindrop can become another destination later. It is not part of v1. |

## 3. Scope

### In scope for v1

- Browser context-menu action for the current page, link, or selected text.
- Side panel to review prepared captures, browse the library, and configure Discord/channel routing.
- Server-side persistence in PostgreSQL.
- Page metadata extraction from the active page.
- Mistral enrichment: concise summary, why it is useful, tag suggestions, channel suggestion, confidence, and output language-aware copy.
- Discord OAuth/setup and bot connection to one chosen guild/server.
- Import and manual sync of accessible text channels.
- Channel routing descriptions and one Read Later channel selection.
- Save to Inbox automatically on capture.
- Publish a resource to Read Later or to one or more regular channels.
- Search/filter resources and open their original links or Discord deliveries.
- Tag normalization, bilingual labels, and alias lookup.
- Tests for the domain logic, API contracts, URL normalization, and Discord request formatting.

### Explicitly out of scope for v1

- A public website or standalone dashboard.
- Multi-user collaboration, friend accounts, Discord reply handling, reactions, or moderation.
- Discord forum channels, threads, slash commands, Gateway events, message history import, or full Discord search replacement.
- Automatically editing Discord messages when a resource changes.
- AI auto-publishing without review.
- Full-article scraping, embeddings/vector search, RSS ingestion, mobile apps, GNOME integration, and Raindrop write-back.
- Bot channel creation/management or broad Administrator permissions.

## 4. System architecture

```text
Chrome extension
  ├─ Manifest V3 service worker
  ├─ Context-menu command
  ├─ Side panel (capture, library, settings)
  └─ Content-script metadata extraction
           │
           │ authenticated HTTPS API
           ▼
Deno Deploy application
  ├─ Hono HTTP API
  ├─ Discord OAuth/setup routes
  ├─ Capture and resource service
  ├─ Mistral enrichment service
  ├─ Discord REST delivery service
  └─ Drizzle repositories
           │                 │
           ▼                 ▼
    Deno PostgreSQL      Mistral API / Discord API
```

### Responsibility boundaries

| Component | Responsibilities | Must not contain |
| --- | --- | --- |
| Extension | Capture active-page data, render/review UI, authenticate to API, request actions. | Discord bot token, Mistral key, direct database access. |
| API | Validate input, own domain rules, persist state, call Mistral/Discord, enforce owner authorization. | UI-only state or a dependency on popup lifetime. |
| PostgreSQL | Source of truth for resources, tags, channels, settings, enrichment, and deliveries. | Raw secrets. |
| Discord bot | Send messages to allowed channels through API calls. | Gateway connection, reply processing, server administration. |
| Mistral | Suggest structured, editable metadata only. | Authority to publish or mutate state directly. |

## 5. Chrome extension design

### 5.1 Manifest V3 components

- `service_worker`: registers context-menu items, captures tab/selection data, opens the side panel, starts backend requests, and coordinates messages.
- `side_panel`: the main extension application. It has internal views for Capture, Library, and Settings.
- `content_script`: runs only after an explicit user capture/action to extract document metadata and selected text safely.
- `action`: toolbar icon. Clicking it opens the side panel in Library mode.
- `storage.local`: stores only non-sensitive UI/session material such as API base URL, authenticated session data, last selected view, and temporary capture correlation IDs.

### 5.2 Required permissions

Start with the narrowest viable Manifest V3 permission set:

- `activeTab`
- `contextMenus`
- `sidePanel`
- `storage`
- `scripting`

Use `activeTab` and an explicit context-menu/action gesture instead of broad host permissions whenever possible. Add an API host permission only for the deployed backend origin and development origin.

### 5.3 Context-menu entries

Create separate entries so the payload is always clear:

- **Capture this page for Discord** — current tab URL, title, page metadata.
- **Capture selected text for Discord** — same page metadata plus selected text as a quote.
- **Capture this link for Discord** — link URL and link text, when the context menu is opened on an anchor.

Use a precise user-facing name later; these are functional placeholders.

### 5.4 Capture lifecycle

1. The user selects one context-menu action.
2. The service worker creates a UUID client-side (`captureId`).
3. It obtains the minimum capture payload: tab URL/title, selected text or link target, and extracted metadata.
4. It sends `POST /v1/resources/captures` with `captureId` as an idempotency key.
5. The backend immediately persists the resource as an Inbox item with enrichment status `preparing`.
6. The service worker opens the side panel using that `captureId`.
7. The side panel loads `GET /v1/resources/:id`, renders a preparation state, and polls or refetches until enrichment becomes `ready` or `failed`.
8. The user edits, sends to Read Later, publishes to a chosen channel, or leaves it in Inbox.

The UI must not rely on the toolbar popup staying open. The resource exists on the backend before the panel is opened.

### 5.5 Metadata extraction

Extract only data that supports the capture experience:

- `document.title`
- current page URL
- `<link rel="canonical">`, when present
- meta description
- Open Graph title, description, image, site name, and article author/published metadata when present
- selected text from the context event
- link target URL/text when capturing a link

Do not scrape or upload the full page body in v1. It creates privacy, quality, and site-compatibility complexity. The title, description, selected quote, source domain, and user edits are enough for a useful first version.

### 5.6 Side panel information architecture

Use one side-panel document with a small client-side router/state machine. No framework is required.

#### Capture view

```text
Capture
────────────────────────────────
source-domain.com
Original page title
https://source-domain.com/article

“Selected text, if captured”

Summary                         [editable]
Why it is useful                [editable]
Your note (optional)            [editable]
Tags                            [chips + picker]
Destination                     [channel selector]
AI confidence / rationale       [small disclosure]

[ Save to Read Later ] [ Publish to selected channel ]
```

Rules:

- Show a loading/skeleton state while enrichment is preparing.
- Do not disable manual editing when enrichment fails.
- A high-confidence channel can be selected by default, but remains visibly editable.
- If confidence is low, show `Choose a channel`; disable standard Publish until a channel is selected.
- **Save to Read Later** is always available after backend setup because it targets the configured existing channel.
- After successful publication, show a confirmation with an **Open in Discord** link and allow additional deliveries.

#### Library view

The Library view is an extension-first searchable list, not a full dashboard.

Initial features:

- Full-text search over title, URL/domain, summaries, notes, quote, and tags.
- Filters: Inbox, Read Later, Shared, Archived, AI preparation failed, and source domain.
- Tag filtering using English or Portuguese names/aliases.
- Sort: newest capture first by default; optionally oldest, updated, or recently published.
- Resource detail screen showing metadata, all deliveries, tags, selected quote, and external links.
- Actions: publish to another channel, send to Read Later, retry AI preparation, archive, or delete.

Use semantic HTML, `<dialog>` for destructive confirmations, Popover API for compact tag/channel pickers, CSS nesting, `:has()`, and View Transitions where they improve the interaction. They should enhance the UI rather than define correctness.

#### Settings view

Sections:

1. Connection/account status.
2. Discord connection: connected server, bot status, reconnect/disconnect.
3. Channel sync: Sync now, last sync time, imported channel count.
4. Channel routing: imported text channels with name, parent category display, Discord topic, custom routing description, active/excluded toggle.
5. Read Later channel: exactly one existing active text channel.
6. AI defaults: generated output language (`pt-BR` by default), optional default maximum tags, and later prompt/debug information.
7. Tag management: canonical tags, English/Portuguese labels, aliases, merge/rename support (the first version can be simple).

## 6. Authentication, authorization, and Discord setup

### 6.1 Security model

The system is private even though the API is publicly reachable. It needs real API authorization; a fixed secret embedded in the extension is not sufficient.

Recommended v1 approach:

1. Use Discord OAuth for the owner to authenticate from the extension.
2. The backend allows only an explicitly configured Discord owner user ID, stored in deployment environment settings.
3. The API issues a short-lived signed session/access token and a refresh mechanism appropriate for the extension.
4. The bot token remains in backend environment variables only.
5. Mistral key remains in backend environment variables only.

The exact session implementation can be a minimal signed JWT plus refresh token in the backend database. Keep tokens scoped to this application; do not expose Discord OAuth access tokens to API calls that do not need them.

### 6.2 First-run connection flow

```text
Side panel Settings
  → Connect Discord
  → Browser opens backend OAuth start route
  → User authorizes identity / bot install
  → Backend validates configured owner identity
  → User chooses one eligible guild/server
  → Bot imports accessible text channels
  → User configures routing descriptions and Read Later
  → Extension receives authenticated app session
```

Use one selected Discord guild in v1. Keep the data model workspace-aware enough to support multiple guilds later, but do not build multi-guild UI.

### 6.3 Bot permissions

Request only:

- View Channels
- Send Messages
- Embed Links

Do not request Administrator, Manage Channels, Manage Webhooks, message-content intent, or reply/message-history permissions for v1.

The bot may only publish through backend logic to imported, active text channels. It must not create or modify Discord channels.

### 6.4 Channel import and sync rules

- Import only standard text channels accessible to the bot.
- Store Discord channel ID as the stable external identifier.
- Preserve the channel name, parent category name/ID for display context, and channel topic if available.
- User-entered routing descriptions and active/excluded settings always win over sync data.
- A manual sync adds new available channels, updates names/topics, and marks unavailable channels as unavailable rather than deleting configuration/history.
- Exactly one active channel may be configured as the Read Later destination.

## 7. Domain model and database schema

### 7.1 Modeling rules

- A **resource** is the saved thing: article, tool, video, website, document, or other URL.
- A **delivery** is one publication of that resource to an external target.
- A resource can have zero, one, or many deliveries.
- One resource may be first saved privately, sent to Read Later, and later shared in one or more regular channels.
- The library is authoritative. Discord messages are immutable snapshots from the library's perspective.

### 7.2 Resource state is derived

Avoid one mutable `status` enum that cannot represent multiple deliveries accurately. Derive display filters from deliveries:

| Library state | Rule |
| --- | --- |
| Inbox | Resource has no deliveries and is not archived. |
| Read Later | Resource has at least one Read Later delivery and no regular Discord delivery. |
| Shared | Resource has at least one regular Discord delivery. It may also have a Read Later delivery. |
| Archived | `archived_at` is set, regardless of deliveries. |
| Preparing / Failed | Enrichment status used as a secondary UI state. |

### 7.3 Suggested tables

#### `workspaces`

One row in v1, representing the private installation/server configuration.

- `id` UUID primary key
- `name`
- `owner_discord_user_id`
- `default_output_language` (`pt-BR` initially)
- `read_later_channel_id` nullable FK to `channels`
- timestamps

#### `discord_connections`

- `id` UUID primary key
- `workspace_id` FK
- `discord_guild_id` unique within workspace
- `guild_name`
- `bot_user_id`
- connection status / timestamps

Store bot credentials only in deployment secrets, not this table. The table records connection identity and state.

#### `channels`

- `id` UUID primary key
- `workspace_id` FK
- `discord_channel_id` unique within workspace
- `discord_connection_id` FK
- `name`
- `parent_discord_channel_id` nullable
- `parent_name` nullable
- `discord_topic` nullable
- `routing_description` nullable user-authored text
- `is_active_for_routing` boolean
- `is_read_later` boolean (enforce a single true value per workspace)
- `availability` (`available`, `unavailable`)
- `last_synced_at`
- timestamps

#### `resources`

- `id` UUID primary key; use the client capture UUID when creating the resource
- `workspace_id` FK
- `original_url`
- `normalized_url`
- `canonical_url` nullable
- `canonical_url_key` unique per workspace for duplicate detection
- `source_domain`
- `source_language` (`en`, `pt-BR`, `unknown`, etc.)
- `output_language` (`pt-BR` default; user-overridable)
- `title`
- `description` nullable
- `site_name` nullable
- `author` nullable
- `published_at_source` nullable
- `image_url` nullable
- `selected_quote` nullable
- `summary` nullable
- `why_useful` nullable
- `personal_note` nullable
- `enrichment_status` (`preparing`, `ready`, `failed`)
- `enrichment_error` nullable
- `archived_at` nullable
- timestamps

`canonical_url_key` should be the normalized canonical URL if one is known, otherwise the normalized original URL. A unique index prevents accidental duplicate resources within the same workspace.

#### `tags`

- `id` UUID primary key
- `workspace_id` FK
- `slug` unique within workspace, e.g. `system-design`
- timestamps

#### `tag_labels`

- `id` UUID primary key
- `tag_id` FK
- `language` (`en` or `pt-BR` in v1)
- `name`
- unique (`tag_id`, `language`)

#### `tag_aliases`

- `id` UUID primary key
- `tag_id` FK
- `alias_normalized`
- optional language
- unique per workspace/normalized alias

Examples:

```text
tag slug: system-design
en label: System design
pt-BR label: Arquitetura de sistemas
aliases: system architecture, systems design, arquitetura de sistemas
```

#### `resource_tags`

- `resource_id` FK
- `tag_id` FK
- primary key (`resource_id`, `tag_id`)
- `source` (`ai`, `user`, `ai_confirmed`) for future feedback analysis

#### `enrichment_runs`

Keep enough history to improve prompts and debug failures without making the main resource table noisy.

- `id` UUID primary key
- `resource_id` FK
- `model`
- `prompt_version`
- input snapshot JSONB (no secrets)
- output JSONB
- status / error
- duration milliseconds
- timestamps

#### `deliveries`

This is the integration boundary that allows Discord now and Raindrop later.

- `id` UUID primary key
- `resource_id` FK
- `destination_type` (`discord_channel` in v1; reserve `raindrop_collection` later)
- `channel_id` nullable FK to `channels`
- `delivery_kind` (`read_later`, `share`)
- `message_snapshot` JSONB: exact title/summary/tags/quote/copy used at publishing time
- `external_message_id` nullable
- `external_url` nullable (Discord message URL)
- `status` (`pending`, `sent`, `failed`)
- `error` nullable
- `sent_at` nullable
- timestamps

Enforce a uniqueness rule that prevents accidental duplicate successful deliveries of the same resource to the same channel and delivery kind, while allowing an explicit resend feature later if desired.

#### `auth_sessions` and `oauth_states`

Keep minimal server-side records for owner sessions, refresh/revocation, and OAuth CSRF/state validation. Do not reuse resource tables for authentication data.

### 7.4 Search strategy

Use PostgreSQL full-text search first. Build a generated/search column or query vector from:

- resource title
- source domain
- URL
- summary
- why useful
- personal note
- selected quote
- bilingual tag labels and aliases

Add normal indexes for `workspace_id`, `created_at`, `archived_at`, `enrichment_status`, `canonical_url_key`, and delivery lookups. Do not add vector search in v1.

## 8. URL canonicalization and duplicate policy

### 8.1 Store both URLs

Keep these distinct fields:

- **Original URL:** exactly what the user clicked/captured.
- **Normalized URL:** original URL after safe syntactic cleanup.
- **Canonical URL:** page-provided `<link rel="canonical">` when it is valid and trustworthy.
- **Canonical key:** normalized URL used for duplicate detection.

### 8.2 Normalization rules

1. Normalize protocol/host casing and remove default ports.
2. Remove fragments only for duplicate comparison when the fragment is demonstrably empty. Preserve meaningful `#section` fragments.
3. Remove known marketing/click-tracking parameters only:
   - `utm_*`
   - `gclid`
   - `fbclid`
   - `mc_cid`, `mc_eid`
   - other well-known campaign-only parameters added deliberately to the allowlist
4. Preserve unknown query parameters; they may represent a document tab, search query, version, code example, or application state.
5. Use `<link rel="canonical">` only when it is an absolute or safely resolvable URL and does not unexpectedly cross into an unrelated host. Keep the original URL regardless.

### 8.3 Duplicate UX

If a canonical key already exists:

- Load the existing resource in the side panel.
- Make its existing tags, summary, and deliveries visible.
- Preserve the new selected quote as a candidate addition only after user confirmation; do not overwrite existing context automatically.
- Offer **Publish to another channel**, **Send to Read Later**, or **Update resource**.

## 9. AI enrichment design

### 9.1 Input to Mistral

Provide compact, structured context:

- resource title, domain, description, original/canonical URL, source language
- selected quote when present
- user-provided link text when relevant
- active importable channels: name, Discord topic, custom routing description, category display context
- existing canonical tags and bilingual labels/aliases
- a small curated sample of recent confirmed resources for each candidate channel, not the entire library
- desired output language, initially `pt-BR`

Do not send secrets or unrelated private resource history.

### 9.2 Structured output contract

Validate every AI response with Zod before persistence. The model should return data shaped conceptually like:

```ts
type EnrichmentDraft = {
  summary: string;
  whyUseful: string;
  outputLanguage: "pt-BR" | "en";
  suggestedTagSlugs: string[];
  proposedNewTags: Array<{
    english: string;
    portuguese: string;
    aliases: string[];
  }>;
  channelSuggestion: {
    channelId: string | null;
    confidence: "high" | "medium" | "low";
    reason: string;
  };
  includeQuoteInDelivery: boolean;
};
```

Rules:

- Prefer existing tags and canonical tag IDs/slugs.
- Propose a new tag only when no existing tag represents the concept.
- Keep tags focused and few; set a hard maximum in validation.
- Use Portuguese for generated summary and usefulness context by default.
- Preserve original title and quote language.
- Return `channelId: null` or low confidence rather than forcing a weak routing decision.
- Never output Discord message payloads or attempt to publish.

### 9.3 Human feedback loop

The useful signal is the final decision, not merely the model output. Persist:

- suggested channel versus final selected channel
- suggested tags versus confirmed/removed tags
- whether AI context was edited/replaced
- resources that used Read Later after a low-confidence suggestion

Use this data as compact examples in later prompt versions. Do not imply that this is model training; it is prompt-context improvement.

### 9.4 Failure behavior

- If Mistral is unavailable, rate-limited, malformed, or times out, retain the Inbox resource with raw captured metadata.
- Set `enrichment_status = failed` and show a useful error state.
- Allow manual fields and manual publishing without AI.
- Offer **Retry AI preparation** as an explicit action.
- Make retries idempotent and record each run in `enrichment_runs`.

## 10. Discord delivery design

### 10.1 REST API wrapper

Build a small internal Discord client around `fetch`. It should:

- add the bot Authorization header server-side
- set `allowed_mentions: { parse: [] }`
- serialize validated message payloads
- handle response parsing/errors/rate-limit information
- expose narrow functions, e.g. `listGuildChannels`, `createChannelMessage`
- be injected/mocked in tests

Do not use a full Discord SDK or maintain a Gateway connection.

### 10.2 Regular-channel message snapshot

Send a consistent custom embed:

```text
Title (links to original source)
Short summary of what it is.

Why it is useful: …

Optional selected quote/context

Tags: TypeScript · Ferramentas de build
```

Guidelines:

- Keep the embed short and scannable.
- Title points directly to the resource URL.
- Use the output language for AI-generated copy, defaulting to Portuguese.
- Include selected quote only when the AI/user marks it useful.
- Include personal note when present; it can supplement or replace AI-generated usefulness context.
- Escape/limit content to Discord field limits before sending.

### 10.3 Read Later message snapshot

Use a deliberately lighter format:

```text
Read later · Original title
Short summary
Optional selected quote
```

Do not require a large "why useful" explanation for unread material. The resource remains fully editable in the library.

### 10.4 Delivery transaction and retries

1. Validate the resource, destination channel, and authenticated workspace.
2. Create a `deliveries` record with `pending` status and a complete message snapshot.
3. Send the Discord API request.
4. On success, store Discord message ID, message URL, timestamp, and `sent` status.
5. On failure, store a safe error summary and `failed` status.
6. Allow explicit retry of failed deliveries using the same snapshot or a newly reviewed snapshot.

Use a transaction/unique guard around delivery creation to avoid double sends from repeated clicks. The UI must make the publish action pending/disabled while the request is active.

## 11. API surface

Use versioned Hono routes, Zod request/response schemas, and a consistent error envelope. The exact route names can evolve, but preserve the domain boundaries below.

### Authentication and setup

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/v1/auth/discord/start` | Begin owner OAuth and bot-install flow. |
| `GET` | `/v1/auth/discord/callback` | Validate state, owner identity, and create extension session handoff. |
| `GET` | `/v1/setup/discord/guilds` | List eligible connected guilds for selection. |
| `POST` | `/v1/setup/discord/guild` | Select the one v1 guild and import channels. |
| `POST` | `/v1/channels/sync` | Manual text-channel sync. |

### Resources and enrichment

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/v1/resources/captures` | Idempotently create private Inbox resource and start enrichment. |
| `GET` | `/v1/resources` | Search/filter/paginate library. |
| `GET` | `/v1/resources/:resourceId` | Resource detail with tags, enrichment, and deliveries. |
| `PATCH` | `/v1/resources/:resourceId` | Edit fields, tags, language, selected quote, notes, and archive state. |
| `POST` | `/v1/resources/:resourceId/enrichment/retry` | Explicitly retry Mistral enrichment. |
| `DELETE` | `/v1/resources/:resourceId` | Permanently delete resource after confirmation. |

### Channels, tags, and settings

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/v1/channels` | List imported channel routing configuration. |
| `PATCH` | `/v1/channels/:channelId` | Edit description, active state, and Read Later selection. |
| `GET` | `/v1/tags` | List/search canonical tags with labels and aliases. |
| `POST` | `/v1/tags` | Create a user-confirmed canonical bilingual tag. |
| `PATCH` | `/v1/settings` | Update defaults such as generated output language. |

### Deliveries

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/v1/resources/:resourceId/deliveries/read-later` | Create a delivery to the configured Read Later channel. |
| `POST` | `/v1/resources/:resourceId/deliveries/discord` | Create a regular Discord channel delivery. |
| `POST` | `/v1/deliveries/:deliveryId/retry` | Retry failed delivery. |

## 12. Repository structure

Use a simple monorepo-like layout without adding a workspace tool unless it becomes useful:

```text
.
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ app.ts
│  │  │  ├─ server.ts
│  │  │  ├─ routes/
│  │  │  ├─ services/
│  │  │  ├─ repositories/
│  │  │  ├─ integrations/
│  │  │  │  ├─ discord-client.ts
│  │  │  │  └─ mistral-client.ts
│  │  │  ├─ domain/
│  │  │  └─ lib/
│  │  ├─ drizzle/
│  │  │  ├─ schema.ts
│  │  │  └─ migrations/
│  │  └─ deno.json
│  └─ extension/
│     ├─ src/
│     │  ├─ background/
│     │  ├─ content/
│     │  ├─ sidepanel/
│     │  ├─ shared/
│     │  └─ styles/
│     ├─ public/
│     ├─ manifest.json
│     └─ tsconfig.json
├─ packages/
│  └─ contracts/               # optional shared Zod schemas/types
├─ docs/
│  └─ decisions.md
├─ deno.json
└─ README.md
```

Keep browser-specific code out of the API and keep API secrets/types out of the extension build.

## 13. Environment configuration

Use Deno Deploy environment variables/secrets for the API. Never commit these values.

```text
DATABASE_URL=
MISTRAL_API_KEY=
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_OAUTH_REDIRECT_URI=
APP_SESSION_SIGNING_SECRET=
OWNER_DISCORD_USER_ID=
ALLOWED_EXTENSION_ORIGINS=
```

The extension build needs only non-secret configuration, for example:

```text
API_BASE_URL=
```

For development, use a separate Discord app/configuration or controlled redirect URLs and a local PostgreSQL database. Do not point development builds at production secrets by default.

## 14. Implementation phases

### Phase 0 — Foundation and local developer experience

**Goal:** establish a maintainable project skeleton before product integration.

- [ ] Initialize Deno project and API application with Hono.
- [ ] Configure TypeScript strict mode, linting, formatting, and Deno tests.
- [ ] Set up Drizzle schema/migrations with Deno PostgreSQL and `pg`.
- [ ] Add environment validation with Zod at process startup.
- [ ] Create basic health endpoint and structured error response.
- [ ] Initialize plain Manifest V3 extension build setup with TypeScript, HTML, CSS modules, service worker, and side panel.
- [ ] Add a documented local setup path and `.env.example` files without secrets.

**Acceptance criteria:** API starts locally, migrations run against a local database, extension loads unpacked, side panel opens from toolbar action, and tests run in one command.

### Phase 1 — Manual vertical slice without AI or Discord OAuth

**Goal:** prove the core resource model and capture UX before adding external complexity.

- [ ] Implement URL normalization/canonicalization unit tests.
- [ ] Create `resources`, tags, and delivery schema/migrations.
- [ ] Implement idempotent `POST /resources/captures`.
- [ ] Extract page metadata and selected quote in extension.
- [ ] Context menu creates backend Inbox resource and opens side panel by client capture ID.
- [ ] Build Capture view with editable title, URL, quote, summary, note, tags, and a mock/manual channel selector.
- [ ] Build a minimal Library list/detail view.
- [ ] Implement duplicate-resource UX for same canonical URL.

**Acceptance criteria:** capture a page, close the panel, reopen the extension, find the resource, edit it, and verify it is not duplicated by a tracking URL variant.

### Phase 2 — Discord authentication, bot setup, and channel configuration

**Goal:** securely connect one Discord server and make manual publishing possible.

- [ ] Create Discord application and bot configuration; document redirect URLs and least-privilege permissions.
- [ ] Implement owner-only Discord OAuth/session flow.
- [ ] Implement guild selection and text-channel import.
- [ ] Create channel settings UI for descriptions, active/excluded status, and Read Later selection.
- [ ] Implement manual channel sync preserving user configuration.
- [ ] Build minimal typed Discord `fetch` client.
- [ ] Implement regular-channel and Read Later delivery APIs with message snapshots.
- [ ] Store Discord message IDs/URLs and show delivery history in resource detail.

**Acceptance criteria:** select an existing Read Later channel, publish a resource to it, publish the same resource to a different text channel, and open both resulting Discord message links from the library.

### Phase 3 — AI enrichment and routing assistance

**Goal:** make capture faster while preserving explicit user control.

- [ ] Add Mistral client and strict Zod structured-output validation.
- [ ] Persist enrichment runs and status/error data.
- [ ] Generate Portuguese summaries and usefulness context by default.
- [ ] Suggest existing bilingual tags and propose new tags conservatively.
- [ ] Suggest channels using imported descriptions and a small set of confirmed examples.
- [ ] Implement confidence behavior: high may preselect, low leaves channel empty.
- [ ] Implement failed/retry state and manual fallback.
- [ ] Record final user corrections for future prompt context.

**Acceptance criteria:** capture several varied pages; AI output is editable, low-confidence output never auto-publishes, malformed/failed AI output leaves an editable Inbox item, and confirmed tag/channel changes persist.

### Phase 4 — Library quality and operational hardening

**Goal:** make the tool genuinely useful months later.

- [ ] Add PostgreSQL full-text search and filters.
- [ ] Add bilingual tag search/alias behavior and simple tag management.
- [ ] Add archive/delete flows and confirmations.
- [ ] Add delivery retry behavior and idempotency safeguards.
- [ ] Improve empty/loading/error states and side-panel keyboard accessibility.
- [ ] Add audit-friendly logs without secrets or full credentials.
- [ ] Add Deno Deploy production configuration and automated migrations.
- [ ] Document backup/export expectations for PostgreSQL data.

**Acceptance criteria:** find a resource by Portuguese tag alias, English tag label, domain, title, or personal note; safely retry an intentionally failed delivery; and deploy a clean environment with migrations.

### Phase 5 — Deferred enhancements

Only start after v1 has been used enough to reveal real friction.

- [ ] Raindrop delivery adapter/collection mapping.
- [ ] Explicit update/resend Discord message action.
- [ ] Optional user-selected full-page analysis.
- [ ] Better channel-specific examples and prompt evaluation dataset.
- [ ] Saved searches, bulk tagging, and exported data.
- [ ] Other browsers if the plain extension architecture remains portable.

## 15. Testing strategy

### Unit tests

- URL normalization and tracking parameter policy.
- Canonical URL selection and duplicate key calculation.
- Bilingual tag normalization and alias resolution.
- Derived Library state from deliveries/archive status.
- AI structured-output parsing and fallback paths.
- Discord embed/message payload formatter, field limits, and `allowed_mentions` policy.
- Channel-selection rules, including low-confidence behavior.

### Integration tests

- Drizzle migrations against a disposable PostgreSQL database.
- Capture creation is idempotent by client capture ID.
- Duplicate canonical URL returns existing resource correctly.
- Channel sync preserves custom routing descriptions and Read Later selection.
- Delivery transaction prevents double send for repeated publish requests.
- Mistral/Discord clients are mocked through injected `fetch` implementations.

### Extension/manual tests

- Capture current page, selected text, and clicked link.
- Close the panel while enrichment is still running; resource remains in Inbox.
- Capture a URL with `utm_*` and then the clean URL; verify one resource.
- Capture docs URL with query/fragment; verify meaningful URL parts are preserved.
- Confirm toolbar opens Library and context menu opens Capture.
- Verify keyboard navigation, focus management in `<dialog>`, and readable narrow side-panel layout.

### Production smoke test

- Authenticate owner.
- Sync channels from the selected server.
- Capture a known public article.
- Publish once to Read Later and once to a normal text channel.
- Confirm message URL is stored and resource is searchable.

## 16. Operational safeguards

- Validate every external request/response at the boundary with Zod or narrow type guards.
- Configure CORS only for the extension origin(s) and local development as necessary.
- Never log Discord bot tokens, Mistral keys, OAuth codes, session tokens, or full Authorization headers.
- Use short request timeouts and descriptive retryable/non-retryable errors for Mistral and Discord.
- Respect Discord rate limits; serialize/retry only where safe and never blindly duplicate a delivery.
- Sanitize user-provided/AI-generated Discord content and disable all mentions.
- Apply database migrations before serving a new production deployment.
- Use database constraints for unique canonical resource keys, one Read Later channel, tag labels, aliases, and delivery deduplication.

## 17. Definition of done for v1

V1 is complete when the owner can:

1. Install the extension and authenticate securely.
2. Connect one Discord server and import its text channels.
3. Configure descriptions for routing and choose an existing Read Later channel.
4. Right-click a page, link, or selected text and immediately create a durable Inbox resource.
5. See a prepared Portuguese AI draft, edit it, accept/reject tag and channel suggestions, or continue manually if AI fails.
6. Send the resource to Read Later or a selected Discord text channel.
7. Send the same resource to multiple channels without creating duplicate library entries.
8. Return later and find the resource through library search/filters/tags.
9. Open the original URL or any recorded Discord message delivery.
10. Trust that the bot cannot manage server structure or send messages without an explicit extension action.

## 18. Guidance for the implementation agent

- Implement in small vertical slices; do not scaffold every deferred feature before proving capture → persistence → delivery.
- Prefer domain services and repository functions over route handlers containing business rules.
- Keep backend contracts in shared Zod schemas when that reduces drift; avoid forcing backend code into the extension bundle.
- Do not introduce React, Svelte, WXT, a Discord SDK, an ORM alternative, vector database, or a queue system unless a concrete requirement proves the current approach insufficient.
- Do not add a standalone dashboard in v1.
- Preserve the distinction between resource metadata and delivery snapshots.
- Keep AI suggestion and final user choice separate in the data model.
- Do not expand Discord permissions beyond the approved minimal set without an explicit product decision.
- Favor understandable TypeScript and modern browser APIs over abstractions that hide lifecycle behavior.
- Add tests at the point where domain behavior becomes non-obvious, especially for URL identity, deliveries, channel routing, and AI parsing.

## 19. Open items intentionally deferred

These are not blockers for Phase 0/1 and should be decided only when implementation reaches them:

- Final product name, icon, visual identity, and exact copy language for the extension UI.
- Exact session token/refresh implementation details after validating Discord OAuth needs.
- Whether high-confidence AI routing should be preselected immediately or require an additional click; the current plan permits preselection but never auto-publication.
- Exact maximum summary, note, quote, and tag limits based on Discord embed constraints and real usage.
- Whether to expose the AI routing rationale in the initial Capture UI or behind a disclosure.
- Criteria for allowing user-confirmed new tags versus requiring existing-tag selection.
- When to add explicit Discord message update/re-send behavior.
- Raindrop collection mapping and conflict policy.

