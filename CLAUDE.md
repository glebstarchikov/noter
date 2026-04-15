# Easy Noter

AI-powered meeting notes app built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase, and Tiptap 3.

## Active Initiative: Workspace Redesign → Open-Source Launch

A full visual redesign and architecture refactor is in progress, culminating in a public open-source release for AI Society dogfooding and broader distribution. All new code should follow the **Workspace** design language (see §Design Rules) and the backend conventions below.

- **Spec**: [docs/superpowers/specs/2026-04-15-noter-workspace-redesign.md](docs/superpowers/specs/2026-04-15-noter-workspace-redesign.md) — complete design, scope, deletions, acceptance criteria
- **Phase 1 plan**: [docs/superpowers/plans/2026-04-15-noter-workspace-redesign-phase-1.md](docs/superpowers/plans/2026-04-15-noter-workspace-redesign-phase-1.md) — architecture refactor, 8 tasks, zero user-facing changes
- **Phase 1 investigation output** (produced by Task 1): `docs/superpowers/investigations/2026-04-15-chat-endpoints.md`

Phase 1 is non-visual (lib/ reorg, API middleware, hook splits, enhance route split, Sentry logging). Phase 2+ will install the new tokens in `app/globals.css` and reskin components. Until Phase 2 ships, existing code may still use the old tokens — but any **new** components should follow the Workspace rules below so migration is cheap.

**Dark mode**: deferred to a follow-up after v1 ships. Design decisions must not preclude it.

## Commands

```bash
bun install          # install dependencies
bun dev              # start dev server
bun run build        # production build
bun run lint         # ESLint (app, components, hooks, lib)
bun run typecheck    # strict TypeScript checks
bun test             # run tests once
bun run test:watch   # tests in watch mode
```

Always run `bun run typecheck` and `bun run lint` before committing.

## Project Structure

- `app/` — App Router pages, layouts, API routes
- `components/` — feature components + `components/ui/` (shadcn/ui)
- `hooks/` — custom React hooks (audio, transcription, autosave)
- `lib/` — business logic, types, helpers, split by domain:
  - `lib/api/` — API helpers (`errorResponse`, `successResponse`) + request validation middleware (`validateBody`)
  - `lib/chat/` — chat storage, message utils, attachments, global context
  - `lib/notes/` — draft proposals, enhancement context/errors, note normalization, prompts, LLM enhance modules (validation / llm / persist)
  - `lib/tiptap/` — Tiptap converter + meeting editor extensions
  - `lib/meetings/` — meeting pipeline, actions, upload, workspace helpers
  - `lib/supabase/` — client / server / admin Supabase clients
  - `lib/` root — cross-cutting types/utils (`types.ts`, `utils.ts`, `schemas.ts`, `ai-models.ts`, `openai.ts`, etc.)
- `scripts/` — numbered SQL migrations (append-only, never edit old ones)
- `styles/` — global CSS
- `docs/superpowers/` — design specs, implementation plans, and investigation docs (append-only)

Use the `@/` path alias for imports.

> **Note**: The `lib/` subdomain reorganization is Phase 1 Task 2 of the Workspace redesign. Until that task lands, imports may reference the old flat `lib/*` paths. The structure above is the target; subagents executing Phase 1 should follow the plan's move map.

## Code Style

- TypeScript, functional React components, 2-space indent
- Kebab-case filenames (`transcript-bubble.tsx`)
- App Router conventions: `page.tsx`, `layout.tsx`, `route.ts`
- Follow surrounding code formatting — no Prettier, ESLint only
- Conventional Commits: `feat:`, `fix:`, `refactor:`, etc.

## Backend Conventions

- **API route validation**: use `validateBody(request, schema)` from `@/lib/api/validate` for all JSON POST/PATCH routes. Don't hand-roll `request.json().catch(...)` + `schema.safeParse()` — that boilerplate was extracted in Phase 1 Task 3.
- **Error responses**: use `errorResponse(message, code, status)` from `@/lib/api/api-helpers`. Never `NextResponse.json({ error })` directly in route handlers.
- **Logging**: in `app/api/**` and `lib/api/**`, no bare `console.error` / `console.warn` / `console.info`. Route errors through `Sentry.captureException(error, { tags, extra })`, events through `Sentry.addBreadcrumb(...)` or `Sentry.captureMessage(...)`. `console.log` is fine in dev-only paths (`if (process.env.NODE_ENV === 'development')`).
- **RLS is mandatory**: every table must have row-level security policies. Never use service-role Supabase client in user-facing routes — only in `/api/processing/worker` (cron-gated) and similar internal routes.
- **Rate limiting**: expensive routes (enhance, generate-notes, chat) use Upstash `Ratelimit.slidingWindow` — see `app/api/meetings/[id]/enhance/route.ts` for the canonical pattern.

## Testing

- Bun test runner + Happy DOM + `@testing-library/react`
- Test files: `*.test.ts` / `*.test.tsx`
- Component tests in `components/`, API tests next to handlers, logic tests in `lib/__tests__/`

## Architecture

- **Supabase** for auth (RLS on all tables) and Postgres database
- **Tiptap 3.20** rich text editor — document stored as JSON in `document_content` JSONB column
- **Deepgram** for real-time audio transcription via WebSocket
- **Vercel AI SDK + OpenAI** for note generation and chat
- Meeting page (`/dashboard/[id]`) is a tri-state surface: recording → processing → done
- Auto-save: 2s debounce → PATCH `/api/meetings/[id]/document`

### Tiptap 3 Imports

```ts
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/extension-bubble-menu'  // React component
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Typography } from '@tiptap/extension-typography'
```

## Design Rules — Workspace Language

The Workspace design language is the target for v1 (OSS release). It replaces the previous "shadcn default" look. New components must follow these rules; existing components will be migrated in Phase 2/3.

**Color & typography**

- Never hardcode colors — use CSS custom properties (`oklch` color tokens) defined in `app/globals.css`
- Accent is **sage** (`#5a9a6d` as oklch) — used for status dots, chips, focus rings, note-block left stripes, links, active states
- **Terracotta** (`#c5694a`) is reserved exclusively for destructive/error states. Never use it as a general accent.
- Typography is **Inter only**. Weights in use: 400 / 500 / 550 / 650. No secondary font, no serif display, no monospace. Tabular-nums on all timestamps/durations/counts.
- Base surface `#f9f8f5`. Card surface `#f1efe8` (tinted, never white-on-white). Primary text `#1a1917`. Button primary `#1a1917` on base surface.

**Surfaces & shape**

- Default radius is `rounded-xl` (14px) for cards, note blocks, dialogs, popovers, inputs. `rounded-lg` (10px) for chips and tabs.
- `rounded-md` is **banned** except on tiny elements (e.g., color swatches in settings). `rounded-full` for avatars and status dots only.
- Cards use tinted `bg-card` surface — no white-on-white. Differentiation through color, not shadow.
- `shadow-md` only on **floating** surfaces: BubbleMenu, popovers, dropdown menus, toasts. Never on inline cards.

**Components**

- Status dots (not `Badge`) for meeting status, with 3px soft-ring in sage: `<span className="inline-block size-2 rounded-full bg-accent ring-[3px] ring-accent-ring" />`
- Underline tabs (not pills) on meeting detail
- AI-generated note blocks get a 3px sage left stripe: `box-shadow: inset 3px 0 0 var(--accent)`. User-authored content does not get the stripe.
- Button hierarchy: **primary** (filled `bg-primary`), **ghost** (transparent, hover `bg-card`), **destructive** (filled `bg-destructive`, rare). The shadcn `outline`, `secondary`, and `link` variants are banned — use `ghost` instead.
- `ghost-icon` variant for toolbar buttons (32px square, `rounded-lg`, hover tint `bg-accent-soft`)
- Focus ring: 2px sage + 2px offset in base color — replaces shadcn's default `ring-ring ring-offset-background`

**Layout & typography detail**

- `max-w-[720px]` for meeting content areas
- `tabular-nums` on timestamps, durations, counts
- `text-[11px]` for captions
- `uppercase tracking-wider text-muted-foreground font-medium` for section labels and meta rows (e.g., "RECORDING · 14:32")
- No `ScrollablePanel` — use full auto-height with expand/collapse patterns

## Environment

Copy `.env.example` to `.env.local`. Required keys:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (or `AI_GATEWAY_API_KEY`)

Optional: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `DEEPGRAM_API_KEY`, `TAVILY_API_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`.

## Database

SQL migrations live in `scripts/` and are numbered sequentially (001–008). Always add new migrations; never modify existing ones. All tables use Row-Level Security.

Upcoming migration (Phase 2 of the redesign): `scripts/009_drop_note_templates.sql` will drop the `note_templates` table along with the templates feature cut.
