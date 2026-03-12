# CLAUDE.md

Guidance for AI assistants working in this repository.

## Project Overview

**Easy Noter** is an AI-powered meeting notes application built with Next.js App Router (TypeScript). Users record or upload meeting audio, which is transcribed and converted into structured, editable notes. They can then chat with an AI about the meeting context.

**Product flow:**
1. Sign in → `/auth/login` or `/auth/sign-up`
2. Create meeting via live recording (`components/audio-recorder.tsx`) or file upload (`components/audio-uploader.tsx`) at `/dashboard/new`
3. Processing pipeline: audio → transcription (Deepgram/Whisper) → structured notes (GPT-4o-mini)
4. Review and edit notes in the rich-text editor (`components/meeting-workspace.tsx`, `components/meeting-note-surface.tsx`)
5. Chat with AI about the meeting (`components/floating-chat-host.tsx`, routed via `ChatSurfaceScope`)
6. Attach external source documents (`components/source-manager.tsx`)
7. Pin/unpin meetings (`PATCH /api/meetings/[id]/pin`)
8. Global chat across all meetings (`/api/chat/global`)
9. AI note enhancement suggestions reviewed in `meeting-note-surface.tsx`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 (strict) |
| Database / Auth / Storage | Supabase (PostgreSQL + RLS, Auth, Storage) |
| AI | Deepgram (transcription), OpenAI / AI Gateway (notes + chat), AI SDK v6 |
| Rich Text Editor | Tiptap v3 (StarterKit + extensions) |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI primitives, lucide-react |
| Forms | react-hook-form + Zod |
| Notifications | sonner |
| Rate Limiting | Upstash Redis (optional — conditionally enabled) |
| Testing | bun:test, happy-dom, @testing-library/react |
| Package Manager | **bun** (use `bun`, not `pnpm`, `npm`, or `yarn`) |
| Misc | react-markdown, react-resizable-panels, vaul, pdf-parse, jszip |

---

## Development Commands

```bash
bun run dev          # Start development server
bun run build        # Production build
bun run lint         # ESLint (app/, components/, hooks/, lib/)
bun run typecheck    # tsc --noEmit
bun run test         # Run all tests once (bun:test)
bun run test:watch   # Tests in watch mode
```

**Always run `bun run lint` and `bun run test` before considering a task complete.**

---

## Repository Structure

```
app/
├── api/
│   ├── chat/
│   │   ├── route.ts               # Per-meeting AI chat streaming (maxDuration=60s)
│   │   ├── global/route.ts        # Global chat across all meetings (maxDuration=60s)
│   │   └── support/route.ts       # Support/assistant chat endpoint
│   ├── generate-notes/            # Notes generation from transcript (maxDuration=60s)
│   ├── transcribe/                # Audio → text (maxDuration=120s)
│   ├── sources/                   # Source document upload/list/delete (maxDuration=30s)
│   ├── note-templates/            # CRUD for custom note templates
│   ├── meetings/[id]/
│   │   ├── route.ts               # Meeting CRUD
│   │   ├── pin/route.ts           # Pin/unpin meeting (maxDuration=10s)
│   │   └── process/route.ts       # Trigger async processing (maxDuration=30s)
│   └── processing/
│       └── worker/route.ts        # Background job worker (maxDuration=300s)
├── auth/                          # Login, sign-up, error pages
├── dashboard/                     # Protected pages (list, [id] detail, new)
│   └── layout.tsx                 # Dashboard layout: SidebarProvider + AppSidebar + header
├── layout.tsx                     # Root layout: fonts, SEO, ThemeProvider, Toaster, Analytics
├── globals.css                    # Tailwind v4 @theme inline config + CSS custom properties (oklch)
└── page.tsx                       # Public landing page

components/
├── ui/                            # Reusable Radix/shadcn primitives
├── app-sidebar.tsx                # Navigation sidebar + user profile dropdown + theme toggle
├── auth-page-layout.tsx           # Layout wrapper for auth pages
├── meeting-workspace.tsx          # Main meeting workspace (notes editor + chat + sources)
├── meeting-note-surface.tsx       # Tiptap rich-text note editor with enhancement overlay
├── meeting-editor.tsx             # Tiptap editor wrapper
├── meeting-detail.tsx             # Summary/Actions/Transcript tab view
├── meeting-detail-wrapper.tsx     # Split-pane layout container
├── floating-chat-host.tsx         # Floating chat panel (per-meeting, global, or support)
├── assistant-shell-context.tsx    # Context provider for chat surface scope
├── chat-bar.tsx                   # Global chat bar UI
├── chat-message-attachments.tsx   # Attachment rendering in chat messages
├── transcript-drawer.tsx          # Transcript viewer in a side drawer
├── template-quick-pick.tsx        # Note template selector
├── audio-recorder.tsx             # Live recording UI
├── audio-uploader.tsx             # File upload UI
├── processing-view.tsx            # Real-time processing progress
├── source-manager.tsx             # Attached document manager
├── meetings-list.tsx              # Dashboard meetings list
├── landing-*.tsx                  # Landing page sections
└── theme-*.tsx                    # Theme provider and toggle

hooks/
├── use-audio-recorder.ts          # Audio recording logic
└── use-mobile.ts                  # Mobile breakpoint detection

lib/
├── types.ts                       # Domain types: Meeting, ActionItem, MeetingStatus, DiarizedSegment,
│                                  #   NoteTemplate, EnhancementStatus, ChatSurfaceScope, etc.
├── utils.ts                       # cn() helper (clsx + tailwind-merge)
├── api-helpers.ts                 # errorResponse() for consistent API error shapes
├── ai-models.ts                   # Chat model IDs, labels, resolver functions
├── prompts.ts                     # AI prompt constants
├── schemas.ts                     # Zod schemas for AI output validation
├── chat-storage.ts                # localStorage chat persistence (50-message cap)
├── chat-attachments.ts            # Chat attachment helpers
├── chat-message-utils.ts          # Chat message formatting utilities
├── meeting-pipeline.ts            # waitForMeetingCompletion(), readApiError()
├── meeting-workspace.ts           # Workspace state helpers
├── meeting-editor-extensions.ts  # Tiptap extension configuration
├── tiptap-converter.ts            # Convert AI output ↔ Tiptap JSON
├── note-normalization.ts          # normalizeStringArray(), normalizeActionItems()
├── note-template.ts               # Built-in note template definitions
├── templates.ts                   # Template prompt expansion
├── draft-proposal.ts              # AI note enhancement draft/proposal logic
├── enhancement-context.ts         # Enhancement context builder
├── enhancement-errors.ts          # Enhancement error types
├── document-hash.ts               # Content hashing for document sync
├── document-sync.ts               # Detects when notes are out of sync
├── attachment-kind.ts             # Attachment type classification
├── transcript-formatter.ts        # Transcript display formatting
├── global-chat-context.ts         # Global chat context builder
├── file-text.ts                   # File → text extraction utilities
├── openai.ts                      # OpenAI singleton client
├── tavily.ts                      # Tavily search client (web search for chat)
├── type-guards.ts                 # isStringArray(), isActionItemArray()
└── supabase/
    ├── client.ts                  # Browser Supabase client
    ├── server.ts                  # Server Supabase client
    ├── admin.ts                   # Admin client (service role — privileged ops only)
    └── proxy.ts                   # Middleware session refresh helper

proxy.ts                           # Next.js middleware (session refresh + /dashboard auth guard)
bunfig.toml                        # Bun config: test preload files
happydom.ts                        # DOM globals for bun:test
test.setup.ts                      # Global test setup: mocks + env vars
```

---

## Key Conventions

### Code Architecture & Quality
- **Always prefer the best architecture**: small composable modules, single responsibility, clean abstractions. Avoid monolithic components or functions.
- **Prefer explicit over clever**: clear naming, obvious data flow, no magic side effects.
- Use existing utilities and abstractions before inventing new ones; check `lib/` first.
- Keep business logic in `lib/`, UI state in components, server logic in API routes.

### TypeScript
- Strict mode. Explicit types for public interfaces and API payloads. No implicit `any`.
- Use `@/` path aliases — no deep relative imports (`@/lib/types`, `@/components/ui/button`).
- Match existing code style (quotes, semicolons, formatting) in every file you touch.

### Styling
- **Tailwind CSS v4** — tokens in `app/globals.css` via `@theme inline`. **No** `tailwind.config.ts`.
- Colors use **oklch** color space throughout.
- Always use `cn()` from `lib/utils.ts` for conditional or merged class names.
- Semantic tokens only (`bg-card`, `text-foreground`, `border-border`) — never hardcode colors.
- Icons: **lucide-react** only.

### Components
- Mark `'use client'` only where required (event handlers, hooks, browser APIs). Default to server components.
- Reuse `components/ui/*` primitives. Do not re-implement them.
- Notifications: `toast()` from **sonner**.
- Tiptap editor: use `lib/meeting-editor-extensions.ts` for extension config; convert content via `lib/tiptap-converter.ts`.

### API Routes
Every API route must:
1. Export `maxDuration` (see structure above for per-route values).
2. Authenticate the user with Supabase before any data access.
3. Enforce ownership: `.eq('user_id', user.id)` on every query.
4. Return `{ error: string, code: string }` with proper HTTP status (`400`, `401`, `404`, `429`, `500`).
5. Follow the conditional rate-limiting pattern.

Use `errorResponse()` from `@/lib/api-helpers`.

### Supabase Client Selection
| Context | Import |
|---|---|
| Client component | `@/lib/supabase/client` |
| Server component / API route | `@/lib/supabase/server` |
| Middleware session refresh | `@/lib/supabase/proxy` |
| Admin / privileged ops | `@/lib/supabase/admin` |

Never cross-use server vs. client Supabase clients.

### Rate Limiting Pattern
```typescript
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(10, '10 s') })
    : null

if (ratelimit) {
  const { success } = await ratelimit.limit(user.id)
  if (!success) return errorResponse('Rate limit exceeded', 'RATE_LIMITED', 429)
}
```
Window: `'10 s'` for chat, `'1 m'` for processing triggers.

### AI Models
Defined in `lib/ai-models.ts`. Use helpers (`resolveChatModel`, `getChatModelLabel`) — never hardcode model strings in routes.

| Task | Model |
|---|---|
| Transcription | Deepgram (`@deepgram/sdk`) |
| Notes generation | `gpt-4o-mini` (direct OpenAI SDK) |
| Note enhancement | `ENHANCEMENT_MODEL` from `lib/ai-models.ts` |
| Chat (per-meeting / global) | `resolveChatModel()` via AI SDK v6 `streamText` |

**Content truncation safeguards (enforce on every AI call):**
- Per-meeting chat: transcript ≤ 300,000 chars, each source ≤ 50,000 chars
- Global chat: combined context ≤ 100,000 chars
- Notes generation: transcript ≤ 400,000 chars

---

## Meeting Status Lifecycle

```
recording → uploading → transcribing → generating → done
                                 ↘          ↘
                                   error ←←←←←
```

- Always transition **forward** or to `error`. Never skip steps or go backward.
- On any processing failure: set `status = 'error'` and `error_message` in the catch block.

---

## Async Processing System

1. `/api/meetings/[id]/process` — enqueues a job (`processing_jobs` table, requires `SUPABASE_SERVICE_ROLE_KEY`)
2. `/api/processing/worker` — background worker secured with `CRON_SECRET` bearer token
   - Lock-based concurrency (10-minute lock timeout), retry with exponential backoff
   - `MAX_TRANSCRIPT_CHARS = 400,000`

Client-side polling: `waitForMeetingCompletion()` in `lib/meeting-pipeline.ts`.

---

## Chat Storage

Persisted client-side via `lib/chat-storage.ts`:
- Per-meeting: key `noter-chat-{meetingId}`, capped at 50 messages
- Global: key `noter-chat-__global__`, same cap
- Do not store sensitive data or large payloads.

---

## Testing

- API route tests are **colocated**: `app/api/*/route.test.ts`.
- Component tests are **colocated**: `components/*.test.tsx`.
- Lib utility tests live in `lib/__tests__/`.
- `test.setup.ts` mocks `next/server` and sets env vars (preloaded via `bunfig.toml`).
- Use `mock.module()` and `mock()` from `bun:test`. Standard mock targets: `@/lib/supabase/server`, `@/lib/openai`, `ai`, `@ai-sdk/openai`, `@upstash/ratelimit`, `@upstash/redis`.
- When changing API or component behavior, add or update the colocated test file.

---

## Data Model

### `meetings` table
- `id`, `user_id`, `title`, `audio_url`, `audio_duration`
- `transcript`, `summary`, `detailed_notes` (nullable text)
- `action_items`, `key_decisions`, `topics`, `follow_ups` (JSONB arrays)
- `document_content` (JSONB — Tiptap editor document)
- `template_id` (references `note_templates`)
- `diarized_transcript` (JSONB array of `DiarizedSegment`)
- `status` (`MeetingStatus`), `error_message`
- `is_pinned` (boolean, default false)
- `enhancement_status`, `enhancement_state` (JSONB)
- RLS enabled.

### `meeting_sources` table
- `id`, `meeting_id`, `user_id`, `name`, `file_type`, `content`
- Cascade deletes. RLS enabled.

### `processing_jobs` table
- Async processing queue; see `scripts/004_create_processing_jobs_table.sql`.

### `note_templates` table
- Custom user note templates; see `app/api/note-templates/`.

### `meeting-audio` storage bucket (private)
- Path: `{user_id}/{meeting_id}.{ext}`

### Schema changes
Add a new numbered SQL script in `scripts/` (e.g., `006_*.sql`). Keep app code backward-compatible until applied.

**Applied migrations:** `001` → `005` (meetings table, storage bucket, sources, processing jobs, is_pinned column).

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---:|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | All Supabase clients |
| `OPENAI_API_KEY` | Yes | Notes generation, chat |
| `SUPABASE_SERVICE_ROLE_KEY` | For async processing | Admin ops and job queueing |
| `CRON_SECRET` | For async processing | Authorizes `/api/processing/worker` |
| `DEEPGRAM_API_KEY` | Yes | Audio transcription |
| `AI_GATEWAY_API_KEY` | Optional | Routes AI calls through AI gateway |
| `TAVILY_API_KEY` | Optional | Web search in chat |
| `UPSTASH_REDIS_REST_URL` | Optional | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Rate limiting |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Optional | Auth redirect override in dev |

---

## Anti-Patterns to Avoid

- Skipping `user_id` ownership checks in server routes
- Using the wrong Supabase client for the runtime context
- Adding `'use client'` unnecessarily to server components
- Re-implementing `components/ui/*` primitives
- Using Tailwind v3 config syntax (`tailwind.config.ts`)
- Hardcoding colors instead of using CSS custom property tokens
- Hardcoding AI model strings — use `lib/ai-models.ts` helpers
- Omitting `maxDuration` on new API routes
- Forgetting rate limiting on long-running or abuse-sensitive routes
- Returning inconsistent error shapes — always use `errorResponse()`
- Omitting `status = 'error'` recovery in processing routes
- Embedding large content in AI prompts without truncation safeguards
- Storing sensitive data in localStorage chat storage
- Building monolithic components or functions — prefer composition
- Committing `.env` files, secrets, or API keys

---

## Recommended Workflow

1. Read the relevant source files before making any changes.
2. Implement the smallest correct change; prefer well-architected, composable code over quick patches.
3. Run `bun run lint` and `bun run test` — fix all failures.
4. Verify edge cases: unauthenticated requests, missing IDs, ownership failures, empty data.
5. Write a clear commit message describing what changed and why.