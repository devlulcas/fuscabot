# Hono client migration questions

This file records the decisions that guided the extension API refactor. The
answers are preserved below for reference.

## Current extension call surface

Before the migration, the extension's JSON API calls were centralized in
`apps/extension/src/shared/api.ts`; React Query modules and the service worker
consumed that `api` facade. The current client calls the same supported
endpoints directly through Hono RPC:

- `POST /v1/resources/captures`
- `GET`, `PATCH`, and `DELETE /v1/resources/:id`
- `GET /v1/resources` with search, filtering, sorting, pagination, and
  enrichment query parameters
- `POST /v1/resources/bulk-actions`
- `POST` and `DELETE /v1/resources/:id/publication`
- `POST /v1/resources/:id/deliveries/read-later`
- `POST /v1/resources/:id/enrichment/retry`
- `POST /v1/deliveries/:id/retry`
- `GET /v1/auth/session` and `POST /v1/auth/logout`
- `GET /v1/setup/discord/guilds`
- `POST /v1/discord/channels/sync`
- `GET /v1/channels` and `PATCH /v1/channels/:id`
- `GET /v1/tags`, `POST /v1/tags`, `PATCH /v1/tags/:id`, and
  `POST /v1/tags/:id/merge`

The Discord connection flow separately constructs `/v1/auth/discord/start` and
opens it with `chrome.identity.launchWebAuthFlow`. It is a browser OAuth
redirect flow, not a normal JSON request.

## Questions

1. **Authentication transport:** Should the Hono client use a custom `fetch`
   implementation that loads extension config, adds the Bearer token, performs
   the existing single-flight refresh on `401`, retries once, and runs session
   invalidation?

   Recommended: yes. Keep this policy in one custom fetch wrapper while using
   `hc<AppType>` for typed URL construction and request/response contracts. The
   alternative is keeping authentication outside `hc` and passing headers
   manually for each call.

<ANSWER>
Yes. Keep this policy in one custom fetch wrapper while using `hc<AppType>` for typed URL construction and request/response contracts.
</ANSWER>

1. **Token refresh endpoint:** Should `/v1/auth/refresh` remain a direct fetch
   inside the custom fetch wrapper, without an `Authorization` header, as it is
   today?

   Recommended: yes. This avoids recursive refresh and preserves the current
   rotating-token behavior.

<ANSWER>
Yes.
</ANSWER>

1. **Runtime base URL and client lifetime:** Because the API base URL is
   configurable and stored in Chrome storage, should the extension create an
   `hc<AppType>` client for each current configuration, or maintain a client
   factory keyed by base URL?

   Recommended: use a small client factory or per-configuration instance and
   recreate it when the configured API URL changes.

<ANSWER>
Remove this piece of configuration. We always use the production url (Even locally)
</ANSWER>

1. **Cookies and credentials:** The scan found no cookie-based authentication in
   the extension; it currently authenticates with Bearer tokens. Should the
   client omit `credentials: "include"`?

   Recommended: omit it unless backend authentication moves to cookies. Hono RPC
   supports passing `credentials: "include"` through the request `init` when
   that becomes necessary.

<ANSWER>
omit it unless backend authentication moves to cookies
</ANSWER>

1. **Response parsing and runtime validation:** Should the migration preserve
   runtime validation of `ResourceSchema`, `DeliverySchema`, `ApiErrorSchema`,
   and the compatibility handling for delivery responses, as well as the current
   `204` behavior?

   Recommended: yes. Hono RPC gives compile-time types, but it does not replace
   runtime validation or the extension's existing error and compatibility
   behavior.

<ANSWER>
If a schema is being used by the extension to check the response we should remove it and trust the backend api. If a schema is being shared between the extension and the api we should put it on the packages/contracts, this can happen on request payload validations like form validations and stuff like that. Also, we do not need all those parseSomething methods, most of then (maybe all) should be removed and those who are being used to perform mappings of API response to Extension Internal Objects should be placed in the api directories inside each route module as a .select.ts file and used in the .queries.ts queryOptions({ select: ... }).
</ANSWER>

1. **Global error typing:** Should the exported `AppType` be augmented with
   Hono's `ApplyGlobalResponse` pattern so client errors are represented in RPC
   types, or should the extension continue treating error bodies as `ApiError`
   at runtime?

   Recommended: preserve runtime `ApiError` handling regardless. Add global
   error typing only if it can be done without broadening or rewriting the
   existing success response types.

<ANSWER>
Use ApplyGlobalResponse. Rewrite whatever needed.
</ANSWER>

1. **Response helper:** Should the wrapper use Hono's `parseResponse()` helper,
   or retain explicit `Response` handling for custom errors, `204`, and
   compatibility parsing?

   Recommended: retain explicit response handling in the adapter. The current
   error envelope and response parsing are part of the extension behavior.

<ANSWER>
yes use parseResponse() helper
</ANSWER>

1. **OAuth flow:** Should the Discord connect flow remain URL construction plus
   `chrome.identity.launchWebAuthFlow`, with only authenticated JSON API calls
   migrated to `hc`?

   Recommended: yes. It depends on the browser redirect API rather than a normal
   RPC request.
   <ANSWER>

yes. It depends on the browser redirect API rather than a normal RPC request.
</ANSWER>

1. **API facade shape:** Should the existing domain-level `api` facade remain in
   place, with its methods delegating to typed Hono client calls, or should
   React Query and service-worker callers use Hono client paths directly?

   Recommended: retain the facade initially. This limits unrelated caller
   changes while allowing the transport and endpoint typing to move to Hono RPC.

<ANSWER>
React Query and service-worker callers should use Hono client paths directly
</ANSWER>

1. **Unused API routes:** The extension currently does not call the resource
   delivery-list/share routes or health routes. Should the refactor migrate only
   the current call surface, leaving all other routes available through
   `AppType` for later use?

   Recommended: migrate only current extension calls and leave unused routes
   exposed through the generated client type.

<ANSWER>
Remove the unused api endpoints
</ANSWER>

1. **Cancellation:** Should every Hono request continue accepting React Query's
   `AbortSignal` through the request `init` argument?

   Recommended: yes. Preserve cancellation by mapping each caller's signal to
   Hono's per-request `init` option.

<ANSWER>
yes
</ANSWER>

1. **Path and query serialization:** Should the refactor use Hono RPC's
   parameter/query fields for all IDs and filters, replacing the current manual
   URL construction and `encodeURIComponent` calls?

   Recommended: yes. The API IDs are UUIDs and the query values are scalar
   fields, so the standard Hono serializer should be sufficient. A custom
   `buildSearchParams` function should only be introduced if compatibility tests
   reveal a need for special array or encoding behavior.

<ANSWER>
yes. The API IDs are UUIDs and the query values are scalar fields, so the standard Hono serializer should be sufficient. A custom `buildSearchParams` function should only be introduced if compatibility tests reveal a need for special array or encoding behavior.
</ANSWER>
