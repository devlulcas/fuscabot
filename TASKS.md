# Discord Link Library implementation backlog

This backlog turns `discord-link-library-plan.md` into mergeable work units.
Tasks are ordered by dependency, not merely by product phase.

## Wave 1 — foundation and durable manual capture

- [ ] **W1.1 Shared contracts and domain rules** — capture/resource schemas,
      error envelope, URL identity, derived library state, tag normalization,
      tests.
- [ ] **W1.2 API foundation** — Hono server, environment validation,
      health/error handling, Drizzle schema/migration, injectable repositories,
      capture CRUD.
- [ ] **W1.3 Extension foundation** — MV3 manifest, explicit metadata
      extraction, durable capture request, side-panel router and manual
      Capture/Library/Settings states.
- [ ] **W1.4 Developer experience** — root tasks, environment examples, local
      setup, extension build/load instructions, CI.
- [ ] **W1.5 Vertical-slice integration** — consume shared contracts from API
      and extension, run capture end-to-end, remove temporary mock boundaries.

## Wave 2 — owner authentication and Discord delivery

- [ ] **W2.1 Session security** — OAuth state storage, owner allow-list,
      short-lived access and rotating/revocable refresh tokens.
- [ ] **W2.2 Discord OAuth setup** — start/callback flow, guild eligibility and
      one-guild selection.
- [ ] **W2.3 Channel synchronization** — text-channel-only import, preserve user
      routing configuration, unavailable-channel handling.
- [ ] **W2.4 Channel settings UI** — routing descriptions, active toggle,
      exactly one Read Later channel, sync status.
- [ ] **W2.5 Discord REST client** — injected `fetch`,
      timeouts/errors/rate-limit metadata, no Gateway or SDK.
- [ ] **W2.6 Delivery vertical slice** — immutable snapshots, mention
      suppression, deduplication, Read Later and regular sends, delivery
      history.

## Wave 3 — AI-assisted preparation

- [ ] **W3.1 Mistral boundary** — structured-output request, strict validation,
      timeout/error classification, injected `fetch`.
- [ ] **W3.2 Enrichment orchestration** — persist run before external work,
      ready/failed transitions, idempotent explicit retry.
- [ ] **W3.3 Tag suggestions** — prefer canonical bilingual tags, conservatively
      propose new tags, persist suggestion/final-choice split.
- [ ] **W3.4 Routing suggestions** — bounded channel context, confidence rules,
      never auto-publish.
- [ ] **W3.5 Capture preparation UI** — polling/refetch, editable AI copy,
      rationale disclosure, manual failure fallback.

## Wave 4 — library quality and operations

- [ ] **W4.1 PostgreSQL search** — weighted full-text index/query over metadata,
      notes, quotes, labels, and aliases.
- [ ] **W4.2 Library filters and tag management** — derived Inbox/Read
      Later/Shared states, archive/delete, bilingual lookup and merge/rename.
- [ ] **W4.3 Retry and concurrency hardening** — delivery locks/unique guards,
      retry snapshots, repeated-click tests.
- [ ] **W4.4 Accessibility and resilience** — keyboard flows, focus management,
      narrow layout, empty/loading/error states.
- [ ] **W4.5 Observability and privacy** — structured redacted logs, safe
      external errors, request correlation.
- [ ] **W4.6 Deployment** — migration command, Deno Deploy app config after
      organization/app selection, environment contexts, smoke test,
      backup/export notes.

## External prerequisites

- Discord application/client ID, client secret, bot token, redirect URI, and
  configured owner Discord user ID.
- Mistral API key.
- Deno Deploy organization/app choice and assigned PostgreSQL database.
- Final extension API origin and Chrome extension ID for production CORS/OAuth
  handoff.
