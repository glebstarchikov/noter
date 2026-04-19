# Templates Revival — Design Spec

**Status:** Draft for implementation
**Date:** 2026-04-19
**Owner:** Gleb
**Scope:** Single implementation plan (1 sub-project)

## Goal

Bring back user-selectable note templates so that the AI generates notes matching the meeting type. Each template controls both **output structure** (what sections appear and how they're organized within `detailed_notes`) and **tone** (voice, formality, level of detail).

## Problem

Today, every meeting gets the same generic `DEFAULT_NOTE_TEMPLATE` prompt regardless of meeting type. A sprint planning session, a customer interview, and a university lecture all produce notes with identical structure. This is fine for generic meetings but actively wastes context for specialized ones — customer interview quotes get diluted into general bullets, lecture theses get buried.

Templates were removed in Phase 2 of the Workspace redesign (migrations [scripts/007_create_note_templates.sql](../../../scripts/007_create_note_templates.sql) and [scripts/010_drop_note_templates.sql](../../../scripts/010_drop_note_templates.sql)) as part of a scope reduction. The prompt-plumbing survived: [lib/note-template.ts](../../../lib/note-template.ts) still has `ResolvedNoteTemplate` and `formatTemplateContext()`, and both `buildNotesGenerationPrompt()` and `buildDraftProposalPrompt()` accept a template argument. We just need to bring back storage + UI + the picker flow.

## Non-goals

- **Bots that join meetings** — separate feature, not in scope
- **Shared/team templates** — single-user only for MVP; no org model
- **Template import/export (JSON)** — YAGNI
- **Search/filter on templates page** — 5 built-ins + a handful of custom is too small to need it
- **Dynamic output schema per template** — all templates produce the same 7-field shape; template-specific structure lives inside the `detailed_notes` markdown
- **Template preview / example-output rendering** — complexity for low value in v1

## Architecture

### Two sources of templates

**Built-in templates** live in code (`lib/note-template.ts`), not in the DB.
- Stable string IDs: `builtin-general`, `builtin-1on1`, `builtin-team`, `builtin-interview`, `builtin-lecture`
- Shipped with the app; self-hosters get them automatically via normal deploy
- Read-only — users cannot edit or delete
- Prompt changes ship as normal code releases, no DB migration needed

**Custom templates** live in the DB, one row per user-owned template.
- UUID primary key
- Standard RLS (scoped to owner)
- Full CRUD by owner

The merged list (built-ins + user's custom) is what the user sees in the picker and on the management page.

### Data model

**New migration: `scripts/011_revive_note_templates.sql`**

```sql
-- Custom templates (user-owned)
create table public.note_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  prompt      text not null,
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

create index note_templates_user_id_idx
  on public.note_templates (user_id);

-- User preferences (new table)
create table public.user_preferences (
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

**No changes to the `meetings` table.** The user's current preference always wins — no per-meeting sticky template state.

**Why `default_template_id` is `text`, not a FK:** it needs to accept either a built-in string ID (e.g., `'builtin-1on1'`) or a custom UUID. Resolution happens in code.

### Template resolution

Update [lib/note-template.ts](../../../lib/note-template.ts):

```ts
export const BUILTIN_TEMPLATES: Record<string, ResolvedNoteTemplate> = {
  'builtin-general':   { id: 'builtin-general',   name: 'General',              /* ... */ isBuiltin: true },
  'builtin-1on1':      { id: 'builtin-1on1',      name: '1:1 / Check-in',       /* ... */ isBuiltin: true },
  'builtin-team':      { id: 'builtin-team',      name: 'Team meeting',         /* ... */ isBuiltin: true },
  'builtin-interview': { id: 'builtin-interview', name: 'Customer interview',   /* ... */ isBuiltin: true },
  'builtin-lecture':   { id: 'builtin-lecture',   name: 'Lecture / Talk',       /* ... */ isBuiltin: true },
}

export const FALLBACK_TEMPLATE_ID = 'builtin-general'

/**
 * Resolve a template by ID. Handles both built-in string IDs and custom UUIDs.
 * Falls back to 'builtin-general' if the ID is invalid, missing, or points to a
 * deleted custom template.
 */
export async function resolveTemplate(
  id: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<ResolvedNoteTemplate> {
  if (id.startsWith('builtin-')) {
    return BUILTIN_TEMPLATES[id] ?? BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]
  }

  // Custom template — fetch from DB (RLS enforces ownership)
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
```

`DEFAULT_NOTE_TEMPLATE` becomes a re-export of `BUILTIN_TEMPLATES['builtin-general']` for backwards compatibility with any consumer that still imports it.

### Output schema (unchanged)

Templates shape content within the existing hard output schema defined in `BASE_NOTES_GENERATION_PROMPT` ([lib/notes/prompts.ts:4](../../../lib/notes/prompts.ts#L4)):

- `title` — short descriptive meeting title
- `summary` — 1–3 sentence executive summary
- `detailed_notes` — markdown, comprehensive notes (template-specific structure lives here as `##` headers and bullet groups)
- `action_items` — `[{ task, owner, due_date, done }]`
- `key_decisions` — `string[]`
- `topics` — `string[]`
- `follow_ups` — `string[]`

Lectures and customer interviews may leave `action_items` or `key_decisions` empty — that's fine. The UI already handles empty arrays gracefully.

## UI

### Management page: `/dashboard/templates`

New sidebar nav item placed below "Notes".

**List view:**
- Two sections: "Built-in" (5 rows, read-only) and "Your templates" (0+ rows)
- Each row: name, 1-line description, star icon (default), row actions
- Built-in rows: only the star icon (clickable to set as default)
- Custom rows: star + `[Edit]` + `[Delete]`
- Top-right: `[+ New template]` button

**Star icon behavior:**
- Filled sage star = current default
- Hollow sage-outline star = clickable, sets that template as user's default
- Exactly one template has a filled star at all times

**Empty state for "Your templates":**
```
You don't have any custom templates yet.
[+ Create one from scratch]
```

**Editor form** (shown at `/dashboard/templates/new` and `/dashboard/templates/[id]` for edit):
- **Name** — text input, required, max 60 chars
- **Description** — text input, optional, max 200 chars, shown as 1-liner in picker
- **Prompt** — multiline textarea, required, monospaced font, min 12 rows
- `[Save]` and `[Cancel]` buttons
- Unsaved-changes warning on navigation away

**Delete confirmation:** Modal — *"Delete custom template 'X'? This cannot be undone."* Two buttons: Cancel | Delete. If the deleted template was the user's default, the server automatically resets default to `'builtin-general'`.

### Picker integration at "Create notes"

Today the meeting page has a single-click "Create notes" CTA (and later a "Regenerate" action). That button becomes a button group:

```
[ Create notes with: General ▾ ]
```

Clicking the caret opens a dropdown:

```
BUILT-IN
  ⭐ General                    Balanced notes for any meeting type
     1:1 / Check-in             Warm two-person conversations
     Team meeting               Sprint planning, standup, retros
     Customer interview         Research calls with quotes
     Lecture / Talk             Educational content
YOUR TEMPLATES
     Product Review             Custom for weekly prod sync
─────────────────────────
Manage templates →
```

**Behavior:**
- Pre-selected template = user's current default
- Two-click interaction: click a template to change the selection (updates the button label); click the main button to fire generation with the selected template
- "Manage templates →" is a text link at the bottom of the dropdown, routes to `/dashboard/templates`

**Why two-click, not one-click:** One-click dropdown selection would fire expensive generation immediately on a misclick. Two-click gives the user a chance to confirm and see what template is selected.

### Visual language

Matches existing Workspace design rules:
- `bg-card` tinted surface for cards and list rows
- `rounded-xl` for cards, `rounded-lg` for chips
- Sage accent for default-star, active states, and section labels (`uppercase tracking-wider text-muted-foreground font-medium`)
- `Inter` only, weights 400/500/550/650
- No `shadow-md` on inline cards — dropdown and editor form use the project's existing shadow conventions

### Sidebar selected-state treatment

With the introduction of `/dashboard/templates` as a second nav item, all selected nav items use the same treatment: `bg-accent/10 text-accent` (soft sage tint). This applies to both `Notes` and `Templates` — whichever matches the current pathname gets the sage highlight. The "+ New meeting" action button at the top of the sidebar stays unchanged — it's a CTA, not a nav item.

Implementation touches [components/app-sidebar.tsx](../../../components/app-sidebar.tsx) and whatever `SidebarMenuButton` styling the project uses for `data-[active=true]`.

## API surface

All endpoints under `app/api/templates/...` and `app/api/user-preferences/`. All routes use `validateBody(request, schema)` from `@/lib/api/validate` and `errorResponse()` from `@/lib/api/api-helpers` per project conventions. All errors route through `Sentry.captureException()`.

```ts
GET /api/templates
  // Returns { templates: ResolvedNoteTemplate[], defaultTemplateId: string }
  // Merges built-ins + user's custom. defaultTemplateId comes from user_preferences.
  // 401 if unauthenticated.

POST /api/templates
  // Body: { name: string, description?: string, prompt: string }
  // Creates a custom template owned by the user. Returns the created template.
  // 400 if validation fails. 401 if unauthenticated. 500 on DB error.

PATCH /api/templates/[id]
  // Body: { name?, description?, prompt? }
  // 403 if id starts with "builtin-". 404 if not found or not owned.
  // Returns the updated template.

DELETE /api/templates/[id]
  // 403 if id starts with "builtin-". 404 if not found or not owned.
  // Side effect: if this was the user's default, reset user_preferences.default_template_id to 'builtin-general'.
  // Returns { ok: true }.

PATCH /api/user-preferences
  // Body: { default_template_id: string }
  // Validates that default_template_id is either a valid built-in or a custom template the user owns.
  // 400 if invalid. Upserts user_preferences row.
  // Returns { default_template_id }.
```

### Integration with the enhance/generate route

Existing `POST /api/meetings/[id]/enhance` route at [app/api/meetings/[id]/enhance/route.ts](../../../app/api/meetings/[id]/enhance/route.ts) gains one optional body field:

```ts
template_id?: string
```

**Server-side resolution logic:**

```ts
// Inside the enhance validation / server handler:
const userPrefs = await supabase
  .from('user_preferences')
  .select('default_template_id')
  .eq('user_id', userId)
  .maybeSingle()

const templateId = body.template_id
  ?? userPrefs.data?.default_template_id
  ?? 'builtin-general'

const template = await resolveTemplate(templateId, userId, supabase)
// ...existing call to buildDraftProposalPrompt({ template, ... })
```

No template state is persisted back on the meeting. User's default is the only source of truth; it wins on every regeneration unless the request explicitly overrides.

### Validation for template bodies

Use Zod schemas in [lib/schemas.ts](../../../lib/schemas.ts) or a new `lib/templates/template-schemas.ts`:

```ts
export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional(),
  prompt: z.string().trim().min(20).max(10_000),
})

export const updateTemplateSchema = createTemplateSchema.partial()

export const setDefaultSchema = z.object({
  default_template_id: z.string().trim().min(1),
})
```

## Client hook

New `hooks/use-templates.ts`:

```ts
export function useTemplates(): {
  templates: ResolvedNoteTemplate[]
  defaultTemplateId: string
  isLoading: boolean
  createTemplate: (input: CreateTemplateInput) => Promise<ResolvedNoteTemplate>
  updateTemplate: (id: string, input: UpdateTemplateInput) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  setDefault: (id: string) => Promise<void>
}
```

Single source of truth for both the management page and the picker. Uses SWR-style caching (fetch once, revalidate on mutations). Optimistic updates for mutations where possible.

## Built-in template prompts

Each built-in has a ~100–200 word prompt that layers on top of the base schema. The prompt guides **structural emphasis within `detailed_notes`** and **tone**. It does not introduce new output fields.

### `builtin-general` — Balanced notes for any meeting type

- **Emphasis:** Even distribution across all fields. No single section dominates.
- **Tone:** Neutral, professional, clear.
- **Special rules:** None.
- **Use case:** Catch-all when the meeting type is unclear or not specific.

### `builtin-1on1` — Warm two-person conversations

- **Emphasis:** Growth/development topics, feedback exchanged, blockers surfaced, mutual commitments. Preserve the human dynamic — who asked what, who responded how.
- **Tone:** Warm, personal, first-or-second-person where the transcript uses it. Avoid corporate-speak.
- **Special rules:** Action items attribute to each participant clearly. If one person talks >80% of the time, the summary flags the meeting as asymmetric.
- **Use case:** Manager/report, founder/mentor, peer check-ins.

### `builtin-team` — Sprint planning, standups, retros

- **Emphasis:** Topics in agenda order (reconstructed), decisions with rationale, action items with explicit owners and due dates, blockers called out in a dedicated bullet group within `detailed_notes`.
- **Tone:** Concise, tactical, info-dense. Structured bullets over narrative.
- **Special rules:** If the transcript has standup format ("what I did / what I'm doing / blockers"), mirror that structure. Parked/deferred items go into `follow_ups`, not `action_items`.
- **Use case:** Engineering standups, sprint planning, retrospectives, cross-functional syncs.

### `builtin-interview` — Customer/user research calls

- **Emphasis:** Pain points in the customer's own words (verbatim quotes where possible), goals expressed, features requested, emotional sentiment per topic.
- **Tone:** Observational, not interpretive. Report what the customer said; don't translate into internal frameworks.
- **Special rules:** When the customer says something quotable, include it verbatim as a markdown blockquote (`> "..."`) inside `detailed_notes`. `action_items` captures internal follow-ups we owe them; `follow_ups` captures things to explore in the next conversation. `key_decisions` may be empty.
- **Use case:** Discovery calls, usability sessions, feedback interviews.

### `builtin-lecture` — Educational content, talks

- **Emphasis:** Main thesis stated first, then key concepts explained, then examples illustrating each concept, then questions raised (from audience if Q&A), then references/resources mentioned.
- **Tone:** Structured, faithful to the speaker's argument, preserves intellectual nuance over brevity.
- **Special rules:** `topics` reconstructs the speaker's outline in order. `key_decisions` typically empty — don't force it. `action_items` captures learning-related follow-ups ("read paper X") rather than business actions.
- **Use case:** Conference talks, university lectures, podcast transcripts.

## Edge cases

| Scenario | Behavior |
|---|---|
| User deletes the custom template that was their default | Server-side cleanup in DELETE handler resets `user_preferences.default_template_id` to `'builtin-general'`. Client revalidates. |
| User's `default_template_id` points to a deleted or non-existent template | `resolveTemplate()` falls back to `'builtin-general'`. No error surfaced. |
| `template_id` sent in enhance request is invalid/malformed | `resolveTemplate()` falls back to `'builtin-general'`. Log a warning via Sentry breadcrumb. |
| User tries to PATCH/DELETE a built-in template | 403 Forbidden with clear error code. |
| User tries to create a template with duplicate name | Allowed — no uniqueness constraint on name. Users can have multiple templates with the same name; they're distinguished by UUID. |
| User tries to create a template with an empty prompt | 400 from Zod validation (min 20 chars). |
| New user with no `user_preferences` row | Treated as if default = `'builtin-general'`. Upserting on first PATCH creates the row. |
| User on a meeting where the selected custom template was deleted mid-generation | `resolveTemplate()` falls back during the server call. Result reflects general template. |

## Testing

- **Unit tests** (`lib/__tests__/`): `resolveTemplate()` covers all fallback paths, built-in and custom resolution, invalid IDs
- **Unit tests for picker hook** (`hooks/__tests__/use-templates.test.tsx`): CRUD mutations, optimistic updates, error revert
- **Component tests** (`components/templates/`): list renders built-ins + custom, star toggle calls setDefault, delete confirmation flow, editor form validation (name too long, prompt too short, etc.)
- **API route tests**: each route tests auth, validation, RLS-scoped ownership, 403 on built-in mutation attempts, default-reset on delete
- **Integration test**: enhance route with `template_id` body field uses the correct template in the LLM prompt (assert `generateCall.prompt` contains the template name and instructions)

All tests use `bun:test` and follow the project's existing test patterns.

## Files touched

**New:**
- `scripts/011_revive_note_templates.sql`
- `app/dashboard/templates/page.tsx` (list view)
- `app/dashboard/templates/new/page.tsx` (create editor)
- `app/dashboard/templates/[id]/page.tsx` (edit editor)
- `app/api/templates/route.ts` (GET, POST)
- `app/api/templates/[id]/route.ts` (PATCH, DELETE)
- `app/api/user-preferences/route.ts` (PATCH)
- `components/templates/templates-list.tsx`
- `components/templates/template-editor-form.tsx`
- `components/templates/template-picker.tsx` (the dropdown on "Create notes")
- `hooks/use-templates.ts`
- `lib/templates/template-schemas.ts` (Zod schemas)

**Modified:**
- `lib/note-template.ts` — expand `DEFAULT_NOTE_TEMPLATE` to `BUILTIN_TEMPLATES` map, add `resolveTemplate()`, add full built-in prompts
- `app/api/meetings/[id]/enhance/route.ts` — accept `template_id` in body, resolve via `resolveTemplate()`
- `lib/notes/enhance-validation.ts` — add `template_id` to request body schema
- `components/meeting-note-surface.tsx` (or wherever the "Create notes" CTA lives) — integrate `TemplatePicker`
- Sidebar nav component — add "Templates" link

**Unchanged (prompt plumbing already wired):**
- `lib/notes/prompts.ts` — already accepts `ResolvedNoteTemplate`
- `lib/notes/notes-generation.ts` — already accepts template

## Rollout

One migration, one feature flag-free release. No backwards compatibility concerns — the schema change is additive (two new tables, no modifications to existing ones). Existing meetings keep working unchanged because the enhance route's fallback chain (`template_id ?? user_prefs ?? 'builtin-general'`) handles pre-templates users gracefully.

**Sequence:**
1. Deploy migration
2. Deploy app with feature live
3. New nav item appears, picker appears on meeting page

No rollback plan needed beyond reverting the migration (`drop table note_templates; drop table user_preferences;`) and the feature's UI code.

## Out of scope — explicitly deferred to v2+

- Shared team templates (requires org/team model)
- Template marketplace / public templates
- Dynamic output schema per template (would let interviews produce `pain_points[]` as a top-level field)
- Template analytics (which template is most used, which produces the best notes)
- Import/export templates as JSON
- Template versioning / history
- Rich prompt editor with tokens, variables, or placeholders

## Success criteria

- User can go to `/dashboard/templates`, see 5 built-ins, star one as default
- User can create a custom template, edit it, delete it
- User can pick a template when clicking "Create notes" and the generated output reflects that template's structure and tone
- Changing the default template immediately affects the next generation (no per-meeting sticky state)
- No regression in generation quality on the default `General` template versus today's behavior
