# Noter Workspace Redesign — Phase 1: Architecture Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Noter's code architecture without any user-facing changes, so Phase 2 (visual redesign) can move fast with confidence.

**Architecture:** Eight sequential tasks, each its own commit, each producing a working and testable app. The work is: (1) investigate chat endpoint usage so we can cut dead ones in Phase 2, (2) reorganize `lib/` into domain subfolders, (3–4) extract API validation middleware and migrate all 26 routes to use it, (5–6) split the two monster hooks into focused units, (7) split the 513-LOC `enhance/route.ts` into validation/LLM/persist modules, (8) route all server-side `console.*` through Sentry.

**Tech Stack:** TypeScript strict, Next.js 16 App Router, Zod, Supabase, Sentry, Bun test runner + Happy DOM + `@testing-library/react`.

**Spec reference:** [docs/superpowers/specs/2026-04-15-noter-workspace-redesign.md](../specs/2026-04-15-noter-workspace-redesign.md) §4.3, §5.1–5.5.

**Deferred from Phase 1:** Spec §5.6 (error boundary audit) is intentionally **not** in this phase. Error boundaries render UI and should be styled with the new Workspace tokens — creating them now would mean restyling them in Phase 3. They will be added as a dedicated task in Phase 3 after `app/globals.css` gets the new token set.

**Branch:** Continue on `refactor/making-the-app-even-better`. Each task is a commit; no interim push unless user asks.

**Quality gates after every task:**

```bash
bun run typecheck
bun run lint
bun test
```

All three must pass before committing. If any fail, fix before moving on — never commit red.

---

## File Structure (target state after Phase 1)

```
lib/
├── api/
│   ├── api-helpers.ts        # existing: errorResponse, successResponse (moved)
│   └── validate.ts           # NEW: validateBody(), validateParams() middleware
├── chat/
│   ├── chat-attachments.ts   # moved from lib/
│   ├── chat-message-utils.ts # moved from lib/
│   ├── chat-storage.ts       # moved from lib/
│   ├── chat-ui-helpers.ts    # moved from lib/
│   └── global-chat-context.ts # moved from lib/
├── notes/
│   ├── draft-proposal.ts     # moved from lib/
│   ├── enhancement-context.ts # moved from lib/
│   ├── enhancement-errors.ts  # moved from lib/
│   ├── note-normalization.ts  # moved from lib/
│   ├── notes-generation.ts    # moved from lib/
│   ├── prompts.ts             # moved from lib/
│   ├── enhance-validation.ts  # NEW: input validation + conflict detection
│   ├── enhance-llm.ts         # NEW: LLM call + retry + prompt assembly
│   └── enhance-persist.ts     # NEW: DB updates + normalization
├── tiptap/
│   ├── tiptap-converter.ts   # moved from lib/
│   └── meeting-editor-extensions.ts # moved from lib/
├── meetings/
│   ├── meeting-actions.ts    # moved from lib/
│   ├── meeting-pipeline.ts   # moved from lib/
│   ├── meeting-upload.ts     # moved from lib/
│   └── meeting-workspace.ts  # moved from lib/
├── supabase/                 # unchanged
└── [cross-cutting files stay at root: types.ts, utils.ts, schemas.ts, ai-models.ts,
    date-formatter.ts, document-hash.ts, document-sync.ts, openai.ts, tavily.ts,
    transcript-formatter.ts, transcription.ts, truncation-limits.ts, type-guards.ts,
    file-text.ts, attachment-kind.ts, source-api.ts]

hooks/
├── use-media-stream.ts       # NEW: MediaStream + AudioContext plumbing
├── use-recording.ts          # SLIMMED: composer over use-media-stream + use-deepgram-transcription
├── use-draft-proposal.ts     # NEW: draft state machine + API calls
├── use-note-enhancement.ts   # SLIMMED: composer over use-draft-proposal + conflict handling
└── [unchanged: use-audio-visualizer, use-deepgram-transcription, use-editor-autosave,
    use-mobile, use-shell-animation]

app/api/meetings/[id]/enhance/
└── route.ts                  # SLIMMED to ~120 LOC, orchestrator only

docs/superpowers/investigations/
└── 2026-04-15-chat-endpoints.md  # NEW: findings doc from Task 1
```

**What does NOT change in Phase 1:**
- No UI files (`components/**`, `app/**/page.tsx`, `app/**/layout.tsx`) — all visual work is Phase 2/3.
- No CSS / tokens (`app/globals.css`).
- No SQL migrations.
- No deletions of features (that's Phase 2).
- `lib/templates.ts`, `lib/note-template.ts`, `lib/assistant-shell-layout.ts` — stay untouched in Phase 1 (they'll be deleted in Phase 2 with the templates feature cut).
- `lib/chat-attachments.ts` and friends keep their filenames — only their paths change.

---

## Task 1: Chat endpoint investigation

**Why first:** Phase 2 will consolidate `/api/chat`, `/api/chat/support`, `/api/chat/global` into one endpoint. Before we can do that, we need a written record of what each endpoint actually does, what calls it, and what its request/response shape is. This task produces a findings doc that Phase 2 consumes.

**Files:**
- Create: `docs/superpowers/investigations/2026-04-15-chat-endpoints.md`

- [ ] **Step 1: Read each chat route's source**

Read these three files in full:
- `app/api/chat/route.ts` (173 LOC)
- `app/api/chat/support/route.ts` (81 LOC)
- `app/api/chat/global/route.ts` (109 LOC)

For each one, note:
1. HTTP methods supported (GET / POST / etc.)
2. Request schema (Zod schema if used, or shape of `request.json()`)
3. What it does (LLM call, tools, DB access, streaming?)
4. What dependencies it imports from `lib/`
5. Response shape (streaming, JSON, status codes)

- [ ] **Step 2: Find the callers**

For each endpoint, find who calls it. Use `Grep` for the URL path:

```bash
# Find callers of /api/chat (be careful — substring matches /api/chat/support too)
rg "/api/chat(\"|'|\\?| )" --type ts --type tsx
rg "/api/chat/support" --type ts --type tsx
rg "/api/chat/global" --type ts --type tsx
```

For each endpoint, record:
- Which file(s) fetch it
- What component / hook owns the call
- Whether the call is actually reachable from a user action (trace up the component tree)

- [ ] **Step 3: Write the findings doc**

Create `docs/superpowers/investigations/2026-04-15-chat-endpoints.md` with this exact structure:

```markdown
# Chat Endpoint Investigation — 2026-04-15

**Context:** Phase 2 of the Workspace redesign will consolidate the three chat endpoints into one. This document records the current state so the consolidation can be done safely.

## /api/chat/route.ts
- **LOC:** 173
- **Methods:** [list]
- **Request schema:** [copy the Zod schema or describe the shape]
- **What it does:** [one paragraph: LLM call, streaming, tools, DB access]
- **Dependencies:** [list of lib/ imports]
- **Callers:** [list of files + component/hook + user flow]
- **Is it reachable from the UI?** Yes / No — [evidence]

## /api/chat/support/route.ts
[same structure]

## /api/chat/global/route.ts
[same structure]

## Overlap analysis
- What the three endpoints have in common
- Where they differ (inputs, behavior, tools, context)
- Can they be unified under a single route with a `context` discriminator in the request body? Yes / No — justify

## Recommendation for Phase 2
- Keep: [which endpoint(s)]
- Delete: [which endpoint(s)]
- Merge into: [new proposed shape]
- Migration risk: [none / low / medium / high — justify]
```

Fill in every `[bracket]` with real findings. No placeholders.

- [ ] **Step 4: Verify no code was changed**

```bash
git status
```

Expected: only the new file under `docs/superpowers/investigations/` appears. Nothing else.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/investigations/2026-04-15-chat-endpoints.md
git commit -m "docs: investigate chat endpoint usage for Phase 2 consolidation"
```

---

## Task 2: Reorganize `lib/` into subdomains

**Why:** Per the audit, `lib/` is a 40-file junk drawer with no structure. Grouping by domain (chat, notes, tiptap, meetings, api) makes future edits faster and clarifies boundaries. Pure move operation — zero behavior change.

**Files:**
- Create directories: `lib/api/`, `lib/chat/`, `lib/notes/`, `lib/tiptap/`, `lib/meetings/`
- Move: 17 files from `lib/` root into subdirectories (see map below)
- Modify: every import path across the codebase that references a moved file

**Move map:**

| Old path | New path |
|---|---|
| `lib/api-helpers.ts` | `lib/api/api-helpers.ts` |
| `lib/chat-attachments.ts` | `lib/chat/chat-attachments.ts` |
| `lib/chat-message-utils.ts` | `lib/chat/chat-message-utils.ts` |
| `lib/chat-storage.ts` | `lib/chat/chat-storage.ts` |
| `lib/chat-ui-helpers.ts` | `lib/chat/chat-ui-helpers.ts` |
| `lib/global-chat-context.ts` | `lib/chat/global-chat-context.ts` |
| `lib/draft-proposal.ts` | `lib/notes/draft-proposal.ts` |
| `lib/enhancement-context.ts` | `lib/notes/enhancement-context.ts` |
| `lib/enhancement-errors.ts` | `lib/notes/enhancement-errors.ts` |
| `lib/note-normalization.ts` | `lib/notes/note-normalization.ts` |
| `lib/notes-generation.ts` | `lib/notes/notes-generation.ts` |
| `lib/prompts.ts` | `lib/notes/prompts.ts` |
| `lib/tiptap-converter.ts` | `lib/tiptap/tiptap-converter.ts` |
| `lib/meeting-editor-extensions.ts` | `lib/tiptap/meeting-editor-extensions.ts` |
| `lib/meeting-actions.ts` | `lib/meetings/meeting-actions.ts` |
| `lib/meeting-pipeline.ts` | `lib/meetings/meeting-pipeline.ts` |
| `lib/meeting-upload.ts` | `lib/meetings/meeting-upload.ts` |
| `lib/meeting-workspace.ts` | `lib/meetings/meeting-workspace.ts` |

**Files that stay at `lib/` root** (cross-cutting, no single domain): `ai-models.ts`, `assistant-shell-layout.ts`, `attachment-kind.ts`, `date-formatter.ts`, `document-hash.ts`, `document-sync.ts`, `file-text.ts`, `meeting-pipeline.ts` (wait — this moves, see above), `note-template.ts`, `openai.ts`, `schemas.ts`, `source-api.ts`, `tavily.ts`, `templates.ts`, `transcript-formatter.ts`, `transcription.ts`, `truncation-limits.ts`, `type-guards.ts`, `types.ts`, `utils.ts`.

Also: `lib/__tests__/` and `lib/supabase/` stay as-is.

- [ ] **Step 1: Verify pre-task state is green**

```bash
bun run typecheck && bun run lint && bun test
```

All three pass. If not, stop and fix before reorg.

- [ ] **Step 2: Create the subdirectories and move the files**

Use `git mv` so history is preserved:

```bash
cd /Users/glebstarcikov/Noter
mkdir -p lib/api lib/chat lib/notes lib/tiptap lib/meetings

git mv lib/api-helpers.ts lib/api/api-helpers.ts

git mv lib/chat-attachments.ts lib/chat/chat-attachments.ts
git mv lib/chat-message-utils.ts lib/chat/chat-message-utils.ts
git mv lib/chat-storage.ts lib/chat/chat-storage.ts
git mv lib/chat-ui-helpers.ts lib/chat/chat-ui-helpers.ts
git mv lib/global-chat-context.ts lib/chat/global-chat-context.ts

git mv lib/draft-proposal.ts lib/notes/draft-proposal.ts
git mv lib/enhancement-context.ts lib/notes/enhancement-context.ts
git mv lib/enhancement-errors.ts lib/notes/enhancement-errors.ts
git mv lib/note-normalization.ts lib/notes/note-normalization.ts
git mv lib/notes-generation.ts lib/notes/notes-generation.ts
git mv lib/prompts.ts lib/notes/prompts.ts

git mv lib/tiptap-converter.ts lib/tiptap/tiptap-converter.ts
git mv lib/meeting-editor-extensions.ts lib/tiptap/meeting-editor-extensions.ts

git mv lib/meeting-actions.ts lib/meetings/meeting-actions.ts
git mv lib/meeting-pipeline.ts lib/meetings/meeting-pipeline.ts
git mv lib/meeting-upload.ts lib/meetings/meeting-upload.ts
git mv lib/meeting-workspace.ts lib/meetings/meeting-workspace.ts
```

- [ ] **Step 3: Run typecheck to see import breakage**

```bash
bun run typecheck 2>&1 | head -100
```

Expected: a flood of "Cannot find module '@/lib/chat-storage'" etc. This is normal. Capture the list of files with errors.

- [ ] **Step 4: Find all the imports to update**

```bash
# Find all files importing from any of the moved paths
rg "@/lib/(api-helpers|chat-attachments|chat-message-utils|chat-storage|chat-ui-helpers|global-chat-context|draft-proposal|enhancement-context|enhancement-errors|note-normalization|notes-generation|prompts|tiptap-converter|meeting-editor-extensions|meeting-actions|meeting-pipeline|meeting-upload|meeting-workspace)" -l
```

Record the list of files that need import updates.

- [ ] **Step 5: Update imports mechanically**

For each moved file, run a find-and-replace. Use the `Edit` tool with `replace_all: true` on each affected file, or use `sed` in batch:

```bash
# API helpers
rg "@/lib/api-helpers" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/api-helpers|@/lib/api/api-helpers|g' {}

# Chat
rg "@/lib/chat-attachments" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/chat-attachments|@/lib/chat/chat-attachments|g' {}
rg "@/lib/chat-message-utils" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/chat-message-utils|@/lib/chat/chat-message-utils|g' {}
rg "@/lib/chat-storage" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/chat-storage|@/lib/chat/chat-storage|g' {}
rg "@/lib/chat-ui-helpers" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/chat-ui-helpers|@/lib/chat/chat-ui-helpers|g' {}
rg "@/lib/global-chat-context" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/global-chat-context|@/lib/chat/global-chat-context|g' {}

# Notes
rg "@/lib/draft-proposal" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/draft-proposal|@/lib/notes/draft-proposal|g' {}
rg "@/lib/enhancement-context" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/enhancement-context|@/lib/notes/enhancement-context|g' {}
rg "@/lib/enhancement-errors" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/enhancement-errors|@/lib/notes/enhancement-errors|g' {}
rg "@/lib/note-normalization" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/note-normalization|@/lib/notes/note-normalization|g' {}
rg "@/lib/notes-generation" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/notes-generation|@/lib/notes/notes-generation|g' {}
rg "@/lib/prompts" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/prompts|@/lib/notes/prompts|g' {}

# Tiptap
rg "@/lib/tiptap-converter" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/tiptap-converter|@/lib/tiptap/tiptap-converter|g' {}
rg "@/lib/meeting-editor-extensions" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/meeting-editor-extensions|@/lib/tiptap/meeting-editor-extensions|g' {}

# Meetings
rg "@/lib/meeting-actions" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/meeting-actions|@/lib/meetings/meeting-actions|g' {}
rg "@/lib/meeting-pipeline" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/meeting-pipeline|@/lib/meetings/meeting-pipeline|g' {}
rg "@/lib/meeting-upload" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/meeting-upload|@/lib/meetings/meeting-upload|g' {}
rg "@/lib/meeting-workspace" -l --type ts --type tsx | xargs -I {} sed -i '' 's|@/lib/meeting-workspace|@/lib/meetings/meeting-workspace|g' {}
```

**Note**: macOS `sed` requires the `''` empty backup argument. Linux would use `sed -i`.

- [ ] **Step 6: Run typecheck and confirm zero errors**

```bash
bun run typecheck
```

Expected: passes cleanly. If anything still fails, grep for the broken import and fix by hand.

- [ ] **Step 7: Run lint and tests**

```bash
bun run lint && bun test
```

Both pass. If any test references a moved file by relative path (unusual but possible), update it.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: reorganize lib/ into chat/notes/tiptap/meetings/api subdomains"
```

---

## Task 3: Create API validation middleware + migrate 3 simple routes

**Why:** Every API route opens with:
```ts
const rawBody = await request.json().catch(() => null)
const parsed = schema.safeParse(rawBody)
if (!parsed.success) return errorResponse('Invalid request', 'INVALID_INPUT', 400)
```
That's 4 lines × 26 routes = 104 lines of pure boilerplate. A `validateBody` helper collapses each to one line. This task creates the helper and migrates 3 simple routes as a proof. Task 4 does the rest.

**Files:**
- Create: `lib/api/validate.ts`
- Test: `lib/__tests__/validate.test.ts`
- Modify: `app/api/meetings/[id]/pin/route.ts`
- Modify: `app/api/sources/route.ts` (if uses JSON body — check first; if it's FormData, skip it for Task 4's FormData variant)
- Modify: One other simple POST route (pick `app/api/meetings/[id]/document/route.ts` if it uses JSON body)

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/validate.test.ts`:

```ts
import { describe, test, expect } from 'bun:test'
import { z } from 'zod'
import { validateBody } from '@/lib/api/validate'

const schema = z.object({
  pinned: z.boolean(),
})

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('validateBody', () => {
  test('returns parsed data when body matches schema', async () => {
    const request = makeRequest({ pinned: true })
    const result = await validateBody(request, schema)
    expect(result).toBeInstanceOf(Object)
    expect('data' in result && result.data).toEqual({ pinned: true })
  })

  test('returns 400 error Response when body is invalid', async () => {
    const request = makeRequest({ pinned: 'yes' })
    const result = await validateBody(request, schema)
    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(400)
      const body = await result.json()
      expect(body.code).toBe('INVALID_INPUT')
    }
  })

  test('returns 400 when body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{',
    })
    const result = await validateBody(request, schema)
    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(400)
    }
  })

  test('returns 400 when body is empty', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await validateBody(request, schema)
    expect(result).toBeInstanceOf(Response)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
bun test lib/__tests__/validate.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/api/validate'".

- [ ] **Step 3: Create the validation middleware**

Create `lib/api/validate.ts`:

```ts
import type { ZodSchema, z } from 'zod'
import { errorResponse } from '@/lib/api/api-helpers'

/**
 * Parse and validate a request body against a Zod schema.
 *
 * On success, returns `{ data }` with the typed parsed value.
 * On failure, returns a 400 Response that can be returned directly from the route handler.
 *
 * Usage:
 *   const validated = await validateBody(request, schema)
 *   if (validated instanceof Response) return validated
 *   const { data } = validated
 */
export async function validateBody<T extends ZodSchema>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | Response> {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return errorResponse('Request body must be valid JSON', 'INVALID_INPUT', 400)
  }

  const parsed = schema.safeParse(rawBody)
  if (!parsed.success) {
    return errorResponse(
      'Invalid request body',
      'INVALID_INPUT',
      400,
    )
  }

  return { data: parsed.data }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
bun test lib/__tests__/validate.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Migrate `app/api/meetings/[id]/pin/route.ts`**

Replace the body of the `PATCH` handler. Before:

```ts
const body = await request.json().catch(() => null)
if (!body || typeof body.pinned !== 'boolean') {
  return errorResponse('Request body must include { pinned: boolean }', 'INVALID_BODY', 400)
}
```

After (add these imports at the top):

```ts
import { validateBody } from '@/lib/api/validate'
import { z } from 'zod'
```

And add a schema above the handler:

```ts
const pinSchema = z.object({
  pinned: z.boolean(),
})
```

Replace the body check with:

```ts
const validated = await validateBody(request, pinSchema)
if (validated instanceof Response) return validated
const { data: body } = validated
```

Then reference `body.pinned` as before.

- [ ] **Step 6: Migrate two more simple routes**

Pick 2 more routes from `app/api/` that:
- Use `request.json()`
- Already use `z.object(...)` Zod schemas
- Are short (under 80 LOC)

Good candidates to check: `app/api/meetings/[id]/document/route.ts`, `app/api/note-templates/route.ts` (any POST), `app/api/meetings/route.ts`.

For each, apply the same migration:
1. Import `validateBody`
2. Replace the parse-and-safeParse dance with `validateBody`
3. Return early if it's a Response
4. Use the typed `data`

- [ ] **Step 7: Run the full test suite**

```bash
bun run typecheck && bun run lint && bun test
```

All pass. Any existing test that hit the migrated routes should still pass because the externally-visible behavior is unchanged.

- [ ] **Step 8: Commit**

```bash
git add lib/api/validate.ts lib/__tests__/validate.test.ts app/api/meetings/[id]/pin/route.ts [other migrated routes]
git commit -m "feat(api): add validateBody middleware and migrate 3 simple routes"
```

---

## Task 4: Migrate all remaining API routes to validateBody

**Why:** Complete the migration started in Task 3. Remove the duplicated JSON-parse-and-Zod-safeParse boilerplate from every remaining route.

**Files:**
- Modify: every `app/api/**/route.ts` that uses `request.json()` with a Zod schema, except the 3 migrated in Task 3

- [ ] **Step 1: Inventory remaining routes**

```bash
rg -l "request.json\(\).catch\(" app/api
```

Expected: 20-ish files. Compare against the list of 26 routes to confirm.

- [ ] **Step 2: For each route, apply the migration pattern**

Repeat this per route:

1. Open the file
2. Ensure `import { validateBody } from '@/lib/api/validate'` is present
3. Find the existing `const rawBody = await request.json().catch(() => null)` pattern
4. Replace with:
   ```ts
   const validated = await validateBody(request, schemaName)
   if (validated instanceof Response) return validated
   const { data: body } = validated  // or parsed — match the variable name the route already used
   ```
5. Verify the rest of the route still compiles against the new typed `body`

**Special cases:**
- **FormData routes** (e.g., `app/api/sources/route.ts` uses FormData for file uploads): **skip** — `validateBody` is JSON-only. These keep their existing FormData handling.
- **Streaming / non-body routes** (e.g., transcribe real-time token, health, GET routes): **skip** — no body to validate.
- **Routes that accept empty bodies optionally**: if the route has optional body handling, still use `validateBody` but with a schema like `z.object({ ... }).optional()` or handle the 400 case explicitly.

- [ ] **Step 3: Typecheck after every ~5 files**

Don't wait until the end. Running typecheck every 5 files catches issues while the context is fresh:

```bash
bun run typecheck
```

- [ ] **Step 4: Run the full test suite**

```bash
bun run typecheck && bun run lint && bun test
```

All existing API route tests must still pass — the observable behavior is unchanged.

- [ ] **Step 5: Grep for leftovers**

```bash
rg "request.json\(\).catch\(" app/api
```

Expected: zero hits, except where justified (FormData routes, etc).

- [ ] **Step 6: Commit**

```bash
git add app/api
git commit -m "refactor(api): migrate remaining routes to validateBody middleware"
```

---

## Task 5: Split `hooks/use-recording.ts`

**Why:** 375-LOC hook mixing MediaStream/AudioContext plumbing with recording state and UI actions. The media stream stuff is the easiest chunk to lift out, and after that the hook becomes a clean composer over `useMediaStream` + `useDeepgramTranscription`.

**Files:**
- Create: `hooks/use-media-stream.ts`
- Create: `hooks/__tests__/use-media-stream.test.tsx` (new test)
- Modify: `hooks/use-recording.ts`

**Target boundaries:**
- `useMediaStream` — owns: `streamRef`, `sourceStreamsRef`, `mediaRecorderRef`, `chunksRef`, `audioContextRef`, `analyserRef`, `stopActiveStreams`, `closeAudioSession`, `recordSystemAudio` state, `hasSystemAudio` state, `analyserReady` state, MediaStream acquisition (`getUserMedia`/`getDisplayMedia`), audio mixing (when `recordSystemAudio` is on).
- `useRecording` — owns: `phase`, `duration`, `isPaused`, `savedSegments`, `savedTranscript`, `timerRef`, all the `handleStart/handleStop/handlePause/handleReset` logic. Composes `useMediaStream` + `useDeepgramTranscription`.

The interface between them:

```ts
export interface UseMediaStreamReturn {
  recordSystemAudio: boolean
  hasSystemAudio: boolean
  setRecordSystemAudio: (value: boolean) => void
  analyserNode: AnalyserNode | null
  acquireStream: () => Promise<{ stream: MediaStream; recorder: MediaRecorder; chunks: Blob[] } | null>
  stopAllStreams: () => void
  closeAudioSession: () => void
}
```

- [ ] **Step 1: Read `hooks/use-recording.ts` in full to understand what to extract**

```bash
cat hooks/use-recording.ts | wc -l
```

Read the whole file. Identify which parts touch `streamRef`, `audioContextRef`, `analyserRef`, MediaStream APIs. Those are going to `useMediaStream`.

- [ ] **Step 2: Write a failing test for `useMediaStream`**

Create `hooks/__tests__/use-media-stream.test.tsx`:

```tsx
import { describe, test, expect } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useMediaStream } from '@/hooks/use-media-stream'

describe('useMediaStream', () => {
  test('initial state: no system audio, no analyser', () => {
    const { result } = renderHook(() => useMediaStream())
    expect(result.current.recordSystemAudio).toBe(false)
    expect(result.current.hasSystemAudio).toBe(false)
    expect(result.current.analyserNode).toBe(null)
  })

  test('setRecordSystemAudio toggles the flag', () => {
    const { result } = renderHook(() => useMediaStream())
    act(() => {
      result.current.setRecordSystemAudio(true)
    })
    expect(result.current.recordSystemAudio).toBe(true)
  })
})
```

Note: Testing `acquireStream` requires mocking `navigator.mediaDevices`, which is out of scope for Phase 1. We're only asserting that the hook exists, exposes the interface, and initial state is correct. The real behavior is covered by end-to-end manual testing of the recording flow.

- [ ] **Step 3: Run test to confirm it fails**

```bash
bun test hooks/__tests__/use-media-stream.test.tsx
```

Expected: FAIL with "Cannot find module '@/hooks/use-media-stream'".

- [ ] **Step 4: Create `hooks/use-media-stream.ts`**

Copy the relevant logic out of `use-recording.ts`:
1. `streamRef`, `sourceStreamsRef`, `mediaRecorderRef`, `chunksRef`, `audioContextRef`, `analyserRef`
2. `recordSystemAudio`, `hasSystemAudio`, `analyserReady` state
3. `stopActiveStreams`, `closeAudioSession`
4. The `getUserMedia`/`getDisplayMedia` acquisition logic (currently inside `handleStartRecording`) — extract as `acquireStream()`

Hook signature:

```ts
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export interface UseMediaStreamReturn {
  recordSystemAudio: boolean
  hasSystemAudio: boolean
  setRecordSystemAudio: (value: boolean) => void
  analyserNode: AnalyserNode | null
  acquireStream: () => Promise<AcquiredStream | null>
  stopAllStreams: () => void
  closeAudioSession: () => void
}

export interface AcquiredStream {
  stream: MediaStream
  recorder: MediaRecorder
  chunks: Blob[]
  analyser: AnalyserNode
}

export function useMediaStream(): UseMediaStreamReturn {
  // Paste the extracted state, refs, and functions from use-recording.ts.
  // Return the interface above.
}
```

**Do not** invent new behavior. Only move what's already there. If a piece of logic depends on something from `useRecording` (e.g., `setPhase`), leave it in `useRecording` and add a callback parameter to `acquireStream` if needed. Keep the cut clean.

- [ ] **Step 5: Run the new test to confirm it passes**

```bash
bun test hooks/__tests__/use-media-stream.test.tsx
```

Expected: both tests pass.

- [ ] **Step 6: Update `hooks/use-recording.ts` to use the new hook**

1. Remove the state/refs/functions you moved to `useMediaStream`
2. Add `const mediaStream = useMediaStream()` near the top
3. Replace references to the old local variables with `mediaStream.recordSystemAudio`, etc.
4. Replace the inline stream acquisition in `handleStartRecording` with `await mediaStream.acquireStream()`
5. Replace `stopActiveStreams()` calls with `mediaStream.stopAllStreams()`
6. Replace `closeAudioSession()` calls with `mediaStream.closeAudioSession()`
7. Update the return object to pass through `recordSystemAudio`, `hasSystemAudio`, `setRecordSystemAudio`, `analyserNode` from `mediaStream`

Target size: `use-recording.ts` should be around 200-230 LOC after the extraction.

- [ ] **Step 7: Typecheck and run tests**

```bash
bun run typecheck && bun run lint && bun test
```

All pass. If `useRecording` consumers (e.g., `MeetingNoteSurface`) break, fix them — the return shape should be unchanged.

- [ ] **Step 8: Manual smoke test**

This is a behavior-preserving refactor but the audio pipeline is finicky. Do a manual smoke test:

```bash
bun dev
```

1. Open `http://localhost:3000`, log in
2. Create a new meeting
3. Start recording (microphone only), speak for 5 seconds, stop
4. Verify: transcript appears, audio waveform shows, stop works cleanly
5. Start recording with "system audio" toggled on, confirm the system audio selector appears

If any step fails, revert the task and investigate.

- [ ] **Step 9: Commit**

```bash
git add hooks/use-media-stream.ts hooks/__tests__/use-media-stream.test.tsx hooks/use-recording.ts
git commit -m "refactor(hooks): extract useMediaStream from useRecording"
```

---

## Task 6: Split `hooks/use-note-enhancement.ts`

**Why:** 381-LOC hook mixing draft proposal state, API calls, document conflict resolution, and editor ref tracking. Extracting the draft proposal state machine cleans it up considerably.

**Files:**
- Create: `hooks/use-draft-proposal.ts`
- Create: `hooks/__tests__/use-draft-proposal.test.tsx`
- Modify: `hooks/use-note-enhancement.ts`

**Target boundaries:**
- `useDraftProposal` — owns: `draftState` (idle/generating/streaming/saving), `reviewState` (server-synced), `undoDocument`, `wasEverEnhanced`, `regenPromptDismissed`, `handleDraftRequest`, and the streaming/API interaction for generate/enhance.
- `useNoteEnhancement` — owns: `documentConflict`, `handleUndo`, `handleLoadLatestVersion`, `handleKeepLocalDraft`, editor ref (`setEditorRef`), composes `useDraftProposal` and exposes the full `UseNoteEnhancementReturn` interface unchanged to callers.

**Critical:** The external interface `UseNoteEnhancementReturn` (declared in `hooks/use-note-enhancement.ts`) must not change. Consumers like `MeetingNoteSurface` depend on the exact shape. The split is internal.

- [ ] **Step 1: Read `hooks/use-note-enhancement.ts` in full**

Walk through every state, every callback, every effect. Classify each as either "draft proposal" (goes to `useDraftProposal`) or "conflict/document" (stays in `useNoteEnhancement`). Write this classification in a scratch comment block if needed — you'll need it in Step 4.

- [ ] **Step 2: Write a failing test for `useDraftProposal`**

Create `hooks/__tests__/use-draft-proposal.test.tsx`:

```tsx
import { describe, test, expect } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { useDraftProposal } from '@/hooks/use-draft-proposal'
import type { Meeting } from '@/lib/types'

const fakeMeeting: Meeting = {
  id: 'test-id',
  user_id: 'user-1',
  title: 'Test',
  status: 'done',
  enhancement_state: null,
  // minimum required fields — copy from lib/types.ts Meeting shape
} as unknown as Meeting

describe('useDraftProposal', () => {
  test('initial state is idle with null review state', () => {
    const { result } = renderHook(() =>
      useDraftProposal(fakeMeeting, {
        currentDocument: { type: 'doc', content: [] },
        currentHash: 'hash-0',
        actionMode: 'generate',
        canReview: false,
        meetingStatus: 'done',
      }),
    )
    expect(result.current.draftState).toBe('idle')
    expect(result.current.wasEverEnhanced).toBe(false)
  })
})
```

Fill in the `fakeMeeting` with whatever fields the `Meeting` type actually requires — check `lib/types.ts`. Keep it minimal.

- [ ] **Step 3: Run test to confirm it fails**

```bash
bun test hooks/__tests__/use-draft-proposal.test.tsx
```

Expected: FAIL with "Cannot find module '@/hooks/use-draft-proposal'".

- [ ] **Step 4: Create `hooks/use-draft-proposal.ts`**

Move the draft proposal state + API interaction out of `use-note-enhancement.ts`. Interface:

```ts
'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { TiptapDocument } from '@/lib/tiptap/tiptap-converter'
import type { EnhancementState, Meeting, MeetingStatus } from '@/lib/types'

export type DraftMode = 'generate' | 'enhance'
export type DraftUiState = 'idle' | 'generating' | 'streaming' | 'saving'

export interface UseDraftProposalParams {
  currentDocument: TiptapDocument
  currentHash: string
  actionMode: DraftMode
  canReview: boolean
  meetingStatus: MeetingStatus
}

export interface UseDraftProposalReturn {
  draftState: DraftUiState
  reviewState: EnhancementState
  undoDocument: TiptapDocument | null
  wasEverEnhanced: boolean
  regenPromptDismissed: boolean
  shouldShowAction: boolean
  setRegenPromptDismissed: (value: boolean) => void
  clearUndoDocument: () => void
  requestDraft: (params: {
    onAccepted: (doc: TiptapDocument, hash: string) => void
    onShowEditor: () => void
    onConflict: (conflict: unknown) => void
  }) => Promise<void>
}

export function useDraftProposal(
  meeting: Meeting,
  params: UseDraftProposalParams,
): UseDraftProposalReturn {
  // paste the extracted logic from useNoteEnhancement here
}
```

**Approach:** Copy the relevant state and callbacks verbatim, adapt their references to the new params shape, and expose them through `UseDraftProposalReturn`. The `handleDraftRequest` logic becomes `requestDraft` and accepts callbacks for the three side effects it currently invokes directly (accepting a doc, showing editor, flagging conflict).

- [ ] **Step 5: Run the test to confirm it passes**

```bash
bun test hooks/__tests__/use-draft-proposal.test.tsx
```

Expected: passes.

- [ ] **Step 6: Update `hooks/use-note-enhancement.ts` to compose `useDraftProposal`**

1. Remove the draft proposal state and callbacks (they now live in `useDraftProposal`)
2. Add `const draftProposal = useDraftProposal(meeting, { ... })` inside the hook
3. Keep `documentConflict`, `handleUndo`, `handleLoadLatestVersion`, `handleKeepLocalDraft`, `setEditorRef`
4. Implement `handleDraftRequest` as a wrapper that calls `draftProposal.requestDraft({ onAccepted, onShowEditor, onConflict: setDocumentConflict })`
5. Return the exact same `UseNoteEnhancementReturn` shape, drawing some fields from `draftProposal` and some from local state

Target size: `use-note-enhancement.ts` should drop to ~200-220 LOC.

- [ ] **Step 7: Typecheck, lint, test**

```bash
bun run typecheck && bun run lint && bun test
```

All pass. Existing tests that hit `useNoteEnhancement` via `MeetingNoteSurface` should still pass because the external interface is unchanged.

- [ ] **Step 8: Manual smoke test**

```bash
bun dev
```

1. Open an existing meeting with content
2. Trigger "Generate notes" (or enhance) — verify the draft state transitions correctly (generating → streaming → saving → idle)
3. Trigger another enhance while the first is in flight — verify the conflict path works (should reject the second call or queue it, whichever is the current behavior)
4. Test undo after an enhance — should restore previous document

- [ ] **Step 9: Commit**

```bash
git add hooks/use-draft-proposal.ts hooks/__tests__/use-draft-proposal.test.tsx hooks/use-note-enhancement.ts
git commit -m "refactor(hooks): extract useDraftProposal from useNoteEnhancement"
```

---

## Task 7: Split `app/api/meetings/[id]/enhance/route.ts`

**Why:** 513-LOC route is the highest-risk code in the app — it handles LLM calls with retry, input validation, conflict detection, and DB persistence all in one file. Splitting into three focused modules makes the orchestrator readable and each piece independently testable.

**Files:**
- Create: `lib/notes/enhance-validation.ts`
- Create: `lib/notes/enhance-llm.ts`
- Create: `lib/notes/enhance-persist.ts`
- Modify: `app/api/meetings/[id]/enhance/route.ts`
- Keep: `app/api/meetings/[id]/enhance/route.test.ts` — all existing tests must still pass

**Target boundaries:**

| Module | Responsibility |
|---|---|
| `enhance-validation.ts` | Parse request body, validate action/payload discriminated union, check rate limits, verify meeting ownership via RLS, detect source-hash conflicts with `lastReviewedSourceHash`, return a typed `ValidatedEnhanceRequest` or a `Response` for 4xx errors. Owns the `DraftProposalValidationError` class. |
| `enhance-llm.ts` | Assemble the prompt, call the LLM with retry logic, parse the response into a `TiptapDocument`, return `{ document, reasoning, usage }`. Zero DB access. |
| `enhance-persist.ts` | Normalize the enhancement state, write the updated `enhancement_state` and `document_content` rows to Supabase, return the updated `Meeting`. Zero LLM access. |
| `route.ts` | Thin orchestrator: `validate → llm → persist → respond`. Target: ~120 LOC. |

- [ ] **Step 1: Read `app/api/meetings/[id]/enhance/route.ts` in full**

```bash
wc -l app/api/meetings/\[id\]/enhance/route.ts
```

Should be 513. Walk through each block and tag it `validation`, `llm`, or `persist`. Keep the tags in a scratch note.

- [ ] **Step 2: Check existing tests still run green**

```bash
bun test app/api/meetings/\[id\]/enhance/route.test.ts
```

All pass. This is your regression suite.

- [ ] **Step 3: Create `lib/notes/enhance-validation.ts`**

Extract every validation concern:
- The Zod schemas for the discriminated-union request body
- The `DraftProposalValidationError` class
- The rate-limit check
- The meeting ownership check (Supabase query that verifies `user_id = auth.uid()`)
- The source-hash conflict detection (`normalizeEnhancementState` and its comparison)

Expose:

```ts
export interface ValidatedEnhanceRequest {
  meeting: Meeting
  action: 'generate' | 'enhance'
  payload: /* the typed payload */
  supabase: SupabaseClient  // already-authenticated client for downstream use
}

export async function validateEnhanceRequest(
  request: Request,
  meetingId: string,
): Promise<ValidatedEnhanceRequest | Response>

export class DraftProposalValidationError extends Error { ... }
```

- [ ] **Step 4: Create `lib/notes/enhance-llm.ts`**

Extract every LLM concern:
- Prompt assembly (pull from `lib/notes/prompts.ts` — already moved in Task 2)
- `openai` client setup (already in `lib/openai.ts`)
- Retry logic
- Response parsing into `TiptapDocument`

Expose:

```ts
export interface LlmEnhanceResult {
  document: TiptapDocument
  reasoning?: string
  tokensUsed: number
}

export async function runEnhanceLlm(
  request: ValidatedEnhanceRequest,
  currentDocument: TiptapDocument,
): Promise<LlmEnhanceResult>
```

**No DB access in this module.** If the current code interleaves LLM and DB calls, you may need to thread state through — that's fine, do it explicitly.

- [ ] **Step 5: Create `lib/notes/enhance-persist.ts`**

Extract every DB concern:
- `normalizeEnhancementState`
- Writing `enhancement_state`, `document_content`, `document_hash` to the `meetings` table
- Any Sentry breadcrumbs for persist errors

Expose:

```ts
export interface PersistEnhanceResult {
  updatedMeeting: Meeting
  newDocumentHash: string
}

export async function persistEnhanceResult(
  request: ValidatedEnhanceRequest,
  llmResult: LlmEnhanceResult,
): Promise<PersistEnhanceResult>
```

- [ ] **Step 6: Rewrite `app/api/meetings/[id]/enhance/route.ts` as an orchestrator**

```ts
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { validateEnhanceRequest } from '@/lib/notes/enhance-validation'
import { runEnhanceLlm } from '@/lib/notes/enhance-llm'
import { persistEnhanceResult } from '@/lib/notes/enhance-persist'
import { errorResponse } from '@/lib/api/api-helpers'

export const maxDuration = 60

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  if (!id) return errorResponse('Missing meetingId', 'INVALID_MEETING_ID', 400)

  try {
    const validated = await validateEnhanceRequest(request, id)
    if (validated instanceof Response) return validated

    const currentDocument = /* extract from validated.meeting — fill in */
    const llmResult = await runEnhanceLlm(validated, currentDocument)
    const persisted = await persistEnhanceResult(validated, llmResult)

    return NextResponse.json({
      meeting: persisted.updatedMeeting,
      documentHash: persisted.newDocumentHash,
      reasoning: llmResult.reasoning,
    })
  } catch (error: unknown) {
    Sentry.captureException(error, { tags: { route: 'meetings/enhance' } })
    const message = error instanceof Error ? error.message : 'Enhancement failed'
    return errorResponse(message, 'ENHANCE_FAILED', 500)
  }
}
```

Fill in the `/* extract from validated.meeting */` based on the original code. Target the full file at ~120 LOC.

- [ ] **Step 7: Run the existing test suite against the refactored route**

```bash
bun test app/api/meetings/\[id\]/enhance/route.test.ts
```

**Expected: every one of the existing 715 lines of tests still passes.** If any test fails, it's almost always because a value moved but the test still expects the old shape. Fix the module boundary, not the test.

- [ ] **Step 8: Full quality gate**

```bash
bun run typecheck && bun run lint && bun test
```

All pass.

- [ ] **Step 9: Commit**

```bash
git add lib/notes/enhance-validation.ts lib/notes/enhance-llm.ts lib/notes/enhance-persist.ts app/api/meetings/[id]/enhance/route.ts
git commit -m "refactor(api): split enhance route into validation/llm/persist modules"
```

---

## Task 8: Structured logging migration

**Why:** Bare `console.*` calls in serverless API routes are swallowed on Vercel — they don't show up in the logs UI reliably and they don't tie to Sentry traces. Routing through Sentry gives us durable, searchable error visibility.

**Files:**
- Modify: every file in `app/api/**/route.ts` with a bare `console.error` / `console.warn` / `console.info`
- Modify: every file in `lib/api/**` with the same

**Rule (per spec §5.5):** No bare `console.*` in `app/api/**` or `lib/api/**`. Errors go through `Sentry.captureException`, events go through `Sentry.captureMessage` + `Sentry.addBreadcrumb` as appropriate. `console.log` in dev-only code paths is fine; `console.*` elsewhere in the repo (components, hooks, workers, scripts) is out of scope for Phase 1.

- [ ] **Step 1: Inventory the offenders**

```bash
rg "console\.(error|warn|info)" app/api lib/api
```

Record the list of files and line numbers.

- [ ] **Step 2: Verify Sentry is importable**

Sentry is already wired (per recent commits). Confirm:

```bash
rg "from '@sentry/nextjs'" app/api | head -5
```

If Sentry is imported in at least one API route already, you know the pattern is `import * as Sentry from '@sentry/nextjs'`.

- [ ] **Step 3: Migrate each offender**

For each `console.error`:

```ts
// Before
console.error('Failed to save draft', error)

// After
import * as Sentry from '@sentry/nextjs'
Sentry.captureException(error, {
  tags: { route: '/api/...' },  // fill in the current route
  extra: { context: 'Failed to save draft' },
})
```

For each `console.info` (informational events worth keeping):

```ts
// Before
console.info('Draft enhancement started', { meetingId })

// After
Sentry.addBreadcrumb({
  category: 'enhance',
  message: 'Draft enhancement started',
  level: 'info',
  data: { meetingId },
})
```

For each `console.warn` (non-fatal warnings):

```ts
// After
Sentry.captureMessage('Unexpected state during enhance', {
  level: 'warning',
  extra: { meetingId },
})
```

If a `console.info` is clearly debug noise (not a meaningful event), just delete it.

- [ ] **Step 4: Verify no bare `console.*` remain in scope**

```bash
rg "console\.(error|warn|info)" app/api lib/api
```

Expected: zero hits. `console.log` hits are acceptable only if they're clearly dev-guarded (e.g., inside `if (process.env.NODE_ENV === 'development')`).

- [ ] **Step 5: Full quality gate**

```bash
bun run typecheck && bun run lint && bun test
```

All pass.

- [ ] **Step 6: Commit**

```bash
git add app/api lib/api
git commit -m "refactor(api): route error and event logging through Sentry"
```

---

## Phase 1 Completion Checklist

After Task 8 commits, verify the whole phase landed clean:

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun test` passes (all existing tests green; new validate + use-media-stream + use-draft-proposal tests added)
- [ ] `git log --oneline | head -10` shows exactly 8 new commits (one per task)
- [ ] `docs/superpowers/investigations/2026-04-15-chat-endpoints.md` exists and is filled in
- [ ] `ls lib/` shows `api/`, `chat/`, `notes/`, `tiptap/`, `meetings/`, `supabase/` directories plus cross-cutting files
- [ ] `wc -l hooks/use-recording.ts hooks/use-note-enhancement.ts app/api/meetings/[id]/enhance/route.ts` shows all three significantly smaller (target: each under 250 LOC)
- [ ] `rg "request.json\(\).catch\(" app/api` shows only FormData/special-case routes
- [ ] `rg "console\.(error|warn|info)" app/api lib/api` shows zero hits
- [ ] Manual smoke test: record a meeting, generate notes, undo — all still works

When all of the above are true, Phase 1 is done. Report back and we'll write Phase 2.

---

## Rollback Plan

If Phase 1 lands but something in production breaks:

```bash
git log --oneline  # find the last good commit before Phase 1
git revert <bad-commit-sha>  # revert one task at a time — never reset
```

Each task is a single commit, so you can revert any one in isolation. Tasks 2 (lib reorg) and 5/6 (hook splits) are the highest-risk — they're the ones most likely to surface a broken import or missed edge case.

Do not `git reset --hard` or force-push. Only use `git revert`.
