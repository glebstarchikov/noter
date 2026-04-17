# Project Overview

**noter** is an AI-powered meeting notes app built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, and Supabase.

## Key Technologies

- **Framework:** Next.js 16 (App Router)
- **UI & Styling:** Tailwind CSS v4, shadcn/ui, Radix UI primitives — Workspace design language (sage accent, tinted card surfaces, `rounded-xl` cards)
- **Package Manager & Runtime:** Bun
- **Database & Auth:** Supabase (Postgres + RLS on all tables, `@supabase/ssr` for server-side auth)
- **AI:** Vercel AI SDK + OpenAI (`gpt-5-mini` for chat, `gpt-5.4` for note enhancement)
- **Transcription:** Deepgram WebSocket (`nova-3-meeting` model)
- **Editor:** Tiptap 3 rich text editor (document stored as JSONB)
- **Testing:** Bun test runner, React Testing Library, Happy DOM

## Directory Structure

- `app/` — App Router pages, layouts, and API routes (`api/chat`, `api/transcribe`, `api/meetings`, etc.)
- `components/` — feature and UI components; shadcn/ui primitives in `components/ui/`
- `hooks/` — custom React hooks (audio recording, Deepgram transcription, editor autosave, chat session)
- `lib/` — business logic split by domain: `lib/api/`, `lib/chat/`, `lib/notes/`, `lib/meetings/`, `lib/tiptap/`, `lib/supabase/`
- `scripts/` — numbered SQL migrations (001–010, append-only)
- `styles/` — global CSS and UI interaction checklist
- `docs/superpowers/` — design specs, implementation plans, investigation docs

## Commands

```bash
bun install          # install dependencies
bun dev              # start dev server
bun run build        # production build
bun run lint         # ESLint across app, components, hooks, lib
bun run typecheck    # strict TypeScript checks
bun test             # run tests once
bun run test:watch   # watch mode
```

Always run `bun run typecheck` and `bun run lint` before committing.

## Development Conventions

- **Path alias:** Use `@/` for all imports (e.g., `@/lib/utils`, `@/components/ui/button`)
- **Naming:** kebab-case filenames, functional React components, 2-space indent
- **API routes:** use `validateBody(request, schema)` from `@/lib/api/validate` and `errorResponse()` from `@/lib/api/api-helpers` — never hand-roll validation or `NextResponse.json({ error })`
- **Error tracking:** route errors go through `Sentry.captureException()`; no bare `console.error` in API routes
- **RLS:** every Supabase table has row-level security; never use the service-role client in user-facing routes
- **Rate limiting:** expensive routes use Upstash `Ratelimit.slidingWindow` — see `app/api/meetings/[id]/enhance/route.ts`
- **Design language:** new components follow the Workspace rules in `CLAUDE.md §Design Rules`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, etc.)

## Testing

Tests use `bun:test`, `@testing-library/react`, and Happy DOM. Test files are `*.test.ts` / `*.test.tsx`, co-located with source:

- Component tests in `components/`
- API route tests next to handlers in `app/api/`
- Pure logic tests in `lib/__tests__/`

Run `bun test` and `bun run typecheck` before opening a PR.
