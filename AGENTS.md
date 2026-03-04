# AGENTS.md

Guidance for AI coding agents working in this repository.

## 1) Project Snapshot
- App type: Next.js App Router application (TypeScript) for recording meetings, transcribing audio, generating structured notes, and chatting over meeting context.
- Core stack: Next.js 16, React 19, Supabase (auth + data + storage), OpenAI/AI SDK, Tailwind CSS v4, Radix UI primitives, Vitest.
- Key product flow:
  1. Landing page (`app/page.tsx`) → sign up / sign in.
  2. Create meeting via live recording (`components/audio-recorder.tsx`) or file upload (`components/audio-uploader.tsx`) at `/dashboard/new`.
  3. Processing progress shown in real time (`components/processing-view.tsx`).
  4. Transcribe audio (`app/api/transcribe/route.ts` → OpenAI Whisper).
  5. Generate structured notes (`app/api/generate-notes/route.ts` → GPT-4o-mini).
  6. Review details + chat with meeting context (`components/meeting-detail.tsx`, `components/meeting-chat.tsx`, `app/api/chat/route.ts`).
  7. Attach external source documents for contextual Q&A (`components/source-manager.tsx`, `app/api/sources/route.ts`).

## 2) Repository Structure (Respect This)
- `app/`
  - App Router pages and route handlers.
  - `app/page.tsx` — public landing page.
  - `app/layout.tsx` — root layout (fonts, SEO metadata, `ThemeProvider`, Toaster, Analytics).
  - API endpoints live under `app/api/*/route.ts` (colocated tests in `route.test.ts`).
  - Auth pages under `app/auth/*` (login, sign-up, sign-up-success, error).
  - Dashboard pages under `app/dashboard/*` (list, `[id]` detail, `new` creation).
  - `app/dashboard/layout.tsx` — dashboard layout with `SidebarProvider`, `AppSidebar`, and header.
- `components/`
  - Product-level UI components (meeting detail, chat, recorder, uploader, source manager, processing view, sidebar, meetings list, landing page sections).
  - `components/ui/` contains reusable UI primitives (shadcn/ui Radix-based, configured via `components.json`).
  - Key UI primitives: `sidebar.tsx`, `scroll-area.tsx`, `collapsible.tsx`, `dropdown-menu.tsx`, `dialog.tsx`, `tabs.tsx`, `badge.tsx`, `button.tsx`.
- `hooks/`
  - Shared React hooks (`use-audio-recorder`, `use-toast`, `use-mobile`).
- `lib/`
  - Shared utilities, domain types, and Supabase helpers.
  - `lib/types.ts` — `Meeting`, `ActionItem`, `MeetingStatus`, `MeetingSource` interfaces.
  - `lib/utils.ts` — `cn()` helper (combines `clsx` + `tailwind-merge`).
  - Supabase clients separated by runtime: `lib/supabase/client.ts` (browser), `server.ts` (server components/routes), `proxy.ts` (middleware session refresh), `admin.ts` (service role — privileged operations only).
- `styles/`
  - `styles/globals.css` — design token system (CSS custom properties, light/dark themes via `.dark` class, Tailwind v4 `@theme inline` configuration, oklch colors).
- `scripts/`
  - SQL migration/setup scripts for required tables/buckets (numbered, run in order).
- `public/`
  - Static assets, placeholders, and favicons (`icon.svg`, `icon-dark-32x32.png`, `icon-light-32x32.png`, `apple-icon.png`).
- Root config files:
  - `proxy.ts` — Next.js middleware (Supabase session refresh + auth redirect).
  - `next.config.mjs` — Next.js config (`bodySizeLimit: '25mb'`, unoptimized images).
  - `vitest.config.ts` / `vitest.setup.ts` — test framework configuration.
  - `tsconfig.json`, `postcss.config.mjs`, `components.json`.

When adding functionality, put code in the nearest existing domain folder. Avoid introducing new top-level folders unless clearly necessary.

## 3) Non-Negotiable Engineering Rules

### Authentication, Authorization, and Data Safety
- For every server route handling meeting/source data:
  - Authenticate user with Supabase.
  - Enforce ownership checks (`.eq('user_id', user.id)`) before read/update/delete.
- Never trust client-provided ownership identifiers.
- Keep errors user-safe; do not leak secrets or provider internals.

### Supabase Usage
- Use `createClient()` from the correct module:
  - Browser/client components: `@/lib/supabase/client`.
  - Server components/routes: `@/lib/supabase/server`.
  - Middleware session refresh: `@/lib/supabase/proxy`.
  - Admin / privileged operations (service role key): `@/lib/supabase/admin`.
- Do not globalize server Supabase clients (especially with Fluid compute).
- Preserve session cookie behavior in proxy logic.
- Both database tables and the storage bucket have Row Level Security (RLS) enabled — all data access is scoped to the authenticated user.

### Rate Limiting
API routes use Upstash Redis rate limiting (conditionally enabled when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars are set). Current limits:
| Route | Limit |
|---|---|
| `chat` | 10 req / 10 s (sliding window) |
| `transcribe` | 5 req / 1 min |
| `generate-notes` | 5 req / 1 min |
| `sources` | No rate limiting |

When adding new API routes, follow the same conditional rate limiting pattern.

### Meeting Status Lifecycle
The `MeetingStatus` type (`lib/types.ts`) defines the processing pipeline:
```
recording → uploading → transcribing → generating → done
                                ↘          ↘
                                  error ←←←←←
```
- `transcribe` and `generate-notes` routes handle error recovery: on failure, they update meeting status to `error` with `error_message` in their catch blocks.
- Always transition status forward or to `error` — never skip steps or go backward.

### AI + Context Management
- Keep prompts deterministic and scoped to meeting context.
- Apply transcript/content truncation safeguards for token limits:
  - Chat: transcript capped at 300,000 chars, individual sources at 50,000 chars.
  - Notes generation: transcript capped at 400,000 chars.
- Parse model output defensively (validate JSON boundaries and fallback values).

### API Route Design
- Return clear status codes (`400`, `401`, `404`, `429`, `500`) and stable JSON/text error shapes.
- Keep route handlers focused and readable; extract helper functions when logic grows.
- Every route must export `maxDuration` (current values: chat=60s, transcribe=120s, generate-notes=60s, sources=30s).

## 4) Coding Conventions
- Language: TypeScript (strict mode).
- Prefer explicit types for public interfaces and payloads.
- Match existing style in touched files (quotes, semicolons, formatting).
- Prefer small, pure helper functions for transform/format logic.
- Avoid large inline anonymous functions when a named helper improves clarity.
- Use `@/` path aliases rather than deep relative import chains.
- Always use the `cn()` helper from `lib/utils.ts` for conditional/merged class names.
- Do not add broad refactors unrelated to the task.

### Tailwind CSS v4
This project uses Tailwind v4 with the `@tailwindcss/postcss` plugin — not the legacy `tailwind.config.ts` approach.
- Design tokens are defined in `styles/globals.css` using CSS custom properties and the `@theme inline` directive.
- Color values use the oklch color space throughout.
- Do not generate legacy Tailwind v3 config syntax.

## 5) Frontend Practices
- Respect client/server component boundaries (`'use client'` only where required).
- Reuse components from `components/ui` and utilities from `lib/utils.ts`.
- Fonts: Geist (sans) and Geist Mono (monospace) via `next/font/google`.
- Icons: lucide-react — use existing icons from this library.
- Toast notifications: use sonner (`toast()` from `sonner`, global `<Toaster>` in root layout). The Radix-based `use-toast` hook exists but sonner is the primary system.
- Vercel Analytics is integrated in the root layout.
- Keep accessibility in mind:
  - keyboard support for interactive custom elements,
  - semantic labels/aria attributes where appropriate,
  - non-color-only state indicators.

### Theme System
- Light + dark mode supported via `next-themes` (`ThemeProvider` in root layout, `defaultTheme="dark"`, `enableSystem`).
- Theme toggle is integrated in the sidebar profile dropdown (`components/app-sidebar.tsx`).
- All color tokens use CSS custom properties with `.dark` class overrides in `styles/globals.css`.
- When adding new UI, use semantic tokens (`bg-card`, `text-foreground`, `border-border`, etc.) — never hardcode light/dark colors.

### Sidebar Architecture
- The dashboard uses `SidebarProvider` + `AppSidebar` from `components/app-sidebar.tsx` (based on shadcn/ui Radix sidebar).
- Sidebar contains: logo/branding, navigation, and user profile footer with dropdown (logout, theme toggle).
- The sidebar collapses to icon-only mode and persists state via cookie.
- `components/dashboard-shell.tsx` was removed — the sidebar replaced it.

### Meeting Detail Layout
- `components/meeting-detail-wrapper.tsx` wraps `meeting-detail.tsx` and the AI chat panel in a split-pane layout.
- Chat panel uses `sticky top-0 h-screen` to stay pinned while main content scrolls.
- Tab content (Summary, Actions, Transcript) uses a `ScrollablePanel` component with a drag-to-resize bottom handle and internal `overflow-y-auto` scrolling.

### SEO & Favicon
- Root layout exports `Metadata` with `metadataBase`, Open Graph, Twitter card, and keyword meta tags.
- Favicons: `icon.svg` (main), `icon-dark-32x32.png` / `icon-light-32x32.png` (theme-aware via `media` attribute in metadata), `apple-icon.png`.
- Website URL: `https://noter1.vercel.app`.

## 6) Data Model Awareness

### Primary Entities
See `lib/types.ts` and SQL scripts in `scripts/`.

`meetings` — core entity with:
- `id`, `user_id`, `title`, `audio_url`, `audio_duration`
- `transcript`, `summary`, `detailed_notes` (text fields, nullable)
- `action_items`, `key_decisions`, `topics`, `follow_ups` (JSONB arrays)
- `status` (`MeetingStatus`), `error_message`
- `created_at`, `updated_at`
- RLS enabled — users can only CRUD their own meetings.

`meeting_sources` — user-attached documents:
- `id`, `meeting_id`, `user_id`, `name`, `file_type`, `content`
- `created_at`
- Cascade deletes on both `meeting_id` and `user_id`.
- RLS enabled.

`meeting-audio` storage bucket (private):
- Files stored at path `{user_id}/{meeting_id}.{extension}`.
- RLS policies scope access by user folder.

### `processing_jobs` table
- Supports async processing jobs (see `scripts/004_create_processing_jobs_table.sql`).

### Schema Changes
- Add a new numbered SQL script in `scripts/` (e.g., `005_*.sql`).
- Keep backward compatibility in app code until migration assumptions are safe.

## 7) Testing and Validation Expectations

### Test Location Convention
Tests are colocated with route handlers: `app/api/*/route.test.ts`. Do not place tests in `app/__tests__/`.

### Test Setup
- `vitest.setup.ts` mocks `next/server` (`NextRequest`, `NextResponse`) and sets mock environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`).
- Standard mocking pattern: mock `@/lib/supabase/server`, `ai`, `@ai-sdk/openai`, `@upstash/ratelimit`, `@upstash/redis`.

### Running Tests
- `pnpm lint` — ESLint check.
- `pnpm typecheck` — TypeScript type check (`tsc --noEmit`).
- `pnpm test` — run all Vitest tests once.
- `pnpm test:watch` — watch mode.
- `pnpm test:ui` — Vitest UI.

When changing API behavior, add/update Vitest coverage under matching `app/api/**/route.test.ts` files.

## 8) Change Discipline for Agents
- Make minimal, task-focused diffs.
- Preserve existing behavior unless the task requires changes.
- Prefer incremental improvements over sweeping rewrites.
- If introducing a new dependency, justify it in the PR notes and keep footprint small.
- Never commit secrets, tokens, or `.env` values.

## 9) Recommended Task Workflow
1. Inspect related files and existing patterns in the target area.
2. Implement smallest correct change.
3. Run lint/tests.
4. Verify edge cases (auth missing, missing IDs, ownership failures, empty data).
5. Summarize what changed and why.

## 10) Environment Variables
| Variable | Required | Used By |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | All Supabase clients |
| `OPENAI_API_KEY` | Yes | Transcribe, generate-notes, chat routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Admin client (`@/lib/supabase/admin`) |
| `UPSTASH_REDIS_REST_URL` | Optional | Rate limiting (conditionally enabled) |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Rate limiting (conditionally enabled) |

## 11) AI Model Configuration
- Transcription: OpenAI Whisper (`whisper-1`), `response_format: 'text'` — via `openai` SDK directly.
- Notes generation: `gpt-4o-mini`, `temperature: 0.3`, `response_format: { type: 'json_object' }` — via `openai` SDK directly.
- Chat: `gpt-4o-mini` via AI SDK (`@ai-sdk/openai` provider + `streamText` from `ai` package v6), streams `UIMessage` responses.

When changing AI behavior, keep the model consistent unless the task specifically requires a different model.

## 12) Quick File Map for Common Tasks

### Pages
- Landing page: `app/page.tsx`
- Root layout (fonts, SEO metadata, ThemeProvider, Toaster): `app/layout.tsx`
- Dashboard layout (sidebar + header): `app/dashboard/layout.tsx`
- Dashboard (meetings list): `app/dashboard/page.tsx`
- New meeting (record/upload): `app/dashboard/new/page.tsx`
- Meeting detail: `app/dashboard/[id]/page.tsx`
- Dashboard error boundary: `app/dashboard/error.tsx`
- Dashboard loading skeleton: `app/dashboard/loading.tsx`
- Auth login: `app/auth/login/page.tsx`
- Auth sign-up success: `app/auth/sign-up-success/page.tsx`
- Auth sign-up: `app/auth/sign-up/page.tsx`

### API Routes
- Chat streaming: `app/api/chat/route.ts`
- Notes generation: `app/api/generate-notes/route.ts`
- Audio transcription: `app/api/transcribe/route.ts`
- Source upload/list/delete: `app/api/sources/route.ts`
- Meeting CRUD + processing trigger: `app/api/meetings/[id]/route.ts`, `app/api/meetings/[id]/process/route.ts`
- Async processing worker: `app/api/processing/worker/route.ts`

### Components
- Meeting detail UI: `components/meeting-detail.tsx` (includes `ScrollablePanel` for resizable tab content)
- Meeting detail + chat layout: `components/meeting-detail-wrapper.tsx`
- Meeting AI chat panel: `components/meeting-chat.tsx`
- Audio file upload: `components/audio-uploader.tsx`
- Live audio recording: `components/audio-recorder.tsx`
- Processing progress: `components/processing-view.tsx`
- Source file manager: `components/source-manager.tsx`
- Sidebar (navigation + profile): `components/app-sidebar.tsx`
- Theme provider: `components/theme-provider.tsx`
- Meetings list: `components/meetings-list.tsx`
- Landing hero: `components/landing-hero.tsx`
- Landing features: `components/landing-features.tsx`
- Reusable UI primitives: `components/ui/*`

### Hooks
- Audio recorder logic: `hooks/use-audio-recorder.ts`
- Toast state (Radix): `hooks/use-toast.ts`
- Mobile breakpoint detection: `hooks/use-mobile.ts`

### Lib & Config
- Shared types: `lib/types.ts`
- Class name utility: `lib/utils.ts`
- Supabase browser client: `lib/supabase/client.ts`
- Supabase server client: `lib/supabase/server.ts`
- Supabase admin client (service role): `lib/supabase/admin.ts`
- Supabase middleware helper: `lib/supabase/proxy.ts`
- Next.js middleware: `proxy.ts` (root)
- Design tokens / theme: `styles/globals.css`
- Test config: `vitest.config.ts`, `vitest.setup.ts`
- Next.js config: `next.config.mjs`

### SQL Scripts (run in numbered order)
- `scripts/001_create_meetings_table.sql`
- `scripts/002_create_storage_bucket.sql`
- `scripts/003_create_meeting_sources_table.sql`
- `scripts/004_create_processing_jobs_table.sql`

## 13) Agent Anti-Patterns to Avoid
- Skipping ownership checks in server routes.
- Moving server-only logic into client components.
- Adding `'use client'` unnecessarily — default to server components.
- Returning inconsistent error shapes for similar failures.
- Embedding huge prompts/content blocks without truncation safeguards.
- Re-implementing shared UI primitives instead of reusing `components/ui/*`.
- Mixing unrelated refactors into feature/fix commits.
- Using Tailwind v3 config syntax (`tailwind.config.ts`) instead of the v4 `@theme inline` approach.
- Hardcoding light/dark colors instead of using semantic CSS custom property tokens.
- Importing the wrong Supabase client for the runtime context.
- Forgetting `maxDuration` exports on new API routes.
- Omitting rate limiting on new long-running or abuse-sensitive routes.
- Skipping error recovery (updating meeting status to `error`) in processing routes.
- Committing `.env` files, secrets, or API keys.