# CLAUDE.md

Guidance for Claude Code and AI assistants working in this repository.

## Project Overview

**Easy Noter** is an AI-powered meeting notes application built with Next.js App Router (TypeScript). Users record or upload meeting audio, which is transcribed and converted into structured notes, then can chat with an AI about the meeting context.

**Product flow:**
1. Sign in → `/auth/login` or `/auth/sign-up`
2. Create meeting via live recording (`components/audio-recorder.tsx`) or file upload (`components/audio-uploader.tsx`) at `/dashboard/new`
3. Processing pipeline: audio → transcription (Whisper) → structured notes (GPT-4o-mini)
4. Review summary, action items, transcript at `/dashboard/[id]`
5. Chat with AI about the meeting (`components/meeting-chat.tsx`)
6. Attach external source documents for contextual Q&A (`components/source-manager.tsx`)
7. Pin/unpin meetings for quick access (`PATCH /api/meetings/[id]/pin`)
8. Global chat across all meetings via `chat-bar.tsx` (uses `/api/chat/global`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 (strict) |
| Database / Auth / Storage | Supabase (PostgreSQL + RLS, Auth, Storage) |
| AI | OpenAI Whisper (transcription), GPT-4o-mini (notes + chat), AI SDK v6 |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI primitives, lucide-react icons |
| Forms | react-hook-form + Zod |
| Notifications | sonner (primary) |
| Rate Limiting | Upstash Redis (optional — conditionally enabled) |
| Testing | Vitest 4, jsdom, @testing-library/react |
| Package Manager | **pnpm** (use `pnpm`, not `npm` or `yarn`) |
| Markdown | react-markdown |
| Panels | react-resizable-panels |
| Document Parsing | pdf-parse (PDF text extraction), jszip |
| Drawer | vaul |

---

## Development Commands

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # ESLint (app/, components/, hooks/, lib/)
pnpm typecheck    # tsc --noEmit
pnpm test         # Run all Vitest tests once
pnpm test:watch   # Vitest in watch mode
pnpm test:ui      # Vitest UI dashboard
```

**Always run `pnpm lint` and `pnpm test` before considering a task complete.**

---

## Repository Structure

```
app/
├── api/                           # API route handlers (colocated tests: route.test.ts)
│   ├── chat/
│   │   ├── route.ts               # Per-meeting AI chat streaming (maxDuration=60s)
│   │   └── global/route.ts        # Global chat across all meetings (maxDuration=60s)
│   ├── generate-notes/            # Notes generation from transcript (maxDuration=60s)
│   ├── transcribe/                # Audio → text via Whisper (maxDuration=120s)
│   ├── sources/                   # Source document upload/list/delete (maxDuration=30s)
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
├── manifest.ts                    # PWA manifest
├── robots.ts                      # robots.txt generation
├── sitemap.ts                     # XML sitemap generation
├── icon.tsx                       # Favicon generation
├── apple-icon.tsx                 # Apple icon generation
└── page.tsx                       # Public landing page

components/
├── ui/                            # Reusable Radix/shadcn primitives (button, dialog, tabs, etc.)
├── app-sidebar.tsx                # Navigation sidebar + user profile dropdown + theme toggle
├── auth-page-layout.tsx           # Layout wrapper for auth pages with branding panel
├── meeting-detail-wrapper.tsx     # Split-pane: detail + chat panel
├── meeting-detail.tsx             # Summary/Actions/Transcript tabs with resizable ScrollablePanel
├── meeting-chat.tsx               # AI streaming chat panel (per-meeting)
├── audio-recorder.tsx             # Live recording UI
├── audio-uploader.tsx             # File upload UI
├── processing-view.tsx            # Real-time processing progress
├── source-manager.tsx             # Attached document manager
├── meetings-list.tsx              # Dashboard meetings list
├── chat-bar.tsx                   # Floating global chat bar (AI chat across all meetings)
├── landing-cta.tsx                # Landing page CTA section
├── landing-hero.tsx               # Landing page hero section
├── landing-features.tsx           # Landing page features showcase
├── logo.tsx                       # App logo component
├── theme-provider.tsx             # next-themes ThemeProvider wrapper
└── theme-toggle.tsx               # Standalone theme toggle (sun/moon/system)

hooks/
├── use-audio-recorder.ts          # Audio recording logic
└── use-mobile.ts                  # Mobile breakpoint detection

lib/
├── types.ts                       # Domain interfaces: Meeting, ActionItem, MeetingStatus, MeetingSource
├── utils.ts                       # cn() helper (clsx + tailwind-merge)
├── api-helpers.ts                 # errorResponse() utility for consistent API error shapes
├── chat-storage.ts                # LocalStorage chat message persistence (50-chat limit per meeting)
├── meeting-pipeline.ts            # Client-side pipeline: readApiError(), waitForMeetingCompletion()
├── note-normalization.ts          # normalizeStringArray(), normalizeActionItems() for schema validation
├── openai.ts                      # OpenAI singleton client initialization
├── prompts.ts                     # NOTES_GENERATION_PROMPT constant
├── schemas.ts                     # generatedNotesSchema Zod schema for notes validation
├── type-guards.ts                 # isStringArray(), isActionItemArray() type guards
├── __tests__/                     # Tests for lib utilities (e.g. chat-storage.test.ts)
└── supabase/
    ├── client.ts                  # Browser Supabase client (client components)
    ├── server.ts                  # Server Supabase client (server components, API routes)
    ├── admin.ts                   # Admin client (service role key — privileged operations only)
    └── proxy.ts                   # Middleware session refresh helper

styles/
└── globals.css                    # Tailwind v4 @theme inline config + CSS custom properties (oklch)

scripts/                           # SQL migrations (run in numbered order)
proxy.ts                           # Next.js middleware (session refresh + /dashboard auth redirect)
vitest.config.ts                   # Vitest config: jsdom environment, @vitejs/plugin-react
vitest.setup.ts                    # Global test setup: next/server mocks, env vars
```

---

## Key Conventions

### TypeScript
- Strict mode. Explicit types for public interfaces and API payloads. No implicit `any`.
- Use `@/` path aliases — no deep relative imports (e.g., `@/lib/types`, `@/components/ui/button`).
- Match existing style in files you touch (quotes, semicolons).

### Styling
- **Tailwind CSS v4** — design tokens defined in `styles/globals.css` via `@theme inline` and CSS custom properties. **Do not** use a `tailwind.config.ts` file.
- Colors use **oklch** color space throughout.
- Always use `cn()` from `lib/utils.ts` for conditional or merged class names.
- Use semantic tokens (`bg-card`, `text-foreground`, `border-border`) — **never** hardcode light/dark colors.
- Icons: **lucide-react** only.

### Components
- Mark `'use client'` only where required (event handlers, hooks, browser APIs). Default to server components.
- Reuse `components/ui/*` primitives. Do not re-implement them.
- Notifications: use `toast()` from **sonner**.
- Fonts: Geist (sans) and Geist Mono (mono) via `next/font/google`.

### API Routes
Every API route must:
1. Export `maxDuration` (chat=60, transcribe=120, generate-notes=60, sources=30, pin=10, process=30, worker=300).
2. Authenticate the user with Supabase before any data access.
3. Enforce ownership: `.eq('user_id', user.id)` on every query.
4. Return consistent error shapes: `{ error: string, code: string }` with proper HTTP status codes (`400`, `401`, `404`, `429`, `500`).
5. Follow the conditional rate-limiting pattern (see below).

Use `errorResponse()` from `@/lib/api-helpers` to return errors consistently.

### Supabase Client Selection
| Context | Import |
|---|---|
| Client component | `@/lib/supabase/client` |
| Server component / API route | `@/lib/supabase/server` |
| Middleware session refresh | `@/lib/supabase/proxy` |
| Admin / privileged ops | `@/lib/supabase/admin` |

Never use a server Supabase client in client components, or vice versa.

### Rate Limiting Pattern
The window varies by route: use `'10 s'` for chat endpoints and `'1 m'` for processing triggers.

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

---

## Meeting Status Lifecycle

```
recording → uploading → transcribing → generating → done
                                 ↘          ↘
                                   error ←←←←←
```

- Always transition **forward** or to `error`. Never skip steps or go backward.
- On any processing failure: update `status = 'error'` and set `error_message` in the catch block.

---

## Async Processing System

Meeting audio processing runs asynchronously via a job queue stored in the `processing_jobs` table:

1. `/api/meetings/[id]/process` — enqueues a job (requires `SUPABASE_SERVICE_ROLE_KEY`)
2. `/api/processing/worker` — background worker that picks up and executes jobs
   - Secured with `CRON_SECRET` bearer token
   - Uses lock-based concurrency control (10-minute lock timeout)
   - Retry logic with exponential backoff; `MAX_TRANSCRIPT_CHARS = 400,000`
   - Job statuses: `queued | running | retrying | completed | failed`

**Client-side polling** is handled by `lib/meeting-pipeline.ts` (`waitForMeetingCompletion()`).

---

## Chat Storage

Chat messages are persisted client-side in **localStorage** via `lib/chat-storage.ts`:
- Per-meeting chat: key `noter-chat-{meetingId}`, capped at 50 messages
- Global chat (across all meetings): key `noter-chat-__global__`, same 50-message cap
- Do not persist sensitive data or large payloads in chat storage.

---

## AI / LLM Configuration

| Task | Model | SDK | Notes |
|---|---|---|---|
| Transcription | `whisper-1` | `openai` SDK directly | `response_format: 'text'` |
| Notes generation | `gpt-4o-mini` | `openai` SDK directly | `temperature: 0.3`, JSON output |
| Chat (per-meeting) | `gpt-4o-mini` | AI SDK v6 (`streamText`) | Streaming `UIMessage` responses |
| Chat (global) | `gpt-4o-mini` | AI SDK v6 (`streamText`) | Streaming; all-meetings context |

**Content truncation safeguards** (enforce these on every AI call):
- Per-meeting chat: transcript ≤ 300,000 chars, each source ≤ 50,000 chars
- Global chat: combined meeting context ≤ 100,000 chars
- Notes generation: transcript ≤ 400,000 chars

---

## Testing

- Tests are **colocated** with route handlers: `app/api/*/route.test.ts`. Do not use `__tests__/` for API tests.
- Lib utility tests live in `lib/__tests__/`.
- `vitest.setup.ts` mocks `next/server` and sets environment variables automatically.
- Standard mock targets: `@/lib/supabase/server`, `ai`, `@ai-sdk/openai`, `@upstash/ratelimit`, `@upstash/redis`.
- When changing API behavior, add or update the colocated `route.test.ts`.

---

## Data Model

### `meetings` table
- `id`, `user_id`, `title`, `audio_url`, `audio_duration`
- `transcript`, `summary`, `detailed_notes` (nullable text)
- `action_items`, `key_decisions`, `topics`, `follow_ups` (JSONB arrays)
- `status` (`MeetingStatus`), `error_message`
- `is_pinned` (boolean, default false) — pinned meetings sort first per user
- RLS enabled — users access only their own rows.

### `meeting_sources` table
- `id`, `meeting_id`, `user_id`, `name`, `file_type`, `content`
- Cascade deletes on `meeting_id` and `user_id`. RLS enabled.

### `processing_jobs` table
- Tracks async processing jobs; see `scripts/004_create_processing_jobs_table.sql`.

### `meeting-audio` storage bucket (private)
- Path pattern: `{user_id}/{meeting_id}.{ext}`
- RLS policies scope access by user folder.

### Schema changes
Add a new numbered SQL script in `scripts/` (e.g., `006_*.sql`). Keep app code backward-compatible until the migration is applied.

**Applied migrations:**
- `scripts/001_create_meetings_table.sql`
- `scripts/002_create_storage_bucket.sql`
- `scripts/003_create_meeting_sources_table.sql`
- `scripts/004_create_processing_jobs_table.sql`
- `scripts/005_add_pinned_column.sql` — adds `is_pinned` to `meetings`

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | All Supabase clients |
| `OPENAI_API_KEY` | Yes | Transcription, notes generation, chat |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for async processing | Admin operations and job queueing |
| `CRON_SECRET` | Required for async processing | Authorizes calls to `/api/processing/worker` |
| `UPSTASH_REDIS_REST_URL` | Optional | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Rate limiting |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Optional | Override Supabase auth redirect URL in development |

---

## Anti-Patterns to Avoid

- Skipping `user_id` ownership checks in server routes
- Using the wrong Supabase client for the runtime context
- Adding `'use client'` unnecessarily to server components
- Re-implementing `components/ui/*` primitives instead of reusing them
- Using Tailwind v3 config syntax (`tailwind.config.ts`)
- Hardcoding colors instead of using CSS custom property tokens
- Omitting `maxDuration` exports on new API routes
- Forgetting rate limiting on new long-running or abuse-sensitive routes
- Returning inconsistent error shapes — always use `errorResponse()` from `@/lib/api-helpers`
- Skipping `status = 'error'` recovery in processing routes on failure
- Embedding large content in AI prompts without truncation safeguards
- Storing large payloads or sensitive data in localStorage chat storage
- Mixing unrelated refactors into a single commit
- Committing `.env` files, secrets, or API keys

---

## Recommended Workflow

1. Read the relevant source files before making any changes.
2. Implement the smallest correct change for the task.
3. Run `pnpm lint` and `pnpm test` — fix any failures.
4. Verify edge cases: unauthenticated requests, missing IDs, ownership failures, empty data.
5. Write a clear commit message describing what changed and why.
