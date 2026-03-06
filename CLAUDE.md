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

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 (strict) |
| Database / Auth / Storage | Supabase (PostgreSQL + RLS, Auth, Storage) |
| AI | OpenAI Whisper (transcription), GPT-4o-mini (notes + chat), AI SDK v6 |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI primitives, lucide-react icons |
| Forms | react-hook-form + Zod |
| Notifications | sonner (primary), Radix toast (legacy hook exists) |
| Rate Limiting | Upstash Redis (optional — conditionally enabled) |
| Testing | Vitest 4, jsdom, @testing-library/react |
| Package Manager | **pnpm** (use `pnpm`, not `npm` or `yarn`) |

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
├── api/                     # API route handlers (colocated tests: route.test.ts)
│   ├── chat/route.ts        # AI chat streaming (maxDuration=60s)
│   ├── generate-notes/      # Notes generation from transcript (maxDuration=60s)
│   ├── transcribe/          # Audio → text via Whisper (maxDuration=120s)
│   ├── sources/             # Source document upload/list/delete (maxDuration=30s)
│   ├── meetings/[id]/       # Meeting CRUD + processing trigger
│   └── processing/          # Async processing worker
├── auth/                    # Login, sign-up, error pages
├── dashboard/               # Protected pages (list, [id] detail, new)
│   └── layout.tsx           # Dashboard layout: SidebarProvider + AppSidebar + header
├── layout.tsx               # Root layout: fonts, SEO, ThemeProvider, Toaster, Analytics
└── page.tsx                 # Public landing page

components/
├── ui/                      # Reusable Radix/shadcn primitives (button, dialog, tabs, etc.)
├── app-sidebar.tsx          # Navigation sidebar + user profile dropdown + theme toggle
├── meeting-detail-wrapper.tsx # Split-pane: detail + chat panel
├── meeting-detail.tsx       # Summary/Actions/Transcript tabs with resizable ScrollablePanel
├── meeting-chat.tsx         # AI streaming chat panel
├── audio-recorder.tsx       # Live recording UI
├── audio-uploader.tsx       # File upload UI
├── processing-view.tsx      # Real-time processing progress
├── source-manager.tsx       # Attached document manager
├── meetings-list.tsx        # Dashboard meetings list
├── chat-bar.tsx             # Floating chat bar (AI chat shortcut)
├── landing-cta.tsx          # Landing page CTA section
├── logo.tsx                 # App logo component
└── theme-toggle.tsx         # Standalone theme toggle (sun/moon/system)

hooks/
├── use-audio-recorder.ts    # Audio recording logic
├── use-toast.ts             # Radix toast hook (legacy; prefer sonner)
└── use-mobile.ts            # Mobile breakpoint detection

lib/
├── types.ts                 # Domain interfaces: Meeting, ActionItem, MeetingStatus, MeetingSource
├── utils.ts                 # cn() helper (clsx + tailwind-merge)
└── supabase/
    ├── client.ts            # Browser Supabase client (client components)
    ├── server.ts            # Server Supabase client (server components, API routes)
    ├── admin.ts             # Admin client (service role key — privileged operations only)
    └── proxy.ts             # Middleware session refresh helper

styles/
└── globals.css              # Tailwind v4 @theme inline config + CSS custom properties (oklch)

scripts/                     # SQL migrations (run in numbered order)
proxy.ts                     # Next.js middleware (session refresh + /dashboard auth redirect)
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
- Notifications: use `toast()` from **sonner**. The `use-toast` hook is legacy.
- Fonts: Geist (sans) and Geist Mono (mono) via `next/font/google`.

### API Routes
Every API route must:
1. Export `maxDuration` (chat=60, transcribe=120, generate-notes=60, sources=30).
2. Authenticate the user with Supabase before any data access.
3. Enforce ownership: `.eq('user_id', user.id)` on every query.
4. Return consistent error shapes: `{ error: string, code: string }` with proper HTTP status codes (`400`, `401`, `404`, `429`, `500`).
5. Follow the conditional rate-limiting pattern (see below).

### Supabase Client Selection
| Context | Import |
|---|---|
| Client component | `@/lib/supabase/client` |
| Server component / API route | `@/lib/supabase/server` |
| Middleware session refresh | `@/lib/supabase/proxy` |
| Admin / privileged ops | `@/lib/supabase/admin` |

Never use a server Supabase client in client components, or vice versa.

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

## AI / LLM Configuration

| Task | Model | SDK | Notes |
|---|---|---|---|
| Transcription | `whisper-1` | `openai` SDK directly | `response_format: 'text'` |
| Notes generation | `gpt-4o-mini` | `openai` SDK directly | `temperature: 0.3`, JSON output |
| Chat | `gpt-4o-mini` | AI SDK v6 (`streamText`) | Streaming `UIMessage` responses |

**Content truncation safeguards** (enforce these on every AI call):
- Chat: transcript ≤ 300,000 chars, each source ≤ 50,000 chars
- Notes generation: transcript ≤ 400,000 chars

---

## Testing

- Tests are **colocated** with route handlers: `app/api/*/route.test.ts`. Do not use `__tests__/`.
- Non-route tests are also **colocated** with implementation files using `*.test.ts` (example: `lib/chat-storage.test.ts`).
- Use `__tests__/` directories nowhere in this repo.
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
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Admin operations |
| `UPSTASH_REDIS_REST_URL` | Optional | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Rate limiting |

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
- Returning inconsistent error shapes across similar failure cases
- Skipping `status = 'error'` recovery in processing routes on failure
- Embedding large content in AI prompts without truncation safeguards
- Mixing unrelated refactors into a single commit
- Committing `.env` files, secrets, or API keys

---

## Recommended Workflow

1. Read the relevant source files before making any changes.
2. Implement the smallest correct change for the task.
3. Run `pnpm lint` and `pnpm test` — fix any failures.
4. Verify edge cases: unauthenticated requests, missing IDs, ownership failures, empty data.
5. Write a clear commit message describing what changed and why.

### Hook location convention
- Place shared React hooks only in `hooks/` and import them via `@/hooks/*`.
- Do not add hook files under `components/ui/` (e.g., `use-toast`, `use-mobile`); use the canonical copies in `hooks/`.
