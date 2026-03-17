# Easy Noter

AI-powered meeting notes app built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase, and Tiptap 3.

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
- `lib/` — business logic, types, helpers, Supabase clients (`lib/supabase/`)
- `scripts/` — numbered SQL migrations (append-only, never edit old ones)
- `styles/` — global CSS

Use the `@/` path alias for imports.

## Code Style

- TypeScript, functional React components, 2-space indent
- Kebab-case filenames (`transcript-bubble.tsx`)
- App Router conventions: `page.tsx`, `layout.tsx`, `route.ts`
- Follow surrounding code formatting — no Prettier, ESLint only
- Conventional Commits: `feat:`, `fix:`, `refactor:`, etc.

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

## Design Rules

- Never hardcode colors — use CSS custom properties (oklch color tokens)
- Status dots (not Badge component) for meeting status
- Underline tabs (not pills) on meeting detail
- `max-w-[720px]` for meeting content areas
- `shadow-md` on floating surfaces (BubbleMenu, popovers)
- `ghost-icon` variant for toolbar buttons
- `tabular-nums` on timestamps
- `text-[11px]` for captions; `uppercase tracking-wider text-muted-foreground` for section labels
- No `ScrollablePanel` — use full auto-height with expand/collapse patterns

## Environment

Copy `.env.example` to `.env.local`. Required keys:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (or `AI_GATEWAY_API_KEY`)

Optional: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `DEEPGRAM_API_KEY`, `TAVILY_API_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`.

## Database

SQL migrations live in `scripts/` and are numbered sequentially (001–008). Always add new migrations; never modify existing ones. All tables use Row-Level Security.
