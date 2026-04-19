# Templates Revival Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revive user-selectable note templates (5 built-ins + user-created custom) so the AI generates notes shaped to the meeting type.

**Architecture:** Built-ins live in code (`lib/note-template.ts`), custom templates live in the DB (`note_templates` table), user default lives in a new `user_preferences` table. The existing enhance route gains a `template_id` body field. New `/dashboard/templates` page + picker dropdown on "Create notes".

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + RLS), Vercel AI SDK, Tiptap 3, Tailwind CSS v4, shadcn/ui, Zod, Bun test runner.

**Spec:** [docs/superpowers/specs/2026-04-19-templates-revival-design.md](../specs/2026-04-19-templates-revival-design.md)

---

## File structure

**Created:**

| Path | Responsibility |
|---|---|
| `scripts/011_revive_note_templates.sql` | DB migration — `note_templates` + `user_preferences` tables with RLS |
| `lib/templates/template-schemas.ts` | Zod request schemas for template CRUD + default-set |
| `app/api/templates/route.ts` | `GET` list + `POST` create custom |
| `app/api/templates/[id]/route.ts` | `PATCH` update + `DELETE` remove custom |
| `app/api/user-preferences/route.ts` | `PATCH` set default template |
| `app/dashboard/templates/page.tsx` | Templates list page (server component shell) |
| `app/dashboard/templates/new/page.tsx` | Create-template editor page |
| `app/dashboard/templates/[id]/page.tsx` | Edit-template editor page |
| `components/templates/templates-list.tsx` | Client component rendering both sections (built-in + custom) |
| `components/templates/template-editor-form.tsx` | Shared create/edit form |
| `components/templates/template-picker.tsx` | Dropdown used at "Create notes" |
| `hooks/use-templates.ts` | Data + mutations, single source of truth for list and picker |
| `lib/__tests__/note-template.test.ts` | Unit tests for `resolveTemplate()` |
| `lib/__tests__/template-schemas.test.ts` | Unit tests for Zod schemas |
| `app/api/templates/route.test.ts` | Route tests for GET/POST |
| `app/api/templates/[id]/route.test.ts` | Route tests for PATCH/DELETE |
| `app/api/user-preferences/route.test.ts` | Route tests for PATCH |
| `hooks/__tests__/use-templates.test.tsx` | Hook tests |
| `components/templates/templates-list.test.tsx` | Component tests |
| `components/templates/template-editor-form.test.tsx` | Form validation tests |
| `components/templates/template-picker.test.tsx` | Picker interaction tests |

**Modified:**

| Path | Why |
|---|---|
| `lib/note-template.ts` | Expand `DEFAULT_NOTE_TEMPLATE` → `BUILTIN_TEMPLATES` map, add `resolveTemplate()`, full built-in prompts |
| `lib/notes/enhance-validation.ts` | Add optional `template_id` to request schema |
| `app/api/meetings/[id]/enhance/route.ts` | Resolve template from body/prefs/fallback and pass into prompt |
| `app/api/meetings/[id]/enhance/route.test.ts` | Assert new resolution behavior |
| `components/app-sidebar.tsx` | Add `Templates` nav item; apply sage-accent active styling to both nav items |
| Meeting surface component that renders "Create notes" CTA (likely `components/meeting-note-surface.tsx` or `components/draft-action-bar.tsx`) | Wire in `TemplatePicker` |

---

## Task 1: Database migration

**Files:**
- Create: `scripts/011_revive_note_templates.sql`

- [ ] **Step 1: Write the migration**

Create `scripts/011_revive_note_templates.sql`:

```sql
-- Migration 011: revive note templates (custom per-user) and user preferences.
-- Built-in templates live in code (lib/note-template.ts) and are not stored here.

create table if not exists public.note_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 200),
  prompt      text not null check (char_length(prompt) between 20 and 10000),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.note_templates enable row level security;

create policy "Users can select own templates"
  on public.note_templates for select
  using (auth.uid() = user_id);

create policy "Users can insert own templates"
  on public.note_templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own templates"
  on public.note_templates for update
  using (auth.uid() = user_id);

create policy "Users can delete own templates"
  on public.note_templates for delete
  using (auth.uid() = user_id);

create index if not exists note_templates_user_id_idx
  on public.note_templates (user_id);

-- user_preferences holds the user's default template id (built-in string or custom UUID).
-- Kept as `text` deliberately so it can reference either source.
create table if not exists public.user_preferences (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  default_template_id  text not null default 'builtin-general',
  updated_at           timestamptz default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can select own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply migration to local Supabase**

Run the SQL against the Supabase SQL editor for the local/dev project. Verify with:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('note_templates','user_preferences');

select policyname, tablename
from pg_policies
where schemaname = 'public' and tablename in ('note_templates','user_preferences')
order by tablename, policyname;
```

Expected: both tables listed with `rowsecurity = true`; 4 policies on `note_templates`, 3 on `user_preferences`.

- [ ] **Step 3: Commit**

```bash
git add scripts/011_revive_note_templates.sql
git commit -m "feat(db): add note_templates and user_preferences tables (migration 011)"
```

---

## Task 2: BUILTIN_TEMPLATES map + resolveTemplate()

**Files:**
- Modify: `lib/note-template.ts`
- Create: `lib/__tests__/note-template.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/__tests__/note-template.test.ts`:

```ts
import { describe, test, expect, mock } from 'bun:test'
import {
  BUILTIN_TEMPLATES,
  FALLBACK_TEMPLATE_ID,
  resolveTemplate,
} from '@/lib/note-template'

function makeSupabaseMock(row: { id: string; name: string; description: string | null; prompt: string } | null) {
  const maybeSingle = mock(async () => ({ data: row }))
  const eqUser = mock(() => ({ maybeSingle }))
  const eqId = mock(() => ({ eq: eqUser }))
  const select = mock(() => ({ eq: eqId }))
  const from = mock(() => ({ select }))
  return { from } as unknown as Parameters<typeof resolveTemplate>[2]
}

describe('BUILTIN_TEMPLATES', () => {
  test('has all five expected built-in ids', () => {
    expect(Object.keys(BUILTIN_TEMPLATES).sort()).toEqual([
      'builtin-1on1',
      'builtin-general',
      'builtin-interview',
      'builtin-lecture',
      'builtin-team',
    ])
  })

  test('every built-in is marked isBuiltin and has non-empty prompt', () => {
    for (const tpl of Object.values(BUILTIN_TEMPLATES)) {
      expect(tpl.isBuiltin).toBe(true)
      expect(tpl.prompt.trim().length).toBeGreaterThan(40)
      expect(tpl.name.length).toBeGreaterThan(0)
    }
  })

  test('FALLBACK_TEMPLATE_ID points to an existing built-in', () => {
    expect(BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]).toBeDefined()
  })
})

describe('resolveTemplate', () => {
  test('returns built-in directly when id starts with "builtin-"', async () => {
    const supabase = makeSupabaseMock(null)
    const result = await resolveTemplate('builtin-1on1', 'user-1', supabase)
    expect(result.id).toBe('builtin-1on1')
    expect(result.isBuiltin).toBe(true)
  })

  test('falls back to general for unknown builtin id', async () => {
    const supabase = makeSupabaseMock(null)
    const result = await resolveTemplate('builtin-nonsense', 'user-1', supabase)
    expect(result.id).toBe(FALLBACK_TEMPLATE_ID)
  })

  test('fetches custom template from DB when id is a UUID', async () => {
    const supabase = makeSupabaseMock({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Custom One',
      description: 'desc',
      prompt: 'custom prompt body that is long enough to pass validation',
    })
    const result = await resolveTemplate('11111111-1111-1111-1111-111111111111', 'user-1', supabase)
    expect(result.id).toBe('11111111-1111-1111-1111-111111111111')
    expect(result.name).toBe('Custom One')
    expect(result.isBuiltin).toBe(false)
  })

  test('falls back to general when custom UUID is not found', async () => {
    const supabase = makeSupabaseMock(null)
    const result = await resolveTemplate('11111111-1111-1111-1111-111111111111', 'user-1', supabase)
    expect(result.id).toBe(FALLBACK_TEMPLATE_ID)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test lib/__tests__/note-template.test.ts
```

Expected: fails with `BUILTIN_TEMPLATES` / `resolveTemplate` / `FALLBACK_TEMPLATE_ID` not exported.

- [ ] **Step 3: Implement**

Replace the content of `lib/note-template.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ResolvedNoteTemplate {
  id: string
  name: string
  description: string
  prompt: string
  isBuiltin: boolean
}

export const BUILTIN_TEMPLATES: Record<string, ResolvedNoteTemplate> = {
  'builtin-general': {
    id: 'builtin-general',
    name: 'General',
    description: 'Balanced notes for any meeting type',
    isBuiltin: true,
    prompt: `Produce balanced notes suitable for any meeting type. Distribute content evenly across all fields — no single section should dominate. Keep tone neutral and professional. Capture what was discussed, what was decided, what actions were committed, and what topics were covered without bias toward any particular meeting style. When the content genuinely doesn't fit a field (for example, no decisions were actually made), leave that field empty rather than forcing content to appear there.`,
  },
  'builtin-1on1': {
    id: 'builtin-1on1',
    name: '1:1 / Check-in',
    description: 'Warm two-person conversations — growth, feedback, blockers',
    isBuiltin: true,
    prompt: `This is a two-person check-in — a 1:1, a manager/report conversation, a founder/mentor session. Preserve the human dynamic: who raised which topic, who responded how. Emphasize growth and development topics, feedback exchanged (in both directions), blockers the person is facing, and mutual commitments. Tone should be warm, personal, and direct. Avoid corporate-speak — use the language the speakers actually used.

For action_items: each item should clearly identify which of the two people owns it. If only one person is talking more than 80% of the time, flag the conversation as asymmetric in the summary. Put any significant emotional or interpersonal observations into detailed_notes as their own section when they matter to the meaning of the conversation.`,
  },
  'builtin-team': {
    id: 'builtin-team',
    name: 'Team meeting',
    description: 'Sprint planning, standups, retros — tactical, info-dense',
    isBuiltin: true,
    prompt: `This is a team meeting — sprint planning, standup, retro, or cross-functional sync. Prioritize tactical, info-dense output over narrative. In detailed_notes, organize content by topic in agenda order reconstructed from the transcript flow. Within each topic, use structured bullets: decisions with rationale, actions with owners and due dates, blockers in their own bullet group, open questions to revisit.

For action_items: every item must have an explicit owner (name or role) and, where stated in the transcript, a due date. If no due date is mentioned, set due_date to null — do not invent deadlines.

For key_decisions: include the alternatives considered when the transcript provides them (e.g. "chose X over Y because…").

Parked topics or deferred items go into follow_ups, not action_items. Do not invent urgency.`,
  },
  'builtin-interview': {
    id: 'builtin-interview',
    name: 'Customer interview',
    description: 'Research calls — verbatim quotes, pain points, feature requests',
    isBuiltin: true,
    prompt: `This is a customer or user research interview. Your job is observational, not interpretive — report what the customer actually said, do not translate it into internal frameworks or product language.

In detailed_notes, organize by theme. When the customer says something quotable about a pain, a goal, a feature wish, or an emotional reaction, include it verbatim as a markdown blockquote:
> "Their exact words."

Emphasize pain points and feature requests in the customer's own language. Preserve sentiment — if the customer sounded frustrated, say "was frustrated by X"; if excited, say "got excited about Y".

For action_items: capture internal follow-ups WE owe them (e.g., "send pricing", "schedule demo").
For follow_ups: capture things to explore in the next conversation.
For key_decisions: usually empty — a research call rarely produces decisions. Leave it empty rather than forcing content.`,
  },
  'builtin-lecture': {
    id: 'builtin-lecture',
    name: 'Lecture / Talk',
    description: 'Educational content — thesis, concepts, examples, references',
    isBuiltin: true,
    prompt: `This is a lecture, talk, or educational content — a single speaker explaining concepts to an audience. Structure detailed_notes in the order the speaker built their argument:

1. Main thesis — the speaker's central claim, stated plainly
2. Key concepts — each one explained in the speaker's own framing
3. Examples — the illustrations the speaker used to ground each concept
4. Questions raised — any Q&A or audience challenges, with context
5. References — papers, books, people, or resources mentioned

For topics: reconstruct the speaker's actual outline in order — not a theme list, a reconstructed agenda.

For action_items: capture learning-related follow-ups only (e.g., "read paper X", "look up term Y"), not business actions.

For key_decisions: usually empty. Do not force it.

Tone: structured, faithful to the speaker's argument, preserves intellectual nuance over brevity.`,
  },
}

export const FALLBACK_TEMPLATE_ID = 'builtin-general'

/**
 * Backwards-compatible alias. Existing callers that imported DEFAULT_NOTE_TEMPLATE
 * continue to work.
 */
export const DEFAULT_NOTE_TEMPLATE: ResolvedNoteTemplate = BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]

/**
 * Resolve a template by ID. Built-in IDs (prefixed `builtin-`) are returned
 * directly from the in-memory map. Custom IDs are fetched from the DB under the
 * user's RLS. Any failure (missing built-in, not-found custom, empty string)
 * falls back to the general built-in.
 */
export async function resolveTemplate(
  id: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<ResolvedNoteTemplate> {
  if (!id) return BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]

  if (id.startsWith('builtin-')) {
    return BUILTIN_TEMPLATES[id] ?? BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]
  }

  const { data } = await supabase
    .from('note_templates')
    .select('id, name, description, prompt')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]

  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    prompt: data.prompt,
    isBuiltin: false,
  }
}

/**
 * Pre-existing helper — kept as-is. Consumers pass a ResolvedNoteTemplate and
 * get a block of "Format instructions" text to append to the base prompt.
 */
export function formatTemplateContext(template: ResolvedNoteTemplate) {
  return [
    `Selected note format: ${template.name}`,
    template.description ? `Description: ${template.description}` : null,
    'Format instructions:',
    template.prompt,
  ]
    .filter(Boolean)
    .join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test lib/__tests__/note-template.test.ts
bun run typecheck
```

Expected: 7 tests pass, no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/note-template.ts lib/__tests__/note-template.test.ts
git commit -m "feat(templates): add BUILTIN_TEMPLATES map and resolveTemplate()"
```

---

## Task 3: Zod request schemas

**Files:**
- Create: `lib/templates/template-schemas.ts`
- Create: `lib/__tests__/template-schemas.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/__tests__/template-schemas.test.ts`:

```ts
import { describe, test, expect } from 'bun:test'
import {
  createTemplateSchema,
  updateTemplateSchema,
  setDefaultSchema,
} from '@/lib/templates/template-schemas'

describe('createTemplateSchema', () => {
  test('accepts valid input', () => {
    const result = createTemplateSchema.safeParse({
      name: 'Sales discovery',
      description: 'Discovery calls with qualified leads',
      prompt: 'Emphasize pain points and explicit budget mentions.',
    })
    expect(result.success).toBe(true)
  })

  test('rejects empty name', () => {
    const result = createTemplateSchema.safeParse({
      name: '',
      prompt: 'Long enough prompt body here for validation to pass.',
    })
    expect(result.success).toBe(false)
  })

  test('rejects name longer than 60 chars', () => {
    const result = createTemplateSchema.safeParse({
      name: 'x'.repeat(61),
      prompt: 'Long enough prompt body here for validation to pass.',
    })
    expect(result.success).toBe(false)
  })

  test('rejects prompt shorter than 20 chars', () => {
    const result = createTemplateSchema.safeParse({
      name: 'Valid',
      prompt: 'Too short.',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateTemplateSchema', () => {
  test('allows partial updates', () => {
    expect(updateTemplateSchema.safeParse({ name: 'Only name' }).success).toBe(true)
    expect(updateTemplateSchema.safeParse({}).success).toBe(true)
  })

  test('still rejects invalid field values', () => {
    expect(updateTemplateSchema.safeParse({ name: '' }).success).toBe(false)
    expect(updateTemplateSchema.safeParse({ prompt: 'x' }).success).toBe(false)
  })
})

describe('setDefaultSchema', () => {
  test('accepts a non-empty string', () => {
    expect(setDefaultSchema.safeParse({ default_template_id: 'builtin-general' }).success).toBe(true)
  })

  test('rejects empty string', () => {
    expect(setDefaultSchema.safeParse({ default_template_id: '' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test lib/__tests__/template-schemas.test.ts
```

Expected: fails with "Cannot find module".

- [ ] **Step 3: Implement**

Create `lib/templates/template-schemas.ts`:

```ts
import { z } from 'zod'

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional(),
  prompt: z.string().trim().min(20).max(10_000),
})

export const updateTemplateSchema = createTemplateSchema.partial()

export const setDefaultSchema = z.object({
  default_template_id: z.string().trim().min(1),
})

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test lib/__tests__/template-schemas.test.ts
bun run typecheck
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/templates/template-schemas.ts lib/__tests__/template-schemas.test.ts
git commit -m "feat(templates): add Zod schemas for template CRUD"
```

---

## Task 4: GET /api/templates

**Files:**
- Create: `app/api/templates/route.ts`
- Create: `app/api/templates/route.test.ts`

- [ ] **Step 1: Write failing test for GET**

Create `app/api/templates/route.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

const createClientMock = mock(() => ({}))

mock.module('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

let GET: typeof import('./route').GET
let POST: typeof import('./route').POST

beforeAll(async () => {
  const mod = await import('./route')
  GET = mod.GET
  POST = mod.POST
})

function mockSupabase(user: { id: string } | null, templatesRows: Array<{ id: string; name: string; description: string | null; prompt: string }> = [], prefRow: { default_template_id: string } | null = null) {
  const orderMock = mock(async () => ({ data: templatesRows }))
  const eqTemplatesUser = mock(() => ({ order: orderMock }))
  const selectTemplates = mock(() => ({ eq: eqTemplatesUser }))

  const maybeSinglePref = mock(async () => ({ data: prefRow }))
  const eqPrefUser = mock(() => ({ maybeSingle: maybeSinglePref }))
  const selectPref = mock(() => ({ eq: eqPrefUser }))

  const from = mock((table: string) => {
    if (table === 'note_templates') return { select: selectTemplates }
    if (table === 'user_preferences') return { select: selectPref }
    throw new Error(`Unexpected table ${table}`)
  })

  const supabase = {
    auth: { getUser: mock(async () => ({ data: { user } })) },
    from,
  }
  ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
    .mockResolvedValue(supabase as never)
  return { from }
}

describe('GET /api/templates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockSupabase(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns merged list with default from user_preferences', async () => {
    mockSupabase(
      { id: 'user-1' },
      [{ id: 'uuid-1', name: 'Custom A', description: null, prompt: 'p'.repeat(25) }],
      { default_template_id: 'builtin-1on1' },
    )
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.defaultTemplateId).toBe('builtin-1on1')
    // 5 built-ins + 1 custom
    expect(body.templates.length).toBe(6)
    expect(body.templates.some((t: { id: string }) => t.id === 'uuid-1')).toBe(true)
  })

  it('falls back to builtin-general when user_preferences row missing', async () => {
    mockSupabase({ id: 'user-1' }, [], null)
    const res = await GET()
    const body = await res.json()
    expect(body.defaultTemplateId).toBe('builtin-general')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test app/api/templates/route.test.ts
```

Expected: fails, route module doesn't exist.

- [ ] **Step 3: Implement the route (GET only for now)**

Create `app/api/templates/route.ts`:

```ts
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { BUILTIN_TEMPLATES, FALLBACK_TEMPLATE_ID, type ResolvedNoteTemplate } from '@/lib/note-template'
import { createTemplateSchema } from '@/lib/templates/template-schemas'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const [{ data: customRows }, { data: prefRow }] = await Promise.all([
      supabase
        .from('note_templates')
        .select('id, name, description, prompt')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('user_preferences')
        .select('default_template_id')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const custom: ResolvedNoteTemplate[] = (customRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      prompt: row.prompt,
      isBuiltin: false,
    }))

    const templates: ResolvedNoteTemplate[] = [
      ...Object.values(BUILTIN_TEMPLATES),
      ...custom,
    ]

    return NextResponse.json({
      templates,
      defaultTemplateId: prefRow?.default_template_id ?? FALLBACK_TEMPLATE_ID,
    })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'templates.GET' } })
    return errorResponse('Failed to load templates', 'TEMPLATES_LIST_FAILED', 500)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const validated = await validateBody(request, createTemplateSchema)
    if (validated instanceof Response) return validated
    const { data: body } = validated

    const { data, error } = await supabase
      .from('note_templates')
      .insert({
        user_id: user.id,
        name: body.name,
        description: body.description ?? null,
        prompt: body.prompt,
      })
      .select('id, name, description, prompt')
      .single()

    if (error || !data) {
      Sentry.captureException(error ?? new Error('template insert returned no data'), {
        tags: { route: 'templates.POST' },
      })
      return errorResponse('Failed to create template', 'TEMPLATE_CREATE_FAILED', 500)
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      description: data.description ?? '',
      prompt: data.prompt,
      isBuiltin: false,
    })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'templates.POST' } })
    return errorResponse('Failed to create template', 'TEMPLATE_CREATE_FAILED', 500)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test app/api/templates/route.test.ts
bun run typecheck
```

Expected: 3 tests pass.

- [ ] **Step 5: Add POST tests**

Append to `app/api/templates/route.test.ts`:

```ts
describe('POST /api/templates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function mockInsertSuccess(user: { id: string }, row: { id: string; name: string; description: string | null; prompt: string }) {
    const singleMock = mock(async () => ({ data: row, error: null }))
    const selectMock = mock(() => ({ single: singleMock }))
    const insertMock = mock(() => ({ select: selectMock }))
    const from = mock((table: string) => {
      if (table === 'note_templates') return { insert: insertMock }
      throw new Error(`Unexpected table ${table}`)
    })
    const supabase = {
      auth: { getUser: mock(async () => ({ data: { user } })) },
      from,
    }
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue(supabase as never)
    return { insertMock }
  }

  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when unauthenticated', async () => {
    mockSupabase(null)
    const res = await POST(makeRequest({ name: 'x', prompt: 'long enough prompt body here.' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is invalid', async () => {
    mockSupabase({ id: 'user-1' })
    const res = await POST(makeRequest({ name: '', prompt: 'short' }))
    expect(res.status).toBe(400)
  })

  it('creates a custom template and returns it', async () => {
    mockInsertSuccess(
      { id: 'user-1' },
      { id: 'uuid-new', name: 'Custom A', description: null, prompt: 'p'.repeat(25) },
    )
    const res = await POST(makeRequest({
      name: 'Custom A',
      prompt: 'p'.repeat(25),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('uuid-new')
    expect(body.isBuiltin).toBe(false)
  })
})
```

- [ ] **Step 6: Run all tests for this file**

```bash
bun test app/api/templates/route.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/api/templates/route.ts app/api/templates/route.test.ts
git commit -m "feat(api): GET and POST /api/templates"
```

---

## Task 5: PATCH / DELETE /api/templates/[id]

**Files:**
- Create: `app/api/templates/[id]/route.ts`
- Create: `app/api/templates/[id]/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/api/templates/[id]/route.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

const createClientMock = mock(() => ({}))

mock.module('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

let PATCH: typeof import('./route').PATCH
let DELETE: typeof import('./route').DELETE

beforeAll(async () => {
  const mod = await import('./route')
  PATCH = mod.PATCH
  DELETE = mod.DELETE
})

function baseSupabase(user: { id: string } | null) {
  const auth = { getUser: mock(async () => ({ data: { user } })) }
  return { auth }
}

function makePatchRequest(body: unknown) {
  return new Request('http://localhost/api/templates/uuid-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PATCH /api/templates/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase(null), from: mock(() => { throw new Error('unused') }) } as never)
    const res = await PATCH(makePatchRequest({ name: 'new' }), ctx('uuid-1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when id starts with builtin-', async () => {
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase({ id: 'user-1' }), from: mock(() => { throw new Error('unused') }) } as never)
    const res = await PATCH(makePatchRequest({ name: 'new' }), ctx('builtin-general'))
    expect(res.status).toBe(403)
  })

  it('updates custom template and returns it', async () => {
    const singleMock = mock(async () => ({
      data: { id: 'uuid-1', name: 'Updated', description: null, prompt: 'p'.repeat(25) },
      error: null,
    }))
    const selectMock = mock(() => ({ single: singleMock }))
    const eqUserMock = mock(() => ({ select: selectMock }))
    const eqIdMock = mock(() => ({ eq: eqUserMock }))
    const updateMock = mock(() => ({ eq: eqIdMock }))
    const from = mock((table: string) => {
      if (table === 'note_templates') return { update: updateMock }
      throw new Error(`Unexpected table ${table}`)
    })
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase({ id: 'user-1' }), from } as never)

    const res = await PATCH(makePatchRequest({ name: 'Updated' }), ctx('uuid-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Updated')
    expect(body.isBuiltin).toBe(false)
  })

  it('returns 404 when template not found or not owned', async () => {
    const singleMock = mock(async () => ({ data: null, error: null }))
    const selectMock = mock(() => ({ single: singleMock }))
    const eqUserMock = mock(() => ({ select: selectMock }))
    const eqIdMock = mock(() => ({ eq: eqUserMock }))
    const updateMock = mock(() => ({ eq: eqIdMock }))
    const from = mock(() => ({ update: updateMock }))
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase({ id: 'user-1' }), from } as never)

    const res = await PATCH(makePatchRequest({ name: 'New' }), ctx('uuid-404'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/templates/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 403 for builtin ids', async () => {
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase({ id: 'user-1' }), from: mock(() => { throw new Error('unused') }) } as never)
    const res = await DELETE(new Request('http://localhost/api/templates/builtin-1on1', { method: 'DELETE' }), ctx('builtin-1on1'))
    expect(res.status).toBe(403)
  })

  it('deletes custom template and resets default if it was the default', async () => {
    // maybeSingle to read current default
    const maybeSingleDefault = mock(async () => ({ data: { default_template_id: 'uuid-1' } }))
    const eqUserDefault = mock(() => ({ maybeSingle: maybeSingleDefault }))
    const selectDefault = mock(() => ({ eq: eqUserDefault }))

    // DELETE on note_templates
    const deleteEqUser = mock(async () => ({ error: null }))
    const deleteEqId = mock(() => ({ eq: deleteEqUser }))
    const deleteFromTemplates = mock(() => ({ eq: deleteEqId }))

    // UPDATE on user_preferences
    const prefsUpdateEqUser = mock(async () => ({ error: null }))
    const prefsUpdateFn = mock(() => ({ eq: prefsUpdateEqUser }))

    const from = mock((table: string) => {
      if (table === 'user_preferences') return { select: selectDefault, update: prefsUpdateFn }
      if (table === 'note_templates') return { delete: deleteFromTemplates }
      throw new Error(`Unexpected table ${table}`)
    })
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase({ id: 'user-1' }), from } as never)

    const res = await DELETE(new Request('http://localhost/api/templates/uuid-1', { method: 'DELETE' }), ctx('uuid-1'))
    expect(res.status).toBe(200)
    expect(prefsUpdateFn).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test app/api/templates/[id]/route.test.ts
```

Expected: fails, route doesn't exist.

- [ ] **Step 3: Implement**

Create `app/api/templates/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { FALLBACK_TEMPLATE_ID } from '@/lib/note-template'
import { updateTemplateSchema } from '@/lib/templates/template-schemas'

function isBuiltin(id: string) {
  return id.startsWith('builtin-')
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    if (isBuiltin(id)) return errorResponse('Built-in templates are read-only', 'TEMPLATE_IS_BUILTIN', 403)

    const validated = await validateBody(request, updateTemplateSchema)
    if (validated instanceof Response) return validated
    const { data: body } = validated

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) update.name = body.name
    if (body.description !== undefined) update.description = body.description ?? null
    if (body.prompt !== undefined) update.prompt = body.prompt

    const { data, error } = await supabase
      .from('note_templates')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, name, description, prompt')
      .single()

    if (error || !data) {
      return errorResponse('Template not found', 'TEMPLATE_NOT_FOUND', 404)
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      description: data.description ?? '',
      prompt: data.prompt,
      isBuiltin: false,
    })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'templates.PATCH' } })
    return errorResponse('Failed to update template', 'TEMPLATE_UPDATE_FAILED', 500)
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    if (isBuiltin(id)) return errorResponse('Built-in templates cannot be deleted', 'TEMPLATE_IS_BUILTIN', 403)

    // If the template being deleted is the user's current default, reset the default first.
    const { data: prefRow } = await supabase
      .from('user_preferences')
      .select('default_template_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (prefRow?.default_template_id === id) {
      await supabase
        .from('user_preferences')
        .update({ default_template_id: FALLBACK_TEMPLATE_ID, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    }

    const { error } = await supabase
      .from('note_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      Sentry.captureException(error, { tags: { route: 'templates.DELETE' } })
      return errorResponse('Failed to delete template', 'TEMPLATE_DELETE_FAILED', 500)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'templates.DELETE' } })
    return errorResponse('Failed to delete template', 'TEMPLATE_DELETE_FAILED', 500)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test app/api/templates/[id]/route.test.ts
bun run typecheck
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/api/templates/[id]/route.ts" "app/api/templates/[id]/route.test.ts"
git commit -m "feat(api): PATCH and DELETE /api/templates/[id]"
```

---

## Task 6: PATCH /api/user-preferences

**Files:**
- Create: `app/api/user-preferences/route.ts`
- Create: `app/api/user-preferences/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/api/user-preferences/route.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

const createClientMock = mock(() => ({}))

mock.module('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

let PATCH: typeof import('./route').PATCH

beforeAll(async () => {
  const mod = await import('./route')
  PATCH = mod.PATCH
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/user-preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(opts: {
  user: { id: string } | null
  customOwned?: boolean
}) {
  const customTemplateRow = opts.customOwned ? { id: 'uuid-custom' } : null
  const maybeSingleCustom = mock(async () => ({ data: customTemplateRow }))
  const eqUserTemplates = mock(() => ({ maybeSingle: maybeSingleCustom }))
  const eqIdTemplates = mock(() => ({ eq: eqUserTemplates }))
  const selectTemplates = mock(() => ({ eq: eqIdTemplates }))

  const upsertMock = mock(async () => ({ error: null }))

  const from = mock((table: string) => {
    if (table === 'note_templates') return { select: selectTemplates }
    if (table === 'user_preferences') return { upsert: upsertMock }
    throw new Error(`Unexpected table ${table}`)
  })

  const supabase = {
    auth: { getUser: mock(async () => ({ data: { user: opts.user } })) },
    from,
  }
  ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
    .mockResolvedValue(supabase as never)
  return { upsertMock }
}

describe('PATCH /api/user-preferences', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockSupabase({ user: null })
    const res = await PATCH(makeRequest({ default_template_id: 'builtin-general' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is invalid', async () => {
    mockSupabase({ user: { id: 'user-1' } })
    const res = await PATCH(makeRequest({ default_template_id: '' }))
    expect(res.status).toBe(400)
  })

  it('accepts a valid builtin id', async () => {
    const { upsertMock } = mockSupabase({ user: { id: 'user-1' } })
    const res = await PATCH(makeRequest({ default_template_id: 'builtin-1on1' }))
    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalled()
  })

  it('rejects an unknown builtin id', async () => {
    mockSupabase({ user: { id: 'user-1' } })
    const res = await PATCH(makeRequest({ default_template_id: 'builtin-nonsense' }))
    expect(res.status).toBe(400)
  })

  it('accepts a UUID the user owns', async () => {
    const { upsertMock } = mockSupabase({ user: { id: 'user-1' }, customOwned: true })
    const res = await PATCH(makeRequest({ default_template_id: '11111111-1111-1111-1111-111111111111' }))
    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalled()
  })

  it('rejects a UUID the user does not own', async () => {
    mockSupabase({ user: { id: 'user-1' }, customOwned: false })
    const res = await PATCH(makeRequest({ default_template_id: '22222222-2222-2222-2222-222222222222' }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test app/api/user-preferences/route.test.ts
```

Expected: fails, route missing.

- [ ] **Step 3: Implement**

Create `app/api/user-preferences/route.ts`:

```ts
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { BUILTIN_TEMPLATES } from '@/lib/note-template'
import { setDefaultSchema } from '@/lib/templates/template-schemas'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const validated = await validateBody(request, setDefaultSchema)
    if (validated instanceof Response) return validated
    const { default_template_id: id } = validated.data

    // Validate the id references something real
    if (id.startsWith('builtin-')) {
      if (!BUILTIN_TEMPLATES[id]) {
        return errorResponse('Unknown built-in template', 'INVALID_DEFAULT_TEMPLATE', 400)
      }
    } else if (UUID_REGEX.test(id)) {
      const { data } = await supabase
        .from('note_templates')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!data) {
        return errorResponse('Template not found or not owned by user', 'INVALID_DEFAULT_TEMPLATE', 400)
      }
    } else {
      return errorResponse('Invalid default template id', 'INVALID_DEFAULT_TEMPLATE', 400)
    }

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        default_template_id: id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      Sentry.captureException(error, { tags: { route: 'user-preferences.PATCH' } })
      return errorResponse('Failed to update preferences', 'PREFERENCES_UPDATE_FAILED', 500)
    }

    return NextResponse.json({ default_template_id: id })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'user-preferences.PATCH' } })
    return errorResponse('Failed to update preferences', 'PREFERENCES_UPDATE_FAILED', 500)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test app/api/user-preferences/route.test.ts
bun run typecheck
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/user-preferences/route.ts app/api/user-preferences/route.test.ts
git commit -m "feat(api): PATCH /api/user-preferences for setting default template"
```

---

## Task 7: Wire template resolution into the enhance route

**Files:**
- Modify: `lib/notes/enhance-validation.ts`
- Modify: `app/api/meetings/[id]/enhance/route.ts`
- Modify: `app/api/meetings/[id]/enhance/route.test.ts`

- [ ] **Step 1: Find the existing validation schema**

```bash
grep -n "z.object" lib/notes/enhance-validation.ts | head -5
```

Identify the generate/enhance request schema (the one currently accepting `action`, `mode`, `documentContent`). The `template_id` field goes on the same schema as an optional string.

- [ ] **Step 2: Add template_id to the request schema**

In `lib/notes/enhance-validation.ts`, add `template_id: z.string().trim().min(1).optional()` to the schema used for the `generate` action (the one that calls `runEnhanceLlm`).

- [ ] **Step 3: Use template_id in the route**

Inside the `generate`/`enhance` branch of `app/api/meetings/[id]/enhance/route.ts` (where `buildDraftProposalPrompt` ultimately runs), replace the current template-loading logic with:

```ts
// Import at top of file
import { resolveTemplate, FALLBACK_TEMPLATE_ID } from '@/lib/note-template'

// Inside the handler, before the call that needs `template`:
const { data: prefRow } = await supabase
  .from('user_preferences')
  .select('default_template_id')
  .eq('user_id', user.id)
  .maybeSingle()

const templateId = parsedBody.template_id
  ?? prefRow?.default_template_id
  ?? FALLBACK_TEMPLATE_ID

const template = await resolveTemplate(templateId, user.id, supabase)
```

Pass `template` into `runEnhanceLlm()` / `buildDraftProposalPrompt()` as it already accepts.

Remove any hardcoded `DEFAULT_NOTE_TEMPLATE` references in the enhance route — they're replaced by the resolved template.

- [ ] **Step 4: Add a test that confirms user preference wins when no body template_id**

In `app/api/meetings/[id]/enhance/route.test.ts`, extend `mockSupabase` to also return a `user_preferences` row. Add a test:

```ts
it('uses user preference default template when template_id is not in body', async () => {
  mockSupabase({
    user: { id: 'user-1' },
    meetingData: makeMeeting(),
    userPreferences: { default_template_id: 'builtin-team' },
  })

  const res = await POST(
    makeRequest({
      action: 'generate',
      mode: 'enhance',
      documentContent: makeDocument('Typed note from the user'),
    }),
    { params: Promise.resolve({ id: 'meeting-1' }) }
  )

  expect(res.status).toBe(200)
  const generateCall = (mockGenerateObject as any).mock.calls[0][0]
  expect(generateCall.prompt).toContain('Selected note format: Team meeting')
})

it('honors body template_id over user preference', async () => {
  mockSupabase({
    user: { id: 'user-1' },
    meetingData: makeMeeting(),
    userPreferences: { default_template_id: 'builtin-team' },
  })

  const res = await POST(
    makeRequest({
      action: 'generate',
      mode: 'enhance',
      documentContent: makeDocument('Typed note from the user'),
      template_id: 'builtin-interview',
    }),
    { params: Promise.resolve({ id: 'meeting-1' }) }
  )

  expect(res.status).toBe(200)
  const generateCall = (mockGenerateObject as any).mock.calls[0][0]
  expect(generateCall.prompt).toContain('Selected note format: Customer interview')
})
```

You will likely need to extend `mockSupabase` to mock the `user_preferences` table. Follow the pattern established in Task 4's test file for handling multiple tables in one `from()` mock.

- [ ] **Step 5: Run tests**

```bash
bun test app/api/meetings/[id]/enhance/route.test.ts
bun run typecheck
```

Expected: all existing tests still pass + 2 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/notes/enhance-validation.ts "app/api/meetings/[id]/enhance/route.ts" "app/api/meetings/[id]/enhance/route.test.ts"
git commit -m "feat(enhance): resolve note template from body/prefs/fallback"
```

---

## Task 8: Client hook — use-templates

**Files:**
- Create: `hooks/use-templates.ts`
- Create: `hooks/__tests__/use-templates.test.tsx`

- [ ] **Step 1: Write failing test**

Create `hooks/__tests__/use-templates.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTemplates } from '@/hooks/use-templates'

const fetchMock = mock()

beforeEach(() => {
  fetchMock.mockReset()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

function mockGetOk(templates: unknown[], defaultTemplateId: string) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ templates, defaultTemplateId }),
  })
}

describe('useTemplates', () => {
  it('loads templates on mount', async () => {
    mockGetOk(
      [{ id: 'builtin-general', name: 'General', description: '', prompt: 'p', isBuiltin: true }],
      'builtin-general',
    )

    const { result } = renderHook(() => useTemplates())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.templates.length).toBe(1)
    expect(result.current.defaultTemplateId).toBe('builtin-general')
  })

  it('creates a custom template and updates local list', async () => {
    mockGetOk([], 'builtin-general')

    const { result } = renderHook(() => useTemplates())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'uuid-1', name: 'New', description: '', prompt: 'p'.repeat(25), isBuiltin: false }),
    })

    await act(async () => {
      await result.current.createTemplate({ name: 'New', prompt: 'p'.repeat(25) })
    })

    expect(result.current.templates.some((t) => t.id === 'uuid-1')).toBe(true)
  })

  it('calls setDefault endpoint and updates local default', async () => {
    mockGetOk(
      [{ id: 'builtin-general', name: 'General', description: '', prompt: 'p', isBuiltin: true }],
      'builtin-general',
    )

    const { result } = renderHook(() => useTemplates())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ default_template_id: 'builtin-1on1' }),
    })

    await act(async () => {
      await result.current.setDefault('builtin-1on1')
    })

    expect(result.current.defaultTemplateId).toBe('builtin-1on1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test hooks/__tests__/use-templates.test.tsx
```

Expected: fails, hook missing.

- [ ] **Step 3: Implement**

Create `hooks/use-templates.ts`:

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ResolvedNoteTemplate } from '@/lib/note-template'
import type { CreateTemplateInput, UpdateTemplateInput } from '@/lib/templates/template-schemas'

interface UseTemplatesReturn {
  templates: ResolvedNoteTemplate[]
  defaultTemplateId: string
  isLoading: boolean
  error: string | null
  createTemplate: (input: CreateTemplateInput) => Promise<ResolvedNoteTemplate>
  updateTemplate: (id: string, input: UpdateTemplateInput) => Promise<ResolvedNoteTemplate>
  deleteTemplate: (id: string) => Promise<void>
  setDefault: (id: string) => Promise<void>
}

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<ResolvedNoteTemplate[]>([])
  const [defaultTemplateId, setDefaultTemplateId] = useState<string>('builtin-general')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/templates', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load templates')
        const body = await res.json()
        if (!cancelled) {
          setTemplates(body.templates)
          setDefaultTemplateId(body.defaultTemplateId)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const createTemplate = useCallback(async (input: CreateTemplateInput) => {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error('Failed to create template')
    const created: ResolvedNoteTemplate = await res.json()
    setTemplates((prev) => [...prev, created])
    return created
  }, [])

  const updateTemplate = useCallback(async (id: string, input: UpdateTemplateInput) => {
    const res = await fetch(`/api/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error('Failed to update template')
    const updated: ResolvedNoteTemplate = await res.json()
    setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
    return updated
  }, [])

  const deleteTemplate = useCallback(async (id: string) => {
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete template')
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    setDefaultTemplateId((prev) => (prev === id ? 'builtin-general' : prev))
  }, [])

  const setDefault = useCallback(async (id: string) => {
    const res = await fetch('/api/user-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_template_id: id }),
    })
    if (!res.ok) throw new Error('Failed to set default template')
    setDefaultTemplateId(id)
  }, [])

  return {
    templates,
    defaultTemplateId,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefault,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test hooks/__tests__/use-templates.test.tsx
bun run typecheck
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-templates.ts hooks/__tests__/use-templates.test.tsx
git commit -m "feat(templates): useTemplates hook for list + CRUD"
```

---

## Task 9: Templates list component + page

**Files:**
- Create: `components/templates/templates-list.tsx`
- Create: `components/templates/templates-list.test.tsx`
- Create: `app/dashboard/templates/page.tsx`

- [ ] **Step 1: Write failing component test**

Create `components/templates/templates-list.test.tsx`:

```tsx
import { describe, it, expect, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplatesList } from './templates-list'
import type { ResolvedNoteTemplate } from '@/lib/note-template'

const BUILTIN: ResolvedNoteTemplate = {
  id: 'builtin-general',
  name: 'General',
  description: 'Balanced notes for any meeting type',
  prompt: 'p',
  isBuiltin: true,
}

const CUSTOM: ResolvedNoteTemplate = {
  id: 'uuid-1',
  name: 'Product Review',
  description: 'Weekly product sync',
  prompt: 'p'.repeat(25),
  isBuiltin: false,
}

describe('TemplatesList', () => {
  it('renders built-in and custom sections', () => {
    render(
      <TemplatesList
        templates={[BUILTIN, CUSTOM]}
        defaultTemplateId="builtin-general"
        onSetDefault={mock()}
        onDelete={mock()}
      />
    )
    expect(screen.getByText('Built-in')).toBeDefined()
    expect(screen.getByText('Your templates')).toBeDefined()
    expect(screen.getByText('General')).toBeDefined()
    expect(screen.getByText('Product Review')).toBeDefined()
  })

  it('shows filled star on default, hollow on others', () => {
    render(
      <TemplatesList
        templates={[BUILTIN, CUSTOM]}
        defaultTemplateId="builtin-general"
        onSetDefault={mock()}
        onDelete={mock()}
      />
    )
    const row = screen.getByText('General').closest('[data-slot="template-row"]')!
    expect(row.querySelector('[data-state="default"]')).toBeDefined()
  })

  it('calls onSetDefault when a hollow star is clicked', () => {
    const onSetDefault = mock()
    render(
      <TemplatesList
        templates={[BUILTIN, CUSTOM]}
        defaultTemplateId="builtin-general"
        onSetDefault={onSetDefault}
        onDelete={mock()}
      />
    )
    const starButton = screen.getByLabelText('Set Product Review as default')
    fireEvent.click(starButton)
    expect(onSetDefault).toHaveBeenCalledWith('uuid-1')
  })

  it('calls onDelete when delete button is clicked and confirmed', async () => {
    const onDelete = mock()
    render(
      <TemplatesList
        templates={[BUILTIN, CUSTOM]}
        defaultTemplateId="builtin-general"
        onSetDefault={mock()}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByLabelText('Delete Product Review'))
    // Confirm dialog appears; click confirm
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(onDelete).toHaveBeenCalledWith('uuid-1')
  })

  it('does not render Edit/Delete for built-ins', () => {
    render(
      <TemplatesList
        templates={[BUILTIN]}
        defaultTemplateId="builtin-general"
        onSetDefault={mock()}
        onDelete={mock()}
      />
    )
    expect(screen.queryByLabelText(/Delete General/)).toBe(null)
    expect(screen.queryByLabelText(/Edit General/)).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test components/templates/templates-list.test.tsx
```

Expected: fails — component not implemented.

- [ ] **Step 3: Implement the component**

Create `components/templates/templates-list.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star, Trash2, Pencil } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ResolvedNoteTemplate } from '@/lib/note-template'
import { cn } from '@/lib/utils'

interface TemplatesListProps {
  templates: ResolvedNoteTemplate[]
  defaultTemplateId: string
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void
}

export function TemplatesList({ templates, defaultTemplateId, onSetDefault, onDelete }: TemplatesListProps) {
  const builtins = templates.filter((t) => t.isBuiltin)
  const custom = templates.filter((t) => !t.isBuiltin)
  const [pendingDelete, setPendingDelete] = useState<ResolvedNoteTemplate | null>(null)

  return (
    <div className="space-y-8">
      <Section title="Built-in">
        {builtins.map((tpl) => (
          <Row
            key={tpl.id}
            template={tpl}
            isDefault={tpl.id === defaultTemplateId}
            onSetDefault={onSetDefault}
          />
        ))}
      </Section>

      <Section title="Your templates">
        {custom.length === 0 ? (
          <EmptyCustom />
        ) : (
          custom.map((tpl) => (
            <Row
              key={tpl.id}
              template={tpl}
              isDefault={tpl.id === defaultTemplateId}
              onSetDefault={onSetDefault}
              onRequestDelete={() => setPendingDelete(tpl)}
            />
          ))
        )}
      </Section>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom template</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.name}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="rounded-xl border border-border bg-background overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  )
}

function Row({
  template,
  isDefault,
  onSetDefault,
  onRequestDelete,
}: {
  template: ResolvedNoteTemplate
  isDefault: boolean
  onSetDefault: (id: string) => void
  onRequestDelete?: () => void
}) {
  return (
    <div
      data-slot="template-row"
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-card/40 transition-colors"
    >
      <button
        type="button"
        onClick={() => !isDefault && onSetDefault(template.id)}
        aria-label={isDefault ? `${template.name} is the default` : `Set ${template.name} as default`}
        className="shrink-0"
      >
        <Star
          data-state={isDefault ? 'default' : 'idle'}
          className={cn(
            'size-[18px] transition-colors',
            isDefault ? 'fill-accent text-accent' : 'text-muted-foreground hover:text-accent'
          )}
        />
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-foreground">{template.name}</div>
        {template.description ? (
          <div className="text-[12.5px] text-muted-foreground truncate">{template.description}</div>
        ) : null}
      </div>

      {!template.isBuiltin ? (
        <div className="flex items-center gap-1 text-[12px]">
          <Link
            href={`/dashboard/templates/${template.id}`}
            aria-label={`Edit ${template.name}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card"
          >
            <Pencil className="size-3.5" />
            Edit
          </Link>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`Delete ${template.name}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-destructive hover:bg-card"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}

function EmptyCustom() {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-[13px] text-muted-foreground mb-3">
        You don&apos;t have any custom templates yet.
      </p>
      <Link
        href="/dashboard/templates/new"
        className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
      >
        Create one from scratch →
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Run component test**

```bash
bun test components/templates/templates-list.test.tsx
bun run typecheck
```

Expected: 5 tests pass.

- [ ] **Step 5: Build the page shell**

Create `app/dashboard/templates/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useTemplates } from '@/hooks/use-templates'
import { TemplatesList } from '@/components/templates/templates-list'

export default function TemplatesPage() {
  const { templates, defaultTemplateId, isLoading, setDefault, deleteTemplate } = useTemplates()

  return (
    <div className="mx-auto max-w-[960px] px-6 py-10">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-[22px] tracking-tight font-[650]">Templates</h1>
        <Link
          href="/dashboard/templates/new"
          className="rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-[12px] font-medium hover:opacity-90 inline-flex items-center gap-1.5"
        >
          <Plus className="size-3.5" />
          New template
        </Link>
      </div>
      <p className="text-[13px] text-muted-foreground mb-8 max-w-[560px]">
        Templates shape how AI writes your notes — what sections appear, what tone is used, what to capture.
        Pick one as your default. Built-ins are read-only; custom templates are fully editable.
      </p>

      {isLoading ? (
        <div className="text-[13px] text-muted-foreground">Loading…</div>
      ) : (
        <TemplatesList
          templates={templates}
          defaultTemplateId={defaultTemplateId}
          onSetDefault={setDefault}
          onDelete={deleteTemplate}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Visual sanity check**

Run `bun dev`, log in, navigate to `/dashboard/templates`. Verify:
- Built-in section shows 5 rows with General starred
- Your templates shows empty-state card
- Clicking star on another built-in moves the filled star and `/api/user-preferences` returns 200

- [ ] **Step 7: Commit**

```bash
git add components/templates/templates-list.tsx components/templates/templates-list.test.tsx app/dashboard/templates/page.tsx
git commit -m "feat(ui): templates list page with sections, star-as-default, delete flow"
```

---

## Task 10: Template editor form + new/edit pages

**Files:**
- Create: `components/templates/template-editor-form.tsx`
- Create: `components/templates/template-editor-form.test.tsx`
- Create: `app/dashboard/templates/new/page.tsx`
- Create: `app/dashboard/templates/[id]/page.tsx`

- [ ] **Step 1: Write failing form test**

Create `components/templates/template-editor-form.test.tsx`:

```tsx
import { describe, it, expect, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateEditorForm } from './template-editor-form'

describe('TemplateEditorForm', () => {
  it('disables Save while fields are invalid', () => {
    render(<TemplateEditorForm onSubmit={mock()} onCancel={mock()} />)
    const save = screen.getByRole('button', { name: /save template/i })
    expect(save.hasAttribute('disabled')).toBe(true)
  })

  it('enables Save when all required fields are valid', () => {
    render(<TemplateEditorForm onSubmit={mock()} onCancel={mock()} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Custom X' } })
    fireEvent.change(screen.getByLabelText(/prompt/i), { target: { value: 'p'.repeat(25) } })
    const save = screen.getByRole('button', { name: /save template/i })
    expect(save.hasAttribute('disabled')).toBe(false)
  })

  it('calls onSubmit with trimmed input', () => {
    const onSubmit = mock()
    render(<TemplateEditorForm onSubmit={onSubmit} onCancel={mock()} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: '  Custom X  ' } })
    fireEvent.change(screen.getByLabelText(/prompt/i), { target: { value: 'p'.repeat(25) } })
    fireEvent.click(screen.getByRole('button', { name: /save template/i }))
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Custom X',
      description: undefined,
      prompt: 'p'.repeat(25),
    })
  })

  it('prefills from initial when editing', () => {
    render(
      <TemplateEditorForm
        onSubmit={mock()}
        onCancel={mock()}
        initial={{ name: 'Existing', description: 'desc', prompt: 'p'.repeat(25) }}
      />
    )
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Existing')
    expect((screen.getByLabelText(/description/i) as HTMLInputElement).value).toBe('desc')
  })

  it('calls onCancel when cancel clicked', () => {
    const onCancel = mock()
    render(<TemplateEditorForm onSubmit={mock()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test components/templates/template-editor-form.test.tsx
```

Expected: fails, form missing.

- [ ] **Step 3: Implement the form**

Create `components/templates/template-editor-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createTemplateSchema, type CreateTemplateInput } from '@/lib/templates/template-schemas'

interface TemplateEditorFormProps {
  onSubmit: (input: CreateTemplateInput) => void
  onCancel: () => void
  initial?: Partial<CreateTemplateInput>
  submitLabel?: string
}

export function TemplateEditorForm({ onSubmit, onCancel, initial, submitLabel = 'Save template' }: TemplateEditorFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [prompt, setPrompt] = useState(initial?.prompt ?? '')

  const payload = {
    name: name.trim(),
    description: description.trim() || undefined,
    prompt: prompt.trim(),
  }
  const parse = createTemplateSchema.safeParse(payload)
  const canSubmit = parse.success

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) onSubmit(parse.data)
      }}
      className="space-y-6"
    >
      <Field
        label="Name"
        hint="Shown in the picker at generation time"
        counter={`${name.length} / 60`}
      >
        <input
          type="text"
          aria-label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Sales discovery call"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        />
      </Field>

      <Field
        label="Description (optional)"
        hint="1-line hint shown in the picker"
        counter={`${description.length} / 200`}
      >
        <input
          type="text"
          aria-label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="e.g. Discovery calls with qualified leads"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        />
      </Field>

      <Field
        label="Prompt"
        hint="This instruction layers on top of the base note generation prompt."
        counter={`${prompt.length} chars`}
      >
        <textarea
          aria-label="Prompt"
          rows={14}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={10_000}
          placeholder="Describe how the AI should shape the output…"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13px] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-[13px] font-medium hover:bg-card">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

function Field({ label, hint, counter, children }: { label: string; hint: string; counter: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium mb-1.5">{label}</label>
      {children}
      <div className="flex justify-between mt-1">
        <div className="text-[11px] text-muted-foreground">{hint}</div>
        <div className="text-[11px] text-muted-foreground tabular-nums">{counter}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run form test**

```bash
bun test components/templates/template-editor-form.test.tsx
bun run typecheck
```

Expected: 5 tests pass.

- [ ] **Step 5: Create new-template page**

Create `app/dashboard/templates/new/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TemplateEditorForm } from '@/components/templates/template-editor-form'
import { useTemplates } from '@/hooks/use-templates'

export default function NewTemplatePage() {
  const router = useRouter()
  const { createTemplate } = useTemplates()

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <h1 className="text-[22px] tracking-tight font-[650] mb-1">New template</h1>
      <p className="text-[13px] text-muted-foreground mb-8">
        Custom templates apply your own structure and tone to AI-generated notes.
      </p>
      <TemplateEditorForm
        onSubmit={async (input) => {
          try {
            const created = await createTemplate(input)
            toast.success(`Template "${created.name}" created`)
            router.push('/dashboard/templates')
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to create template')
          }
        }}
        onCancel={() => router.push('/dashboard/templates')}
      />
    </div>
  )
}
```

- [ ] **Step 6: Create edit page**

Create `app/dashboard/templates/[id]/page.tsx`:

```tsx
'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TemplateEditorForm } from '@/components/templates/template-editor-form'
import { useTemplates } from '@/hooks/use-templates'

export default function EditTemplatePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params)
  const router = useRouter()
  const { templates, isLoading, updateTemplate } = useTemplates()

  if (isLoading) {
    return <div className="mx-auto max-w-[720px] px-6 py-10 text-[13px] text-muted-foreground">Loading…</div>
  }

  const template = templates.find((t) => t.id === id)

  if (!template || template.isBuiltin) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-10">
        <p className="text-[13px] text-muted-foreground">Template not found or read-only.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <h1 className="text-[22px] tracking-tight font-[650] mb-8">Edit template</h1>
      <TemplateEditorForm
        submitLabel="Save changes"
        initial={{
          name: template.name,
          description: template.description,
          prompt: template.prompt,
        }}
        onSubmit={async (input) => {
          try {
            await updateTemplate(id, input)
            toast.success('Template updated')
            router.push('/dashboard/templates')
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update template')
          }
        }}
        onCancel={() => router.push('/dashboard/templates')}
      />
    </div>
  )
}
```

- [ ] **Step 7: Manual sanity check**

Start `bun dev`, navigate to `/dashboard/templates/new`, fill name + prompt, save. Confirm redirect to list. Click Edit on the newly-created row. Modify prompt. Save. Confirm the row in the list reflects the new description.

- [ ] **Step 8: Commit**

```bash
git add components/templates/template-editor-form.tsx components/templates/template-editor-form.test.tsx app/dashboard/templates/new/page.tsx "app/dashboard/templates/[id]/page.tsx"
git commit -m "feat(ui): template editor form and new/edit pages"
```

---

## Task 11: Template picker on "Create notes"

**Files:**
- Create: `components/templates/template-picker.tsx`
- Create: `components/templates/template-picker.test.tsx`
- Modify: the component that renders the "Create notes" CTA on the meeting page (search for the string "Create notes" in `components/` to locate it — likely `components/draft-action-bar.tsx` or `components/meeting-note-surface.tsx`)

- [ ] **Step 1: Write failing picker test**

Create `components/templates/template-picker.test.tsx`:

```tsx
import { describe, it, expect, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplatePicker } from './template-picker'
import type { ResolvedNoteTemplate } from '@/lib/note-template'

const BUILTIN_GENERAL: ResolvedNoteTemplate = {
  id: 'builtin-general', name: 'General', description: 'Balanced', prompt: 'p', isBuiltin: true,
}
const BUILTIN_1ON1: ResolvedNoteTemplate = {
  id: 'builtin-1on1', name: '1:1 / Check-in', description: 'Warm', prompt: 'p', isBuiltin: true,
}
const CUSTOM: ResolvedNoteTemplate = {
  id: 'uuid-x', name: 'Product Review', description: 'Custom', prompt: 'p'.repeat(25), isBuiltin: false,
}

describe('TemplatePicker', () => {
  it('button label shows the pre-selected template name', () => {
    render(
      <TemplatePicker
        templates={[BUILTIN_GENERAL, BUILTIN_1ON1, CUSTOM]}
        selectedId="builtin-1on1"
        onChange={mock()}
        onConfirm={mock()}
      />
    )
    expect(screen.getByRole('button', { name: /1:1 \/ check-in/i })).toBeDefined()
  })

  it('opens the dropdown when caret clicked and groups built-in / custom', () => {
    render(
      <TemplatePicker
        templates={[BUILTIN_GENERAL, BUILTIN_1ON1, CUSTOM]}
        selectedId="builtin-general"
        onChange={mock()}
        onConfirm={mock()}
      />
    )
    fireEvent.click(screen.getByLabelText(/choose template/i))
    expect(screen.getByText('Built-in')).toBeDefined()
    expect(screen.getByText('Your templates')).toBeDefined()
    expect(screen.getByText('Product Review')).toBeDefined()
  })

  it('clicking a template calls onChange but not onConfirm', () => {
    const onChange = mock()
    const onConfirm = mock()
    render(
      <TemplatePicker
        templates={[BUILTIN_GENERAL, BUILTIN_1ON1, CUSTOM]}
        selectedId="builtin-general"
        onChange={onChange}
        onConfirm={onConfirm}
      />
    )
    fireEvent.click(screen.getByLabelText(/choose template/i))
    fireEvent.click(screen.getByRole('menuitem', { name: /1:1 \/ check-in/i }))
    expect(onChange).toHaveBeenCalledWith('builtin-1on1')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('clicking the main button calls onConfirm with selectedId', () => {
    const onConfirm = mock()
    render(
      <TemplatePicker
        templates={[BUILTIN_GENERAL, BUILTIN_1ON1, CUSTOM]}
        selectedId="builtin-1on1"
        onChange={mock()}
        onConfirm={onConfirm}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /create notes with/i }))
    expect(onConfirm).toHaveBeenCalledWith('builtin-1on1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test components/templates/template-picker.test.tsx
```

Expected: fails, component missing.

- [ ] **Step 3: Implement the picker**

Create `components/templates/template-picker.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Check } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ResolvedNoteTemplate } from '@/lib/note-template'

interface TemplatePickerProps {
  templates: ResolvedNoteTemplate[]
  selectedId: string
  onChange: (id: string) => void
  onConfirm: (id: string) => void
  buttonLabel?: string
  disabled?: boolean
}

export function TemplatePicker({
  templates,
  selectedId,
  onChange,
  onConfirm,
  buttonLabel = 'Create notes with:',
  disabled,
}: TemplatePickerProps) {
  const [open, setOpen] = useState(false)
  const builtins = templates.filter((t) => t.isBuiltin)
  const custom = templates.filter((t) => !t.isBuiltin)
  const selected = templates.find((t) => t.id === selectedId) ?? builtins[0]

  return (
    <div className="inline-flex items-center rounded-full bg-primary text-primary-foreground">
      <button
        type="button"
        onClick={() => onConfirm(selected.id)}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-l-full pl-5 pr-3 py-2.5 text-[13px] font-medium hover:opacity-90 disabled:opacity-60"
      >
        <span>{buttonLabel}</span>
        <span className="rounded-lg bg-white/15 px-2 py-0.5 text-[12px]">{selected.name}</span>
      </button>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label="Choose template"
          className="inline-flex items-center rounded-r-full pr-4 pl-2 py-2.5 hover:opacity-90 border-l border-white/15"
        >
          <ChevronDown className="size-[14px]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[340px] p-2">
          <GroupLabel>Built-in</GroupLabel>
          {builtins.map((tpl) => (
            <TemplateItem key={tpl.id} template={tpl} selected={tpl.id === selectedId} onChange={onChange} />
          ))}
          {custom.length > 0 ? (
            <>
              <GroupLabel>Your templates</GroupLabel>
              {custom.map((tpl) => (
                <TemplateItem key={tpl.id} template={tpl} selected={tpl.id === selectedId} onChange={onChange} />
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/templates" className="text-[12px] text-accent font-medium">
              Manage templates →
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

function TemplateItem({
  template,
  selected,
  onChange,
}: {
  template: ResolvedNoteTemplate
  selected: boolean
  onChange: (id: string) => void
}) {
  return (
    <DropdownMenuItem
      role="menuitem"
      onSelect={(e) => {
        e.preventDefault()
        onChange(template.id)
      }}
      className={cn(
        'flex items-start justify-between gap-2 px-2 py-1.5 rounded-lg',
        selected && 'bg-accent/10'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className={cn('text-[13px] font-medium', selected ? 'text-accent' : 'text-foreground')}>
          {template.name}
        </div>
        {template.description ? (
          <div className={cn('text-[11.5px] truncate', selected ? 'text-accent/80' : 'text-muted-foreground')}>
            {template.description}
          </div>
        ) : null}
      </div>
      {selected ? <Check className="size-3.5 text-accent shrink-0 mt-0.5" strokeWidth={2.5} /> : null}
    </DropdownMenuItem>
  )
}
```

- [ ] **Step 4: Run picker test**

```bash
bun test components/templates/template-picker.test.tsx
bun run typecheck
```

Expected: 4 tests pass.

- [ ] **Step 5: Find the "Create notes" CTA and integrate the picker**

```bash
grep -rn "Create notes" components/ app/ 2>/dev/null
```

Identify the component (e.g., `components/draft-action-bar.tsx`). Replace the single button with the `TemplatePicker`, feeding it from `useTemplates()` and threading the confirmed `template_id` into the existing call that fires `/api/meetings/[id]/enhance`.

Concretely, in the integration point:

```tsx
// Inside the component that currently has the "Create notes" button:
import { useTemplates } from '@/hooks/use-templates'
import { TemplatePicker } from '@/components/templates/template-picker'

// Inside the function body:
const { templates, defaultTemplateId, isLoading } = useTemplates()
const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
const effectiveId = selectedTemplateId ?? defaultTemplateId

// Where the old <Button onClick={handleCreate}>Create notes</Button> lived:
<TemplatePicker
  templates={templates}
  selectedId={effectiveId}
  onChange={setSelectedTemplateId}
  onConfirm={(id) => handleCreate({ templateId: id })}
  disabled={isLoading || /* whatever other disabled conditions exist */}
/>
```

The existing `handleCreate`/`requestDraft` function also needs to forward `templateId` into the request body as `template_id`. Trace from the meeting page → `useDraftProposal` → wherever `/api/meetings/[id]/enhance` is called and add the field there.

- [ ] **Step 6: Add an integration check**

Start `bun dev`, open a meeting with a transcript. The button should now show `Create notes with: General ▾` and the dropdown should open with all 5 built-ins plus any custom templates. Pick a different template, click the main button, confirm a real generation runs against that template. (If you've added a custom template, the request payload will have `template_id: '<uuid>'`.)

Verify in network tab that the POST to `/api/meetings/[id]/enhance` contains the `template_id` field.

- [ ] **Step 7: Commit**

```bash
git add components/templates/template-picker.tsx components/templates/template-picker.test.tsx <integration-file>
git commit -m "feat(ui): template picker on Create notes flow"
```

(Replace `<integration-file>` with the actual file you modified in step 5.)

---

## Task 12: Sidebar nav — add Templates + sage-accent active state

**Files:**
- Modify: `components/app-sidebar.tsx`
- Modify (possibly): `components/ui/sidebar.tsx` if the active-state styling needs to change at the primitive level

- [ ] **Step 1: Inspect current active-state styling**

```bash
grep -n "data-\[active" components/ui/sidebar.tsx
```

Note the existing classes applied when `isActive=true`. If the primitive uses a specific active background, we will override it at the usage site.

- [ ] **Step 2: Add the Templates nav item and active sage styling**

In `components/app-sidebar.tsx`, update the `navItems` list to include Templates, and override the active class on `SidebarMenuButton`:

```tsx
// At the top, alongside FileText import:
import { FileText, Plus, LayoutGrid } from 'lucide-react'

// Replace the existing navItems definition:
const navItems = [
  { href: '/dashboard', label: 'Notes', icon: FileText },
  { href: '/dashboard/templates', label: 'Templates', icon: LayoutGrid },
]

// In the SidebarMenu map, change:
<SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>

// To a version that carries sage-accent active styling. Either pass className:
<SidebarMenuButton
  asChild
  isActive={isActive}
  tooltip={item.label}
  className="data-[active=true]:bg-accent/10 data-[active=true]:text-accent data-[active=true]:hover:bg-accent/10 data-[active=true]:hover:text-accent"
>
```

Note: if overriding at the usage site doesn't win against the primitive's internal class, update the primitive's active class to `bg-accent/10 text-accent` directly in `components/ui/sidebar.tsx`. Keep that change scoped to the `data-[active=true]` selectors only.

- [ ] **Step 3: Manual check**

Start `bun dev`. Navigate to `/dashboard` — "Notes" is highlighted in sage. Navigate to `/dashboard/templates` — "Templates" is highlighted in sage instead, "Notes" is not. Confirm "New meeting" button at the top stays black (unchanged).

- [ ] **Step 4: Commit**

```bash
git add components/app-sidebar.tsx components/ui/sidebar.tsx
git commit -m "feat(sidebar): add Templates nav item with sage-accent active state"
```

---

## Task 13: Full integration smoke check

- [ ] **Step 1: End-to-end manual walkthrough**

Start `bun dev`. Log in. Run through:

1. Navigate to `/dashboard/templates`. Confirm Notes and Templates nav items render, Templates is sage-highlighted, and the 5 built-ins appear with General starred.
2. Click star on "1:1 / Check-in". Confirm filled star moves and network call `PATCH /api/user-preferences` returns 200.
3. Click `+ New template`. Fill name `Test Template`, prompt with 50 characters. Save. Confirm redirect to list, new row appears under "Your templates".
4. Click Edit on the new row. Change description. Save. Confirm list reflects change.
5. Navigate to an existing meeting with a transcript. Confirm the CTA shows `Create notes with: 1:1 / Check-in ▾`. Open dropdown, click "Customer interview". Click main button to fire generation. Confirm the generated notes reflect interview-style structure (quotes as blockquotes, empty decisions).
6. Return to `/dashboard/templates`. Click delete on "Test Template". Confirm modal, confirm delete. Row disappears.

- [ ] **Step 2: Run full test + lint**

```bash
bun test
bun run typecheck
bun run lint
```

Expected: all tests pass, no type errors, lint clean.

- [ ] **Step 3: Commit any cleanup**

If the walkthrough surfaced small issues (string copy, missing confirmation, a11y label tweak), fix them now in a single commit:

```bash
git add -A
git commit -m "fix(templates): post-integration polish"
```

If no issues, skip this step.

---

## Out of scope (deferred to v2)

These are explicitly NOT part of this plan, matching the spec:

- Shared/team templates
- Template import/export
- Dynamic output schema per template
- Cloning built-ins as starting points
- Per-meeting sticky template (no `last_used_template_id`)
- Template preview / example-output rendering
- Search/filter on templates page
- Rich prompt editor with variables/tokens
