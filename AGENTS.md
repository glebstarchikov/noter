# AGENTS.md

Guidance for AI coding agents working in this repository.

## 1) Project Snapshot
- **App type:** Next.js App Router application (TypeScript) for recording meetings, transcribing audio, generating structured notes, and chatting over meeting context.
- **Core stack:** Next.js 16, React 19, Supabase (auth + data + storage), OpenAI/AI SDK, Tailwind CSS, Radix UI primitives, Vitest.
- **Key product flow:**
  1. Create meeting + upload audio (`components/audio-uploader.tsx`).
  2. Transcribe audio (`app/api/transcribe/route.ts`).
  3. Generate notes (`app/api/generate-notes/route.ts`).
  4. Review details + chat with meeting context (`components/meeting-detail.tsx`, `app/api/chat/route.ts`).

## 2) Repository Structure (Respect This)
- `app/`
  - App Router pages and route handlers.
  - API endpoints live under `app/api/*/route.ts`.
  - Auth pages under `app/auth/*`.
  - Dashboard pages under `app/dashboard/*`.
- `components/`
  - Product-level UI components (meeting pages, uploader, recorder, etc.).
  - `components/ui/` contains reusable UI primitives.
- `hooks/`
  - Shared React hooks.
- `lib/`
  - Shared utilities, domain types, and Supabase helpers.
  - Supabase clients are separated by runtime (`lib/supabase/client.ts`, `server.ts`, `proxy.ts`).
- `scripts/`
  - SQL migration/setup scripts for required tables/buckets.
- `public/`
  - Static assets/icons/placeholders.

When adding functionality, put code in the nearest existing domain folder. Avoid introducing new top-level folders unless clearly necessary.

## 3) Non-Negotiable Engineering Rules

### Authentication, Authorization, and Data Safety
- For **every** server route handling meeting/source data:
  - Authenticate user with Supabase.
  - Enforce ownership checks (`.eq('user_id', user.id)`) before read/update/delete.
- Never trust client-provided ownership identifiers.
- Keep errors user-safe; do not leak secrets or provider internals.

### Supabase Usage
- Use `createClient()` from the correct module:
  - Browser/client components: `@/lib/supabase/client`.
  - Server components/routes: `@/lib/supabase/server`.
  - Proxy/session refresh logic: `@/lib/supabase/proxy`.
- Do **not** globalize server Supabase clients.
- Preserve session cookie behavior in proxy logic.

### AI + Context Management
- Keep prompts deterministic and scoped to meeting context.
- Apply transcript/content truncation safeguards for token limits.
- Parse model output defensively (validate JSON boundaries and fallback values).

### API Route Design
- Return clear status codes (`400`, `401`, `404`, `429`, `500`) and stable JSON/text error shapes.
- Keep route handlers focused and readable; extract helper functions when logic grows.
- Ensure long-running routes explicitly define `maxDuration` where needed.

## 4) Coding Conventions
- Language: **TypeScript**.
- Prefer explicit types for public interfaces and payloads.
- Match existing style in touched files (quotes, semicolons, formatting).
- Prefer small, pure helper functions for transform/format logic.
- Avoid large inline anonymous functions when a named helper improves clarity.
- Use `@/` path aliases rather than deep relative import chains.
- Do not add broad refactors unrelated to the task.

## 5) Frontend Practices
- Respect client/server component boundaries (`'use client'` only where required).
- Reuse components from `components/ui` and utilities from `lib/utils.ts`.
- Preserve dark theme visual consistency and existing spacing/typography patterns.
- Keep accessibility in mind:
  - keyboard support for interactive custom elements,
  - semantic labels/aria attributes where appropriate,
  - non-color-only state indicators.

## 6) Data Model Awareness
Primary entities (see `lib/types.ts` and SQL scripts):
- `meetings`: transcript + structured notes + status lifecycle.
- `meeting_sources`: user-attached external content for contextual Q&A.

If schema updates are required:
- Add a new SQL script in `scripts/`.
- Keep backward compatibility in app code until migration assumptions are safe.

## 7) Testing and Validation Expectations
Before completing a task, run the most relevant checks:
- `pnpm lint`
- `pnpm test`
- Any focused test target for changed route/component.

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

## 10) Quick File Map for Common Tasks
- Meeting detail UI: `components/meeting-detail.tsx`
- Upload + processing flow: `components/audio-uploader.tsx`
- Chat streaming endpoint: `app/api/chat/route.ts`
- Notes generation endpoint: `app/api/generate-notes/route.ts`
- Audio transcription endpoint: `app/api/transcribe/route.ts`
- Source upload/list/delete endpoint: `app/api/sources/route.ts`
- Shared types: `lib/types.ts`
- Supabase helpers: `lib/supabase/*.ts`
- Session proxy: `proxy.ts`

## 11) Agent Anti-Patterns to Avoid
- Skipping ownership checks in server routes.
- Moving server-only logic into client components.
- Returning inconsistent error shapes for similar failures.
- Embedding huge prompts/content blocks without truncation safeguards.
- Re-implementing shared UI primitives instead of reusing `components/ui/*`.
- Mixing unrelated refactors into feature/fix commits.
