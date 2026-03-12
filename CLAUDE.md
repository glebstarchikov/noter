# CLAUDE.md

Guidance for AI assistants working in this repository.

---

## Reference Docs

Open these files for the task at hand — do not load all of them at once:

| File | Read when… |
|---|---|
| `CONVENTIONS.md` | Writing any TypeScript, React, Next.js, or API route code |
| `DESIGN.md` | Changing any UI, layout, color, or interaction |
| `ARCHITECTURE.md` | Working on processing pipeline, status flow, async jobs, or chat |
| `DATABASE.md` | Writing SQL, creating migrations, or querying Supabase |
| `TESTING.md` | Writing or updating tests |

---

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

## AI Assistance Skills

Use these `/everything-claude-code:*` skills proactively during development:

| When | Skill |
|---|---|
| Writing new features or fixing bugs | `/everything-claude-code:tdd-workflow` — tests first, 80%+ coverage |
| Adding auth, handling user input, creating API routes, touching secrets | `/everything-claude-code:security-review` |
| Writing SQL, creating migrations in `scripts/`, designing schemas | `/everything-claude-code:postgres-patterns` + `/everything-claude-code:database-migrations` |
| Adding/changing React components or Next.js pages | `/everything-claude-code:frontend-patterns` |
| Adding/changing API routes in `app/api/` | `/everything-claude-code:backend-patterns` + `/everything-claude-code:api-design` |
| Any code changes (TypeScript, React) | `/everything-claude-code:coding-standards` |
| Touching AI calls (OpenAI, Deepgram, AI SDK) | `/everything-claude-code:cost-aware-llm-pipeline` |
| Before marking a task complete | `/everything-claude-code:verification-loop` |

---

## Recommended Workflow

1. Read the relevant source files before making any changes.
2. Check the Reference Docs table above — open the files relevant to the task.
3. Implement the smallest correct change; prefer well-architected, composable code over quick patches.
4. Run `bun run lint` and `bun run test` — fix all failures.
5. Verify edge cases: unauthenticated requests, missing IDs, ownership failures, empty data.
6. Write a clear commit message describing what changed and why.
