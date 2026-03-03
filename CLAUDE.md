# CLAUDE.md

Claude Code guidance for the **easy-noter** repository. For full contributor details see `AGENTS.md`.

---

## Project Overview

**easy-noter** is a Next.js 16 / React 19 application that records meetings, transcribes audio via OpenAI Whisper, generates structured notes with GPT-4o-mini, and lets users chat with meeting content. Backend data and auth are handled by Supabase; rate limiting uses Upstash Redis.

Deployed at: `https://noter1.vercel.app`

---

## Essential Commands

```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # ESLint check — run before committing
pnpm test         # Run Vitest suite once
pnpm test:watch   # Vitest in watch mode
pnpm test:ui      # Vitest UI
```

Always run `pnpm lint` and `pnpm test` before committing changes to API routes or shared utilities.

---

## Repository Layout

```
app/
  page.tsx                       # Public landing page
  layout.tsx                     # Root layout: fonts, SEO, ThemeProvider, Toaster
  auth/                          # Login, sign-up, sign-up-success, error pages
  dashboard/
    layout.tsx                   # SidebarProvider + AppSidebar + header
    page.tsx                     # Meetings list
    [id]/page.tsx                # Meeting detail
    new/page.tsx                 # Record / upload new meeting
    error.tsx / loading.tsx
  api/
    chat/route.ts                # Streaming chat (AI SDK streamText, gpt-4o-mini)
    transcribe/route.ts          # Audio transcription (OpenAI Whisper)
    generate-notes/route.ts      # Structured note generation (gpt-4o-mini)
    sources/route.ts             # Source upload / list / delete

components/
  meeting-detail.tsx             # Main meeting detail UI (tabs + ScrollablePanel)
  meeting-detail-wrapper.tsx     # Split-pane: detail + chat panel
  meeting-chat.tsx               # AI chat sidebar panel
  audio-recorder.tsx             # Live recording UI
  audio-uploader.tsx             # File upload UI
  processing-view.tsx            # Real-time processing progress
  source-manager.tsx             # Source file management
  app-sidebar.tsx                # Dashboard sidebar (nav, profile, theme toggle)
  meetings-list.tsx              # Dashboard meeting list
  landing-hero.tsx               # Landing page hero section
  landing-features.tsx           # Landing page features section
  theme-provider.tsx             # next-themes wrapper
  ui/                            # Reusable shadcn/ui Radix primitives

hooks/
  use-audio-recorder.ts
  use-toast.ts
  use-mobile.ts

lib/
  types.ts                       # Meeting, ActionItem, MeetingStatus, MeetingSource
  utils.ts                       # cn() class name helper
  supabase/
    client.ts                    # Browser Supabase client
    server.ts                    # Server-side Supabase client
    proxy.ts                     # Middleware session refresh helper

styles/globals.css               # Design tokens, light/dark themes, Tailwind v4 @theme
scripts/                         # Numbered SQL migration scripts (run in order)
proxy.ts                         # Next.js middleware (Supabase session refresh + auth redirect)
```

---

## Key Architecture Decisions

### Supabase Clients — Use the Right One

| Context | Import |
|---|---|
| Client components / browser | `@/lib/supabase/client` |
| Server components / API routes | `@/lib/supabase/server` |
| Middleware (proxy.ts) | `@/lib/supabase/proxy` |

Never cross these boundaries. Do not store server Supabase clients in globals.

### Auth & Ownership — Always Enforced

Every server route that touches meeting or source data must:
1. Call `supabase.auth.getUser()` and return `401` if no user.
2. Add `.eq('user_id', user.id)` to all queries before read/update/delete.

Never trust client-provided ownership identifiers.

### Meeting Status Lifecycle

```
recording → uploading → transcribing → generating → done
                                ↘          ↘
                                  error ←←←←←
```

- Transitions are forward-only (or to `error`).
- Processing routes (`transcribe`, `generate-notes`) must catch errors and update `status: 'error'` with an `error_message`.

### API Routes — Mandatory Exports

Every route file must export:
- `maxDuration` (seconds): chat=60, transcribe=120, generate-notes=60, sources=30.
- Rate limiting guard using the Upstash conditional pattern (enabled only when env vars are set).

Current rate limits:

| Route | Limit |
|---|---|
| `chat` | 10 req / 10 s (sliding window) |
| `transcribe` | 5 req / 1 min |
| `generate-notes` | 5 req / 1 min |
| `sources` | No rate limit |

### AI Context Truncation Safeguards

| Usage | Cap |
|---|---|
| Chat — transcript | 300,000 chars |
| Chat — individual source | 50,000 chars |
| Notes generation — transcript | 400,000 chars |

Always apply these truncation guards when building AI prompts.

### AI Models

| Task | SDK | Model | Notes |
|---|---|---|---|
| Transcription | `openai` direct | `whisper-1` | `response_format: 'text'` |
| Notes generation | `openai` direct | `gpt-4o-mini` | `temperature: 0.3`, `json_object` mode |
| Chat | AI SDK (`@ai-sdk/openai` + `streamText`) | `gpt-4o-mini` | Streams `UIMessage` responses |

---

## Coding Conventions

- **TypeScript strict mode** throughout. Use explicit types for public interfaces and API payloads.
- **Path aliases**: always use `@/` instead of deep relative imports.
- **Class names**: always use `cn()` from `lib/utils.ts` (combines `clsx` + `tailwind-merge`).
- **Tailwind v4**: design tokens live in `styles/globals.css` under `@theme inline`. Use oklch colors. Do **not** use a `tailwind.config.ts` file.
- **Semantic color tokens**: use `bg-card`, `text-foreground`, `border-border`, etc. Never hardcode light/dark colors.
- **Icons**: `lucide-react` only.
- **Toasts**: use `sonner` (`toast()` function; global `<Toaster>` in root layout).
- **`'use client'`**: only add where strictly required. Keep server/client component boundaries clean.
- Match existing quote style, semicolons, and formatting in every file you touch.

---

## Testing Conventions

- Tests are **colocated** with routes: `app/api/*/route.test.ts`. Never place tests in `app/__tests__/`.
- `vitest.setup.ts` pre-mocks: `next/server`, Supabase, OpenAI SDK, AI SDK, Upstash. Follow the same mock patterns in new tests.
- When changing API behavior, update or add coverage in the matching `route.test.ts`.

---

## Theme & Sidebar

- Light/dark support via `next-themes` (`defaultTheme="dark"`, `enableSystem`).
- Theme toggle lives in the sidebar profile dropdown (`components/app-sidebar.tsx`).
- Sidebar collapses to icon-only mode; state persists via cookie.
- `dashboard-shell.tsx` was removed — the sidebar replaced it; do not reference it.

---

## Data Model Quick Reference

**`meetings` table** — `id`, `user_id`, `title`, `audio_url`, `audio_duration`, `transcript`, `summary`, `action_items` (JSONB), `key_decisions` (JSONB), `topics` (JSONB), `follow_ups` (JSONB), `status`, `error_message`, `created_at`, `updated_at`. RLS enabled.

**`meeting_sources` table** — `id`, `meeting_id`, `user_id`, `name`, `file_type`, `content`, `created_at`. Cascade deletes on `meeting_id` and `user_id`. RLS enabled.

**`meeting-audio` storage bucket** (private) — files at `{user_id}/{meeting_id}.{ext}`. RLS scoped by user folder.

**Schema changes**: add a new numbered SQL file in `scripts/` (e.g. `scripts/004_*.sql`).

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | All Supabase clients |
| `OPENAI_API_KEY` | Yes | Transcription, notes, chat |
| `UPSTASH_REDIS_REST_URL` | Optional | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Rate limiting |

---

## Common Anti-Patterns to Avoid

- Missing ownership check (`.eq('user_id', user.id)`) in server routes.
- Importing the server Supabase client inside a client component (or vice versa).
- Returning inconsistent error shapes across routes.
- Building AI prompts without truncation safeguards.
- Reimplementing UI primitives already in `components/ui/`.
- Using Tailwind v3 syntax (`tailwind.config.ts`, `extend.colors`, etc.).
- Omitting `maxDuration` export on new API routes.
- Skipping error-status recovery (`status: 'error'`) in processing routes.
- Mixing unrelated refactors into a feature/fix commit.
- Never commit secrets, tokens, or `.env` values.

---

## Recommended Workflow

1. Read the relevant existing files before making changes.
2. Make the smallest correct change for the task.
3. Run `pnpm lint && pnpm test`.
4. Verify edge cases: missing auth, missing IDs, ownership failures, empty data.
5. Write a clear commit message summarising what changed and why.

For deeper reference on any section, see `AGENTS.md`.
