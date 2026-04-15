# Chat Endpoint Investigation — 2026-04-15

**Context:** Phase 2 of the Workspace redesign will consolidate the three chat endpoints into one. This document records the current state so the consolidation can be done safely.

## /api/chat/route.ts
- **LOC:** 173
- **Methods:** POST only
- **Request schema:**
  ```ts
  z.object({
    meetingId: z.string().trim().min(1),          // required
    messages: z.array(z.unknown()).max(100).default([]),
    model: z.enum(['gpt-5-mini', 'gpt-5.4']).optional(),
    searchEnabled: z.boolean().optional().default(false),
  })
  ```
- **What it does:** Authenticated endpoint for chatting about a single meeting. Verifies the requesting user owns the `meetingId` via a Supabase `.eq('user_id', user.id)` guard. Builds a context string from up to ten meeting fields (`title`, `transcript`, `summary`, `detailed_notes`, `action_items`, `key_decisions`, `topics`, `follow_ups`, `document_content`, `tiptapToPlainText(document_content)`). Optionally calls `searchWeb()` (Tavily) when `searchEnabled` is true and prepends a web-search block to the system prompt. Streams the response via Vercel AI SDK `streamText` → `toUIMessageStreamResponse`. Rate-limited per `user.id` (sliding window: 10 req / 10 s) when Upstash Redis env vars are present. Transcript is capped at `MAX_CHAT_TRANSCRIPT_CHARS`.
- **Dependencies:**
  - `@sentry/nextjs` — error capture
  - `ai` — `gateway`, `streamText`, `UIMessage`
  - `@upstash/ratelimit`, `@upstash/redis` — rate limiting
  - `zod` — request validation
  - `@/lib/supabase/server` — `createClient` (auth + DB)
  - `@/lib/api-helpers` — `errorResponse`
  - `@/lib/type-guards` — `isStringArray`, `isActionItemArray`
  - `@/lib/ai-models` — `resolveChatModel`, `resolveChatModelId`
  - `@/lib/chat-message-utils` — `buildChatModelMessages`, `getLastUserText`
  - `@/lib/tiptap-converter` — `tiptapToPlainText`
  - `@/lib/tavily` — `searchWeb`
  - `@/lib/truncation-limits` — `MAX_CHAT_TRANSCRIPT_CHARS`
- **Callers:** `components/chat-bar.tsx` (lines 132–135) via `DefaultChatTransport`. The transport is selected when `activeScope === 'meeting'`. The `meetingId` is passed as a static `body` field on the transport; `model` and `searchEnabled` are sent per-message via `sendMessage`'s `body` option (line 311). The `ChatBar` is rendered by `components/floating-chat-host.tsx` (line 98), which is mounted in the global `app/layout.tsx` (line 46).
- **Is it reachable from the UI?** Yes — when the user navigates to `/dashboard/[id]` (where `[id]` is not `new` or `templates`), `FloatingChatHost` sets `defaultScope: "meeting"` and passes the meeting ID. The `ChatBar` wires up the meeting-scoped transport, making this endpoint the active one. The user triggers a call by typing a message and submitting.

---

## /api/chat/support/route.ts
- **LOC:** 81
- **Methods:** POST only
- **Request schema:**
  ```ts
  z.object({
    messages: z.array(z.unknown()).default([]),
  })
  ```
- **What it does:** Unauthenticated endpoint (no Supabase auth check) for the landing-page support bot. Validates total message character length against `MAX_MESSAGES_TOTAL_LENGTH` (10,000 chars) as a payload guard. Streams a response with `SUPPORT_CHAT_SYSTEM_PROMPT` (imported from `@/lib/prompts`) which constrains the model to answering only noter product questions. Uses `DEFAULT_CHAT_MODEL` only — no model override. No tools, no DB access, no web search. Rate-limited per forwarded IP rather than user ID (sliding window: 10 req / 1 min).
- **Dependencies:**
  - `@sentry/nextjs` — error capture
  - `ai` — `gateway`, `streamText`, `UIMessage`
  - `@upstash/ratelimit`, `@upstash/redis` — rate limiting
  - `zod` — request validation
  - `@/lib/api-helpers` — `errorResponse`
  - `@/lib/ai-models` — `DEFAULT_CHAT_MODEL`, `resolveChatModel`
  - `@/lib/chat-message-utils` — `buildChatModelMessages`
  - `@/lib/prompts` — `SUPPORT_CHAT_SYSTEM_PROMPT`
- **Callers:** `components/chat-bar.tsx` (line 125) via `DefaultChatTransport`. Selected when `activeScope === 'support'`. No extra body fields are sent (the `body` option is `undefined` for support scope, per line 309). Rendered by `FloatingChatHost` in the global layout.
- **Is it reachable from the UI?** Yes — on the landing page (`pathname === '/'`), `FloatingChatHost` sets `defaultScope: "support"` and `authenticated: false`. This is the only scope available on that route, so every chat submission on the landing page hits this endpoint. Also reachable in the authenticated app: the `ChatBar`'s `ChatComposer` exposes a scope-toggle button when `allowGlobalToggle` is true, and support is one of the available scopes in the `STARTER_PROMPTS` record, meaning authenticated users can also switch to it from the dashboard.

---

## /api/chat/global/route.ts
- **LOC:** 109
- **Methods:** POST only
- **Request schema:**
  ```ts
  z.object({
    messages: z.array(z.unknown()).default([]),
    model: z.enum(['gpt-5-mini', 'gpt-5.4']).optional(),
    searchEnabled: z.boolean().optional().default(false),
  })
  ```
- **What it does:** Authenticated endpoint for cross-meeting chat. Verifies auth via Supabase, then fetches up to 100 of the user's most recent meetings (ordered by `created_at` DESC). Passes them through `buildGlobalChatContext()` (from `@/lib/global-chat-context`) which assembles a single context string capped at `MAX_GLOBAL_CONTEXT_CHARS` (100,000 chars), with per-meeting document and transcript sub-caps. Optionally calls `searchWeb()` when `searchEnabled` is true. Streams a response with an inline system prompt instructing the model to attribute answers to specific meetings. Rate-limited per `user.id` (same sliding window as `/api/chat`). Returns 404 if the user has no meetings.
- **Dependencies:**
  - `@sentry/nextjs` — error capture
  - `ai` — `gateway`, `streamText`, `UIMessage`
  - `@upstash/ratelimit`, `@upstash/redis` — rate limiting
  - `zod` — request validation
  - `@/lib/supabase/server` — `createClient` (auth + DB)
  - `@/lib/api-helpers` — `errorResponse`
  - `@/lib/ai-models` — `resolveChatModel`, `resolveChatModelId`
  - `@/lib/chat-message-utils` — `buildChatModelMessages`, `getLastUserText`
  - `@/lib/tavily` — `searchWeb`
  - `@/lib/global-chat-context` — `buildGlobalChatContext`, `GlobalChatMeetingRow`
- **Callers:** `components/chat-bar.tsx` (line 129) via `DefaultChatTransport`. Selected when `activeScope === 'global'`. `model` and `searchEnabled` are sent per-message via `sendMessage`'s `body` option (line 311, same as meeting scope; `body` is omitted only for support). Rendered by `FloatingChatHost` in the global layout.
- **Is it reachable from the UI?** Yes — on any authenticated `/dashboard` route that is not a specific meeting (e.g., `/dashboard`), `FloatingChatHost` sets `defaultScope: "global"`. When a meeting IS open, `allowGlobalToggle` is true, which means `ChatComposer` renders a scope-toggle UI so the user can switch between `meeting` and `global` scopes — making this endpoint reachable from the meeting page too.

---

## Overlap analysis

**What the three endpoints have in common:**
- All use `POST` only.
- All use Vercel AI SDK `streamText` → `toUIMessageStreamResponse` for streaming.
- All use the `gateway()` wrapper from `ai` to route through the AI gateway.
- All parse the request with Zod, returning 400 on parse failure.
- All use `buildChatModelMessages` from `@/lib/chat-message-utils` to process the messages array.
- All capture exceptions with Sentry and return a 500 via `errorResponse`.
- All initialize Upstash rate limiting from the same env vars, just with different keys and windows.
- All accept the same `messages: z.array(z.unknown())` field.

**Where they differ:**

| Dimension | `/api/chat` | `/api/chat/support` | `/api/chat/global` |
|---|---|---|---|
| Auth required | Yes (Supabase user) | No (IP-based rate limit) | Yes (Supabase user) |
| Rate limit key | `chat_${user.id}` / 10 per 10 s | `support_chat_${ip}` / 10 per 1 min | `global_chat_${user.id}` / 10 per 10 s |
| Required body fields | `meetingId` (required) | none | none |
| Model selection | Yes (`model` field) | No (hardcoded `DEFAULT_CHAT_MODEL`) | Yes (`model` field) |
| Web search | Yes (`searchEnabled` flag) | No | Yes (`searchEnabled` flag) |
| DB access | Yes — single meeting by `meetingId` + `user_id` | None | Yes — up to 100 meetings by `user_id` |
| System prompt | Inline, built from single-meeting context | Static constant (`SUPPORT_CHAT_SYSTEM_PROMPT`) | Inline, built from multi-meeting context |
| Context builder | Manual inline assembly + `tiptapToPlainText` | None | `buildGlobalChatContext()` |
| Payload size guard | `MAX_CHAT_TRANSCRIPT_CHARS` on transcript | `MAX_MESSAGES_TOTAL_LENGTH` (10,000 chars total) | `MAX_GLOBAL_CONTEXT_CHARS` (100,000 chars) |

**Can they be unified under a single route with a `context` discriminator?** Yes — the structural differences are all expressible via a discriminated union in the request body. A `context` (or `scope`) field with values `'meeting' | 'global' | 'support'` would gate the auth check, DB query, context assembly, and rate-limit key. The support branch is the most distinct (no auth, static prompt, no model override), but it can be handled as a conditional path rather than a separate file. The pattern already exists implicitly in `ChatBar`'s transport selection logic.

---

## Recommendation for Phase 2

- **Keep:** `/api/chat/route.ts` as the consolidation target (rename/expand it to handle all scopes).
- **Delete:** `/api/chat/support/route.ts` and `/api/chat/global/route.ts` after migration.
- **Merge into:** A single `POST /api/chat` route accepting:
  ```ts
  z.discriminatedUnion('scope', [
    z.object({
      scope: z.literal('meeting'),
      meetingId: z.string().trim().min(1),
      messages: z.array(z.unknown()).max(100).default([]),
      model: z.enum(['gpt-5-mini', 'gpt-5.4']).optional(),
      searchEnabled: z.boolean().optional().default(false),
    }),
    z.object({
      scope: z.literal('global'),
      messages: z.array(z.unknown()).max(100).default([]),
      model: z.enum(['gpt-5-mini', 'gpt-5.4']).optional(),
      searchEnabled: z.boolean().optional().default(false),
    }),
    z.object({
      scope: z.literal('support'),
      messages: z.array(z.unknown()).max(100).default([]),
    }),
  ])
  ```
  The route handler branches on `scope` after parsing: skip auth for `support`, skip DB for `support`, use the static prompt for `support`, use per-meeting context for `meeting`, and `buildGlobalChatContext` for `global`. Rate-limit keys should remain differentiated (e.g., `chat_meeting_${userId}`, `chat_global_${userId}`, `chat_support_${ip}`).

  The `ChatBar` caller in `components/chat-bar.tsx` will need to be updated: instead of three separate `DefaultChatTransport` instances pointing to three URLs, use a single transport pointing to `/api/chat` and include `scope` in the per-message `body`. Since `meetingId` is currently on the static transport body (not per-message), that field will also move to the per-message body.

- **Migration risk:** Low. The three endpoints are fully isolated (no shared state, no shared rate-limit namespace). The only caller is `ChatBar` (one file). The Zod schema change is additive from the client's perspective — adding `scope` is the only breaking change, and the client already knows the active scope. Test files exist for all three routes and will need to be consolidated, but coverage is straightforward. The one non-trivial concern is the support branch's no-auth behavior: the consolidated route must not accidentally gate it behind the auth check that the meeting and global branches require.
