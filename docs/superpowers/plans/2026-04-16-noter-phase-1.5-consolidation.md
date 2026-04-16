# Noter Phase 1.5 — Pre-Phase-2 Consolidation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the product-level slop in the note-generation flow — fake streaming, fail-closed rate limits, dead status values, duplicate LLM call logic, user-hostile error strings — before Phase 2 touches visuals or the Workspace token system.

**Architecture:** Five sequential tasks. Each hardens or prunes a different axis of the flow. None touch Phase 1's architecture (subdomains, middleware, hook splits). **Chat routes (`/api/chat`, `/api/chat/support`, `/api/chat/global`) are explicitly out of scope per product decision** — their consolidation happens in Phase 2.

**Tech Stack:** Same as Phase 1 — Next.js 16 + webpack dev, React 19, TypeScript strict, Supabase, Tiptap 3, `@upstash/ratelimit`, `@sentry/nextjs`, Bun test runner.

**Reference:** Static audit at [docs/superpowers/specs/2026-04-15-noter-workspace-redesign.md](../specs/2026-04-15-noter-workspace-redesign.md) §4.3 + the Phase 1.5 findings from the browser-verified audit (chat, enhance, and generate-notes all share the same rate-limit fail-closed pattern; the enhance route 500s reproducibly when Upstash is unreachable).

**Branch:** Continue on `refactor/making-the-app-even-better`. Each task is its own commit.

**Quality gates after every task:**
```bash
bun run typecheck
bun run lint
bun test
```
Plus a manual browser verification via `agent-browser` for UI-touching tasks (Tasks 2 and 5).

**Worker pipeline fate — DECIDED 2026-04-16 (option b)**: the `/api/processing/worker` + `/api/meetings/[id]/process` + `processing_jobs` table + self-host fallback are being **deleted entirely**. Self-host users run the same `/api/generate-notes` path as SaaS. `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` become optional env vars.

This affects:
- **Task 3** — Step 2 (worker deletion) is now required, not conditional.
- **Task 4** — `'transcribing'` is also removed (becomes unreachable once the worker is gone).
- **CLAUDE.md** and **.env.example** — update to reflect the two env vars as optional.

---

## File Structure (target state after Phase 1.5)

```
lib/
├── api/
│   ├── api-helpers.ts        # existing
│   ├── validate.ts           # existing (Task 3 of Phase 1)
│   └── rate-limit.ts         # NEW: createRateLimiter + checkRateLimit helpers
├── notes/
│   ├── [unchanged from Phase 1]
│   ├── notes-generation.ts   # SLIMMED: uses shared llm-call helper
│   ├── enhance-llm.ts        # SLIMMED: uses shared llm-call helper
│   ├── llm-call.ts           # NEW: unified OpenAI call with retry (optional, Task 3 decides)
│   └── error-messages.ts     # NEW: technical-error → user-friendly mapping
├── [unchanged]

app/api/
├── [unchanged structure]
│   └── all 8 ratelimit.limit() call sites migrated to checkRateLimit()

hooks/
├── use-draft-proposal.ts     # SLIMMED: drop STREAMING_BLOCK_DELAY_MS, streaming state, streamingCancelledRef

lib/types.ts                   # UPDATED: MeetingStatus enum pruned
```

**What does NOT change in Phase 1.5:**
- No CSS / token changes — that's Phase 2
- No visual component rewrites — Phase 2/3
- Chat routes untouched (explicit user instruction)
- `enhance-persist.ts`'s `NextResponse`-from-lib issue — tracked for Phase 3
- `lib/meetings/meeting-pipeline.ts` `'use client'` issue — tracked for Phase 2

---

## Task 1: Rate-limit hardening (fail-open + single helper)

**Why first:** Every subsequent task touches at least one rate-limited endpoint. If the fail-closed pattern stays in place, any transient Upstash hiccup 500s the whole flow and masks real bugs. Fix this first so the rest of Phase 1.5 can be verified against a stable API surface.

**Problem:** Eight call sites across the app pattern `const { success } = await ratelimit.limit(key)` with no try/catch. On Upstash outage, the exception escapes all local try/catch blocks (because the outer `validateEnhanceRequest` isn't wrapped), lands in Next.js's default 500 handler, and returns a 500 with empty body. Sentry doesn't get the route tag because the exception never reaches the catch that tags it.

**Files:**
- Create: `lib/api/rate-limit.ts`
- Test: `lib/__tests__/rate-limit.test.ts`
- Modify: 8 call sites (list in Step 4)

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/rate-limit.test.ts`:

```ts
import { describe, test, expect, mock } from 'bun:test'
import { checkRateLimit } from '@/lib/api/rate-limit'

function fakeRatelimit(impl: (key: string) => Promise<{ success: boolean }>) {
  return { limit: impl } as unknown as Parameters<typeof checkRateLimit>[0]
}

describe('checkRateLimit', () => {
  test('returns true when ratelimit is null (no ratelimit configured)', async () => {
    const result = await checkRateLimit(null, 'key', 'test-route')
    expect(result).toBe(true)
  })

  test('returns true when limit() reports success', async () => {
    const rl = fakeRatelimit(async () => ({ success: true }))
    const result = await checkRateLimit(rl, 'key', 'test-route')
    expect(result).toBe(true)
  })

  test('returns false when limit() reports rate-limited', async () => {
    const rl = fakeRatelimit(async () => ({ success: false }))
    const result = await checkRateLimit(rl, 'key', 'test-route')
    expect(result).toBe(false)
  })

  test('fails open (returns true) when limit() throws', async () => {
    const rl = fakeRatelimit(async () => {
      throw new Error('Upstash unreachable')
    })
    const result = await checkRateLimit(rl, 'key', 'test-route')
    expect(result).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test lib/__tests__/rate-limit.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/api/rate-limit'".

- [ ] **Step 3: Implement the helper**

Create `lib/api/rate-limit.ts`:

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import * as Sentry from '@sentry/nextjs'

/**
 * Create a configured rate limiter, or null if Upstash env vars are absent.
 * Callers should pass the returned value to checkRateLimit() below.
 */
export function createRateLimiter(requests: number, window: `${number} ${'s' | 'm' | 'h'}`): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
  })
}

/**
 * Check if a request is allowed under the given rate limit.
 *
 * - If ratelimit is null (not configured), always returns true.
 * - On successful check, returns the `success` flag from Upstash.
 * - On backend failure (network error, Upstash down, etc.), logs a warning
 *   to Sentry and returns true — fail open, because rate limiting should
 *   never cause a 500.
 */
export async function checkRateLimit(
  ratelimit: Ratelimit | null,
  key: string,
  routeTag: string,
): Promise<boolean> {
  if (!ratelimit) return true
  try {
    const { success } = await ratelimit.limit(key)
    return success
  } catch (error) {
    Sentry.captureException(error, {
      tags: { route: routeTag, phase: 'ratelimit' },
      level: 'warning',
    })
    return true
  }
}
```

- [ ] **Step 4: Run test to confirm pass**

```bash
bun test lib/__tests__/rate-limit.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Migrate the 8 call sites**

For each of the following files, replace the existing `new Ratelimit({...})` construction with `createRateLimiter(N, 'M m')` and the `ratelimit.limit(...)` call pattern with `checkRateLimit(ratelimit, key, routeTag)`:

| File | Current requests/window | Route tag |
|---|---|---|
| `app/api/generate-notes/route.ts` | 5, 1m | `generate-notes` |
| `app/api/chat/support/route.ts` | 10, 1m | `chat/support` |
| `app/api/chat/route.ts` | 10, 1m | `chat` |
| `app/api/chat/global/route.ts` | 10, 1m | `chat/global` |
| `app/api/sources/route.ts` | 5, 1m | `sources` |
| `app/api/meetings/[id]/process/route.ts` | 10, 1m | `meetings/process` |
| `app/api/transcribe/route.ts` | 10, 1m | `transcribe` |
| `lib/notes/enhance-validation.ts` | 5, 1m | `meetings/enhance` |

**Migration pattern per file:**

Before:
```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(N, 'M m'),
        analytics: true,
      })
    : null

// ... later in handler:
if (ratelimit) {
  const { success } = await ratelimit.limit(`key_${user.id}`)
  if (!success) {
    return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
  }
}
```

After:
```ts
import { createRateLimiter, checkRateLimit } from '@/lib/api/rate-limit'

const ratelimit = createRateLimiter(N, 'M m')

// ... later in handler:
const allowed = await checkRateLimit(ratelimit, `key_${user.id}`, 'route-tag')
if (!allowed) {
  return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
}
```

- [ ] **Step 6: Verify no regressions**

```bash
rg "import \{ Ratelimit \}" app/api lib/notes
```

Expected: zero hits outside `lib/api/rate-limit.ts` itself.

```bash
rg "ratelimit\.limit\(" app/api lib
```

Expected: zero hits (all migrated to `checkRateLimit`).

- [ ] **Step 7: Full quality gate**

```bash
bun run typecheck && bun run lint && bun test
```

Test count should be **286 + 4 = 290** passing (4 new rate-limit tests).

- [ ] **Step 8: Commit**

```bash
git add lib/api/rate-limit.ts lib/__tests__/rate-limit.test.ts
git add app/api/generate-notes/route.ts app/api/chat/support/route.ts
git add app/api/chat/route.ts app/api/chat/global/route.ts
git add app/api/sources/route.ts app/api/meetings/[id]/process/route.ts
git add app/api/transcribe/route.ts lib/notes/enhance-validation.ts
git commit -m "fix(api): fail-open rate limiting with checkRateLimit helper (8 routes)"
```

---

## Task 2: Drop fake streaming in `useDraftProposal`

**Why:** The "streaming" in the draft proposal flow is a lie. The enhance API call returns a complete document. The client then trickles it into the editor 50ms per block via a `setTimeout` loop for "perceived UX". This adds:

- An entire `'streaming'` state in `draftState` enum
- A `streamingCancelledRef` for cancellation mid-"stream"
- ~80 LOC of block-by-block insertion + delay logic
- A tangible UX regression — the content is already there, we're just hiding it behind artificial delay

Removing it makes the app faster, drops state, and kills one source of ref-shadowing-state complexity.

**Files:**
- Modify: `hooks/use-draft-proposal.ts`
- Modify: `hooks/use-note-enhancement.ts` (consumer of `draftState`)
- Modify: consumers of `draftState` if any UI branches on `'streaming'`
- Modify: `hooks/__tests__/use-draft-proposal.test.tsx` (initial-state test should still pass unchanged; if any other test checks `'streaming'`, update)

- [ ] **Step 1: Find every consumer of `draftState === 'streaming'`**

```bash
rg "'streaming'" hooks components app --type ts --type tsx
```

List all hits. Classify each as:
- "State machine internal" — can be removed with the state
- "UI branch" — needs to either be merged into another state or deleted

- [ ] **Step 2: Find every reference to `streamingCancelledRef`**

```bash
rg "streamingCancelledRef" hooks --type ts --type tsx
```

Same classification.

- [ ] **Step 3: Find every reference to `STREAMING_BLOCK_DELAY_MS`**

```bash
rg "STREAMING_BLOCK_DELAY_MS" hooks --type ts --type tsx
```

All uses should be in `use-draft-proposal.ts`.

- [ ] **Step 4: Rewrite `streamProposedDocument` in `use-draft-proposal.ts`**

Find `streamProposedDocument` (currently around lines 146–231). Replace its block-by-block setTimeout loop with a single `editor.commands.setContent(proposedDocument)` call (or the equivalent single-shot Tiptap command the current code uses at the end of the loop).

Target: the entire function shrinks to ~20 LOC. No `setTimeout`, no cancellation check mid-loop.

**Do NOT remove:**
- The state transition from `'generating'` → `'saving'` → `'idle'`
- The error handling / toast on LLM failure
- The pre-streaming editor ref wait (`waitForEditor`)

**DO remove:**
- `STREAMING_BLOCK_DELAY_MS` constant and its `setTimeout` usage
- Block-by-block iteration
- `streamingCancelledRef` if it becomes unused (verify with grep after)
- `'streaming'` value from the `DraftUiState` type (if no UI consumes it)

- [ ] **Step 5: Update consumers**

For each UI hit found in Step 1 that branches on `draftState === 'streaming'`:
- If the branch showed a "streaming" status label, merge it into the `'generating'` branch (they're logically the same — "AI is working")
- If the branch enabled a cancel button mid-stream, remove the button (no cancellation needed when there's no stream to cancel)

- [ ] **Step 6: Quality gate**

```bash
bun run typecheck && bun run lint && bun test
```

Test count should still be 290. If a test asserted on `draftState === 'streaming'`, update it to `'generating'` — but verify the test is still meaningfully testing behavior, not just the state name.

- [ ] **Step 7: Browser smoke test**

```bash
# Dev server should already be running
agent-browser open http://localhost:3000/auth/login
# (use your test creds to log in manually if needed, or have the user do it)
# Navigate to an existing meeting with notes, click "Improve with AI"
# Verify: proposal appears instantly, not trickling
# Verify: accept flow still works
```

Capture screenshot of the proposal showing instantly vs. the old trickle behavior.

- [ ] **Step 8: Commit**

```bash
git add hooks/use-draft-proposal.ts hooks/use-note-enhancement.ts
git add [any UI component that branched on 'streaming']
git add [any test file updated]
git commit -m "refactor(hooks): drop fake streaming in useDraftProposal for snappier UX"
```

---

## Task 3: Unify the LLM call path

**Why:** Both `/api/generate-notes` and `/api/meetings/[id]/enhance` (generate mode) ultimately call OpenAI with a system prompt + template context + the transcript/document. They do it via two independent pipelines:

- `generateNotesFromTranscript()` in `lib/notes/notes-generation.ts` — single attempt, uses `buildNotesGenerationPrompt()`
- `runEnhanceLlm()` in `lib/notes/enhance-llm.ts` — 2-attempt retry, uses `buildDraftProposalPrompt()`

The retry logic in one and not the other is pure accident of when each file was written. The prompt differentiation is legitimate (initial generation vs refinement), but the OpenAI SDK call, error handling, and response parsing can be shared.

**Decision required before starting this task**: the user must answer the pre-start decision at the top of this plan (worker pipeline fate). This task's scope depends on the answer.

**If (a) keep worker**: Task 3 extracts a shared `callNoteLlm()` helper in `lib/notes/llm-call.ts`. Both `generateNotesFromTranscript()` and `runEnhanceLlm()` delegate to it. Two prompts stay, one LLM call path.

**If (b) delete worker**: Same extraction, plus delete `app/api/processing/worker/`, `app/api/meetings/[id]/process/`, `lib/meetings/meeting-pipeline.ts`'s `runLegacyPipeline` function, the `processing_jobs` DB table (new migration `scripts/009_drop_processing_jobs.sql`), and all associated tests.

**Files (option a baseline):**
- Create: `lib/notes/llm-call.ts`
- Test: `lib/__tests__/llm-call.test.ts`
- Modify: `lib/notes/notes-generation.ts` (slim, delegates to llm-call)
- Modify: `lib/notes/enhance-llm.ts` (slim, delegates to llm-call)

- [ ] **Step 1: Ask the user the pre-start decision**

Before touching any code, report back with:

> "Phase 1.5 Task 3 needs a decision: should the processing worker pipeline (`/api/processing/worker`, `/api/meetings/[id]/process`, `processing_jobs` table) be:
> - (a) kept and documented as a self-host fallback, or
> - (b) deleted entirely, with self-host users running via the canonical SaaS path instead?
>
> My recommendation: (b). It simplifies the codebase significantly (~500 LOC, 1 DB table, 2 env vars optional instead of required) and the SaaS path works for self-host too. But if you want to preserve the queue-based job infrastructure for future durability/retry guarantees, (a) is defensible."

Wait for user response before proceeding. If (a), skip ahead to Step 3. If (b), first do the deletions in Step 2.

- [ ] **Step 2: (Only if decision is (b)) Delete worker pipeline**

In order:

1. Delete `app/api/meetings/[id]/process/` (route + test)
2. Delete `app/api/processing/worker/` (route + test)
3. Delete the worker invocation in `lib/meetings/meeting-upload.ts` — this file calls the process route as a fallback
4. Delete `runLegacyPipeline()` and related exports from `lib/meetings/meeting-pipeline.ts`
5. Add migration `scripts/009_drop_processing_jobs.sql`:
   ```sql
   drop table if exists public.processing_jobs cascade;
   ```
6. Update `CLAUDE.md`'s env section: mark `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` as optional
7. Update `.env.example` with comments clarifying these are no longer required

Commit this as its own atomic commit before proceeding:

```bash
git add -u app/api/meetings app/api/processing
git add scripts/009_drop_processing_jobs.sql CLAUDE.md .env.example lib/meetings/
git commit -m "refactor: delete unused processing worker pipeline"
```

- [ ] **Step 3: Write the failing test for `callNoteLlm`**

Create `lib/__tests__/llm-call.test.ts`:

```ts
import { describe, test, expect, mock } from 'bun:test'
import { callNoteLlm, LlmCallError } from '@/lib/notes/llm-call'
import { z } from 'zod'

const testSchema = z.object({
  summary: z.string(),
})

describe('callNoteLlm', () => {
  test('returns parsed output on first-attempt success', async () => {
    const generateObject = mock(async () => ({
      object: { summary: 'test summary' },
      usage: { totalTokens: 100 },
    }))
    const result = await callNoteLlm({
      model: 'gpt-4o-mini',
      prompt: 'system prompt',
      schema: testSchema,
      maxAttempts: 2,
      _generateObject: generateObject as any,
    })
    expect(result.object.summary).toBe('test summary')
    expect(generateObject).toHaveBeenCalledTimes(1)
  })

  test('retries once on retryable failure then succeeds', async () => {
    let calls = 0
    const generateObject = mock(async () => {
      calls += 1
      if (calls === 1) {
        throw new Error('Transient model error')
      }
      return { object: { summary: 'success' }, usage: { totalTokens: 50 } }
    })
    const result = await callNoteLlm({
      model: 'gpt-4o-mini',
      prompt: 'system prompt',
      schema: testSchema,
      maxAttempts: 2,
      _generateObject: generateObject as any,
    })
    expect(result.object.summary).toBe('success')
    expect(calls).toBe(2)
  })

  test('throws LlmCallError after exhausting attempts', async () => {
    const generateObject = mock(async () => {
      throw new Error('Persistent failure')
    })
    await expect(
      callNoteLlm({
        model: 'gpt-4o-mini',
        prompt: 'system prompt',
        schema: testSchema,
        maxAttempts: 2,
        _generateObject: generateObject as any,
      })
    ).rejects.toThrow(LlmCallError)
  })
})
```

- [ ] **Step 4: Run to confirm failure**

```bash
bun test lib/__tests__/llm-call.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/notes/llm-call'".

- [ ] **Step 5: Implement `callNoteLlm`**

Create `lib/notes/llm-call.ts`:

```ts
import { generateObject } from 'ai'
import type { ZodSchema } from 'zod'

export class LlmCallError extends Error {
  constructor(
    public readonly code: 'MODEL_FAILED' | 'INVALID_OUTPUT',
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'LlmCallError'
  }
}

export interface CallNoteLlmParams<T> {
  model: string
  prompt: string
  schema: ZodSchema<T>
  maxAttempts?: number
  temperature?: number
  abortSignal?: AbortSignal
  /** Injected for testability — not used in production. */
  _generateObject?: typeof generateObject
}

export interface CallNoteLlmResult<T> {
  object: T
  usage: { totalTokens: number }
  attemptsUsed: number
}

export async function callNoteLlm<T>(
  params: CallNoteLlmParams<T>,
): Promise<CallNoteLlmResult<T>> {
  const { model, prompt, schema, maxAttempts = 2, temperature, abortSignal } = params
  const generate = params._generateObject ?? generateObject

  let lastError: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await generate({
        model: model as Parameters<typeof generate>[0]['model'],
        prompt,
        schema,
        temperature,
        abortSignal,
      } as Parameters<typeof generate>[0])
      return {
        object: result.object as T,
        usage: { totalTokens: result.usage?.totalTokens ?? 0 },
        attemptsUsed: attempt,
      }
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) break
    }
  }

  throw new LlmCallError(
    'MODEL_FAILED',
    lastError instanceof Error ? lastError.message : 'LLM call failed',
    lastError,
  )
}
```

**Note**: the `_generateObject` parameter is a test-only seam. Production callers use the default import. The type cast on `model` is pragmatic — the AI SDK's model typing is complex and varies per version; real callers will pass a compatible value.

- [ ] **Step 6: Run tests to confirm pass**

```bash
bun test lib/__tests__/llm-call.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 7: Migrate `generateNotesFromTranscript()` to use `callNoteLlm`**

In `lib/notes/notes-generation.ts`, replace the direct `generateObject()` call (around lines 65–95) with a call to `callNoteLlm()`:

```ts
import { callNoteLlm } from '@/lib/notes/llm-call'
// ...

const { object } = await callNoteLlm({
  model: METADATA_MODEL,
  prompt: buildNotesGenerationPrompt(template),
  schema: generatedNotesSchema,
  maxAttempts: 1,  // original was single-attempt
})
```

Remove the direct `openai` SDK import if this was its only use.

- [ ] **Step 8: Migrate `runEnhanceLlm()` to use `callNoteLlm`**

In `lib/notes/enhance-llm.ts`, replace the retry loop (lines 94–161) with a call to `callNoteLlm()` with `maxAttempts: 2`. Keep the `firstPassFailureReason` repair-feedback logic outside the helper (if it was used) — that's an enhance-specific concern.

Note: if the 2-attempt retry with repair feedback is load-bearing (the enhance route passes feedback from attempt 1 into attempt 2's prompt), keep that logic in `enhance-llm.ts` but implement it as two separate `callNoteLlm` calls rather than a single call with `maxAttempts=2`. The helper handles retry-without-feedback; repair-feedback is a higher-level policy.

- [ ] **Step 9: Quality gate**

```bash
bun run typecheck && bun run lint && bun test
```

Test count: **290 + 3 = 293** passing (3 new llm-call tests). All existing enhance + generate-notes tests still pass.

- [ ] **Step 10: Browser smoke test**

```bash
# With dev server running and logged in via agent-browser:
# Open an existing meeting, click "Improve with AI"
# Verify: enhance flow works end-to-end
# Expected: response within a few seconds, proposal appears, accept persists
```

- [ ] **Step 11: Commit**

```bash
git add lib/notes/llm-call.ts lib/__tests__/llm-call.test.ts
git add lib/notes/notes-generation.ts lib/notes/enhance-llm.ts
git commit -m "refactor(notes): extract shared callNoteLlm helper from generate + enhance"
```

---

## Task 4: Prune dead `MeetingStatus` enum values

**Why:** The static audit found that `'transcribing'` is unreachable in the SaaS flow (Deepgram always fills transcript) and `'uploading'` is never written to the DB (only used as a UI-polling intermediate). Browser verification confirmed the UI renders identical state for `'transcribing'` and `'generating'`. This is dead lore in the state machine.

**Scope:**
- `'uploading'` → remove from `MeetingStatus` type; update UI-polling code that used it as an intermediate state to just use the equivalent derived value
- `'transcribing'` → if Task 3's decision was (b) delete worker, remove; if (a) keep worker, keep because the worker can still set it

**Files:**
- Modify: `lib/types.ts` (the `MeetingStatus` enum type)
- Modify: any UI or API code that branches on the removed values

- [ ] **Step 1: Find all references**

```bash
rg "'transcribing'|'uploading'" app components hooks lib --type ts --type tsx
```

Categorize each:
- DB writes — verify which values are actually written to the `meetings.status` column
- UI branches — identify which render differently based on the value

- [ ] **Step 2: Remove `'uploading'` from the enum**

In `lib/types.ts`:

```ts
// Before
export type MeetingStatus = 'recording' | 'uploading' | 'transcribing' | 'generating' | 'done' | 'error'

// After (if keeping transcribing per Task 3 decision a)
export type MeetingStatus = 'recording' | 'transcribing' | 'generating' | 'done' | 'error'

// After (if deleted worker per Task 3 decision b)
export type MeetingStatus = 'recording' | 'generating' | 'done' | 'error'
```

- [ ] **Step 3: Update every consumer**

For each reference found in Step 1:
- UI branches that rendered `'uploading'` identically to `'generating'` — replace with `'generating'` or delete the branch
- If any code wrote `'uploading'` to the DB as an intermediate state (which the audit said does NOT happen), remove that write

- [ ] **Step 4: Quality gate**

```bash
bun run typecheck && bun run lint && bun test
```

All green. Test count unchanged (this is a type-level prune with UI branch simplification — no new tests, no removed tests).

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts [other files from Step 3]
git commit -m "refactor(types): remove unreachable MeetingStatus values"
```

---

## Task 5: Translate technical errors to user-friendly messages

**Why:** Right now, a failed `fetch()` to OpenAI surfaces as "Was there a typo in the url or port?" in the meeting's `error_message` field, which the UI renders verbatim. This is user-hostile. For an OSS product where users will self-host against different provider URLs, env misconfigurations will be common — and the error surface should help them, not confuse them.

**Files:**
- Create: `lib/notes/error-messages.ts`
- Test: `lib/__tests__/error-messages.test.ts`
- Modify: The catch blocks in `app/api/generate-notes/route.ts`, `app/api/meetings/[id]/enhance/route.ts`, and `lib/notes/enhance-persist.ts` (wherever error messages are persisted to the meeting row or returned in API responses)
- Modify: `components/processing-view.tsx` and `components/meeting-note-surface.tsx` where the error message is rendered (add a retry affordance + a "see developer details" toggle)

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/error-messages.test.ts`:

```ts
import { describe, test, expect } from 'bun:test'
import { translateToUserError } from '@/lib/notes/error-messages'

describe('translateToUserError', () => {
  test('undici-style URL error becomes friendly service-unavailable', () => {
    const result = translateToUserError(
      new Error('fetch failed: Was there a typo in the url or port?'),
    )
    expect(result.userMessage).toContain('service')
    expect(result.developerMessage).toContain('typo in the url or port')
  })

  test('OpenAI quota error becomes friendly quota message', () => {
    const result = translateToUserError(
      new Error('429 You exceeded your current quota, please check your plan and billing details'),
    )
    expect(result.userMessage).toContain('quota')
  })

  test('unknown error falls back to a generic message', () => {
    const result = translateToUserError(new Error('something weird happened'))
    expect(result.userMessage).toBe('Something went wrong. Please try again.')
    expect(result.developerMessage).toBe('something weird happened')
  })

  test('handles non-Error inputs gracefully', () => {
    const result = translateToUserError('just a string' as unknown as Error)
    expect(result.userMessage).toBe('Something went wrong. Please try again.')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test lib/__tests__/error-messages.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the translator**

Create `lib/notes/error-messages.ts`:

```ts
export interface TranslatedError {
  /** Short, user-domain message suitable for UI rendering. */
  userMessage: string
  /** Original technical detail, preserved for Sentry + dev tooling. */
  developerMessage: string
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

const PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /typo in the url or port|ECONNREFUSED|fetch failed|ConnectionRefused/i,
    message: 'AI service is unavailable right now. Please try again in a moment.',
  },
  {
    test: /exceeded your current quota|insufficient_quota/i,
    message: 'Your AI provider quota is exhausted. Check your billing with OpenAI or your gateway provider.',
  },
  {
    test: /rate limit|RATE_LIMITED|429/i,
    message: 'Too many requests. Please wait a moment and try again.',
  },
  {
    test: /model_not_found|404.*model/i,
    message: 'The AI model is not available. Check your model configuration.',
  },
  {
    test: /invalid_api_key|401|incorrect api key/i,
    message: 'AI provider credentials are missing or invalid. Check OPENAI_API_KEY in your environment.',
  },
  {
    test: /context_length_exceeded|maximum context length/i,
    message: 'The meeting is too long for the selected model. Try a shorter transcript or a model with a larger context.',
  },
  {
    test: /STALE_SOURCE_HASH|source hash/i,
    message: 'The note changed while you were reviewing. Reload and try again.',
  },
]

export function translateToUserError(error: unknown): TranslatedError {
  if (!(error instanceof Error)) {
    return {
      userMessage: GENERIC_MESSAGE,
      developerMessage: typeof error === 'string' ? error : 'Unknown non-Error value',
    }
  }

  const raw = error.message
  const match = PATTERNS.find((p) => p.test.test(raw))

  return {
    userMessage: match?.message ?? GENERIC_MESSAGE,
    developerMessage: raw,
  }
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
bun test lib/__tests__/error-messages.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Apply at error write-sites**

In the catch blocks of:
- `app/api/generate-notes/route.ts` (line 104 area)
- `app/api/meetings/[id]/enhance/route.ts` (both catches)
- `lib/notes/enhance-persist.ts:persistEnhancementError`

Update the pattern:

```ts
// Before
const message = error instanceof Error ? error.message : 'Enhancement failed'
await persistEnhancementError(validated, message)

// After
import { translateToUserError } from '@/lib/notes/error-messages'

const translated = translateToUserError(error)
await persistEnhancementError(validated, translated.userMessage)
Sentry.captureException(error, {
  tags: { route: '...' },
  extra: { developerMessage: translated.developerMessage },
})
```

- [ ] **Step 6: Add a "technical details" toggle in the UI (optional but recommended)**

In `components/processing-view.tsx` where the error is rendered, add a small "Show technical details" disclosure that reveals the original `error_message` for developer users. Store the developer message alongside the user message in the DB if you want both preserved — or just rely on Sentry for the dev-side detail.

Minimal version: just the translated message in the UI, developer detail in Sentry only. That's enough for v1.

- [ ] **Step 7: Browser smoke test**

```bash
# With dev server running and an unreachable AI gateway URL (either set AI_GATEWAY_API_KEY=bogus
# temporarily or point to an invalid URL):
# - Record a test meeting, or click enhance on an existing one
# - Verify the UI shows "AI service is unavailable..." not "Was there a typo in the url or port?"
# - Revert the env change
```

- [ ] **Step 8: Quality gate**

```bash
bun run typecheck && bun run lint && bun test
```

Test count: **293 + 4 = 297** passing.

- [ ] **Step 9: Commit**

```bash
git add lib/notes/error-messages.ts lib/__tests__/error-messages.test.ts
git add app/api/generate-notes/route.ts app/api/meetings/[id]/enhance/route.ts
git add lib/notes/enhance-persist.ts
git add components/processing-view.tsx  # if touched
git commit -m "feat(notes): translate technical errors to user-friendly messages"
```

---

## Phase 1.5 completion checklist

After Task 5 commits, verify the whole phase landed clean:

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun test` passes with **297 tests** (or 294 if repair-feedback in enhance-llm required extra test changes in Task 3)
- [ ] `git log --oneline refactor/making-the-app-even-better` shows at least 5 new commits since `ec17b16` (one per task, possibly more for Task 3's sub-steps)
- [ ] No bare `ratelimit.limit(` in `app/api/` or `lib/notes/` — all go through `checkRateLimit`
- [ ] No `STREAMING_BLOCK_DELAY_MS` or `'streaming'` state in `hooks/use-draft-proposal.ts`
- [ ] No `'uploading'` in `MeetingStatus` — and `'transcribing'` gone too if Task 3 chose (b)
- [ ] Browser smoke test of the enhance flow shows instant proposal + user-friendly error on failure
- [ ] Manual test with a purposely-broken env var (e.g., wrong OPENAI_API_KEY) produces the translated "credentials missing or invalid" message, not raw Node/undici output

When all of the above are true, Phase 1.5 is done. Phase 2 can now proceed against a codebase where:

1. A third-party outage won't silently 500 the whole app
2. The note-generation flow has one conceptual LLM call path (even if two API endpoints remain)
3. The state machine matches reality
4. Errors speak user-domain, not undici-domain

---

## Rollback plan

Each task is a single commit (or a small chain in Task 3). Revert with `git revert <sha>` per task. Task 3 Option (b) deletes a DB table — if rolled back, the `processing_jobs` table stays dropped in the dev database; you'd need to re-run `scripts/004` or whichever migration originally created it. If this is a concern, stash a schema dump of `processing_jobs` before running migration 009.

Tasks 1, 2, 4, 5 are all in-code-only and trivially reversible.

---

## Out of scope (tracked for later)

- **Chat route consolidation** — explicit product deferral to Phase 2
- **`enhance-persist.ts` returns `NextResponse` from lib/** — tracked for Phase 3 when error boundaries get the audit
- **`lib/meetings/meeting-pipeline.ts` `'use client'` pragma** — pre-existing, tracked for Phase 2 cleanup
- **`assistant-shell-layout.ts` at lib/ root** — tracked for Phase 2 deletion if confirmed unused
- **628-LOC `meeting-note-surface.tsx` split** — Phase 3 visual redesign
- **Startup env validation** — Phase 4 OSS prep (`docs/self-host.md`, env check script)
- **Inconsistent error response shapes across routes** — Phase 3 (API surface polish)
