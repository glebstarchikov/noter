# Noter Phase 2 — Workspace Tokens + Deletions + Component Retune

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the Workspace design language as the app's new visual foundation. Overhaul `styles/globals.css` with sage-based tokens, Inter-only typography scale, rounded-xl radii, and warm tinted surfaces. Delete the templates feature (the last planned deletion). Retune `components/ui/*` to reflect the seven signature component moves so every downstream screen inherits the new language without per-file rework. Sweep non-UI code for token consistency.

**Architecture:** Four sequential tasks, each its own commit (with sub-commits where scope justifies). After Phase 2, the app will be visually transformed — but per-screen polish (landing redesign, dashboard layout, meeting detail treatment, auth look) is explicitly deferred to **Phase 3**. This phase installs the language; Phase 3 applies it everywhere it needs deliberate art direction.

**Tech Stack:** Same as Phase 1.5 — Next.js 16 with webpack dev, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, Bun test runner.

**Reference documents:**
- [docs/superpowers/specs/2026-04-15-noter-workspace-redesign.md](../specs/2026-04-15-noter-workspace-redesign.md) §1 (Visual Foundation), §2 (Seven Signature Component Moves), §4.1 (Templates deletion)
- [CLAUDE.md](../../../CLAUDE.md) §Design Rules — Workspace Language (reflects the target state; Phase 2 makes the rules true)

**Branch:** Continue on `refactor/making-the-app-even-better`. Each task = 1 commit (or a small ordered chain).

**Quality gates after every task:**
```bash
bun run typecheck
bun run lint
bun test
```

Plus manual browser verification via `agent-browser` after each visual task — screenshots captured at `/tmp/noter-phase2-verify/` for before/after review.

**Explicitly out of scope:**
- **Chat route consolidation** — carried forward from Phase 1.5 per standing instruction
- **Per-screen redesigns** — landing, dashboard, meeting detail, auth → Phase 3
- **Dark mode** — tokens must leave room but v1 is light-only
- **OSS shipping prep** (LICENSE, README rewrite, docs/, CI verify) → Phase 4
- **`enhance-persist.ts` returns `NextResponse` from lib/** → Phase 3 (error boundary audit opens HTTP layer)
- **`lib/meetings/meeting-pipeline.ts` `'use client'` pragma** — tracked; small enough to fold into Task 4 sweep if comfortable
- **`notes-generation.ts` SDK migration** (chat.completions → generateObject) → post-Phase-4 cleanup
- **628-LOC `meeting-note-surface.tsx` split** → Phase 3

---

## Test count expectations

Phase 2 is mostly CSS + component variant retuning — not much new test surface. Expectation:
- Task 1 (tokens): 290 → 290 (no new tests; a visual change doesn't break unit tests unless a snapshot did)
- Task 2 (templates delete): 290 → ~285 (delete ~5 tests for note-templates routes)
- Task 3 (component retune): ~285 → ~285 (component unit tests if any may need snapshot updates; no new tests)
- Task 4 (sweep): ~285 → ~285 (no test change)

If a component test breaks because its snapshot hardcoded old tokens, update the snapshot — that's expected in a token overhaul.

---

## File Structure (target state after Phase 2)

```
styles/
└── globals.css              # OVERHAULED: Workspace tokens — sage accent, warm surfaces, rounded-xl

app/
├── dashboard/
│   ├── templates/           # DELETED (task 2)
│   └── [id]/ … (unchanged visually — Phase 3 polish)

app/api/
├── note-templates/          # DELETED (task 2, routes + tests)

components/ui/               # RETUNED (task 3)
├── button.tsx               # reduced to primary/ghost/destructive variants
├── card.tsx                 # tinted bg-card, no shadow by default
├── input.tsx                # rounded-xl
├── textarea.tsx             # rounded-xl
├── dialog.tsx               # rounded-xl, shadow-md only when floating
├── popover.tsx              # rounded-xl, shadow-md
├── dropdown-menu.tsx        # rounded-xl, shadow-md
├── tooltip.tsx              # rounded-xl on the panel
├── badge.tsx                # keep — deprecated for meeting status but remains for other uses
├── status-dot.tsx           # NEW: canonical status-dot component with sage ring
├── tabs.tsx                 # underline style (not pills)
└── … (remaining files: rounded-md → rounded-xl pass)

components/
├── note-block.tsx           # UPDATED: left-stripe utility class for AI content
├── page-shell.tsx           # UPDATED: use new tokens
└── … (non-UI components: sweep for rounded-md + hardcoded colors)

scripts/
└── 010_drop_note_templates.sql  # NEW: drop note_templates table
```

---

## Task 1: Install Workspace tokens in `styles/globals.css`

**Why first:** Every component in Tasks 3 and 4 resolves to these tokens. Installing them first means subsequent work happens against the final values, not a moving target.

**What changes:** Every CSS variable in the `:root` block gets new values. Structure stays the same (so dark mode can be added later without a schema change), but the light-mode values shift from "shadcn default with rose accent" to "Workspace with sage accent."

**What does NOT change:**
- The `.dark` selector block — tokens stay as-is (dark mode is deferred; if it renders, it renders as the old rose/gray theme, which is acceptable since we're shipping light-only)
- Tailwind config — Tailwind v4 CSS-first config stays
- The `@custom-variant dark` directive
- Enhance-specific tokens (`--enhance-insert-*`, `--enhance-delete-*`, etc.) — these stay because they're functional semantics, not brand colors

**Files:**
- Modify: `styles/globals.css` (major overhaul of `:root` block + supporting utility classes)
- Potentially: `app/globals.css` (imports from styles/) — unchanged, just re-exports

### Target `:root` block values (hex shown for readability; convert to oklch in the file)

| Token | New value (hex equiv) | oklch approx | Intent |
|---|---|---|---|
| `--background` | `#f9f8f5` | `oklch(0.97 0.004 85)` | Base surface |
| `--foreground` | `#1a1917` | `oklch(0.18 0.004 85)` | Primary text |
| `--card` | `#f1efe8` | `oklch(0.94 0.007 85)` | **Tinted card surface** — never white |
| `--card-foreground` | `#1a1917` | same as foreground |
| `--popover` | `#f9f8f5` | same as background | Floating surfaces keep base surface |
| `--popover-foreground` | `#1a1917` | same as foreground |
| `--primary` | `#1a1917` | same as foreground | Primary button fill |
| `--primary-foreground` | `#f9f8f5` | `oklch(0.97 0.004 85)` | Text on primary |
| `--secondary` | `#f1efe8` | same as card | Deprecate, but keep for shadcn internals |
| `--secondary-foreground` | `#1a1917` |  |
| `--muted` | `#eceae1` | `oklch(0.91 0.006 85)` | Hairline muted surface |
| `--muted-foreground` | `#6b685e` | `oklch(0.49 0.006 85)` | Meta text, captions |
| `--accent` | `#5a9a6d` | `oklch(0.61 0.10 145)` | **Sage — the brand accent** |
| `--accent-foreground` | `#f9f8f5` |  | Text on accent |
| `--accent-soft` | `oklch(0.61 0.10 145 / 0.14)` |  | **NEW** — chip bg, hover tint |
| `--accent-ring` | `oklch(0.61 0.10 145 / 0.18)` |  | **NEW** — soft ring around status dots |
| `--destructive` | `#c5694a` | `oklch(0.59 0.15 40)` | Terracotta — **errors only** |
| `--destructive-foreground` | `#f9f8f5` |  |  |
| `--border` | `#e8e5dc` | `oklch(0.91 0.005 85)` | Hairline borders |
| `--input` | `#e8e5dc` | same as border |  |
| `--ring` | `#5a9a6d` | same as accent | Focus ring color |
| `--radius` | `0.875rem` (14px) | — | **`rounded-xl` default; was 12px** |
| `--sidebar` | `#f1efe8` | same as card | Tinted, matches card |
| `--sidebar-foreground` | `#1a1917` |  |  |
| `--sidebar-primary` | `#1a1917` |  |  |
| `--sidebar-primary-foreground` | `#f9f8f5` |  |  |
| `--sidebar-accent` | `#eceae1` | same as muted |  |
| `--sidebar-accent-foreground` | `#1a1917` |  |  |
| `--sidebar-border` | `#e8e5dc` | same as border |  |
| `--sidebar-ring` | `#5a9a6d` | same as accent |  |

**Assistant-glass tokens** (the floating chat pill surfaces): keep structure, but retint base from pure white to warm #f9f8f5 equivalent:
- `--assistant-glass`: `oklch(0.97 0.004 85 / 0.72)`
- `--assistant-glass-strong`: `oklch(0.97 0.004 85 / 0.82)`
- `--assistant-glass-soft`: `oklch(0.94 0.007 85 / 0.58)` (matches card tint)
- `--assistant-glass-border`: `oklch(0.84 0.006 85 / 0.6)`
- `--assistant-glass-shadow`: `0 32px 70px -40px oklch(0.18 0.004 85 / 0.32)` (same but warmer base)
- `--assistant-glass-inset`: unchanged

**Keep unchanged:**
- `--recording`, `--recording-soft` — functional/status-specific semantics
- `--enhance-insert-*`, `--enhance-delete-*`, `--enhance-replace-*` — diff visualization, not brand
- `--chart-1` through `--chart-5` — no charts currently in use; can update later

### Typography rules (new CSS)

Add a utility layer after `:root`:

```css
/* Workspace typography utilities */
@layer base {
  body {
    font-family: 'Inter', system-ui, sans-serif;
    /* font-feature-settings for tabular nums opt-in per-element */
  }
}

@layer utilities {
  /* Tabular numerals on timestamps / durations / counts */
  .tabular-nums { font-variant-numeric: tabular-nums; }

  /* Uppercase meta labels — section headings, status rows */
  .meta-label {
    font-size: 11px;
    line-height: 1;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  /* Left-stripe note block — AI-generated content marker */
  .note-block-ai {
    box-shadow: inset 3px 0 0 var(--accent);
  }
}
```

### Focus ring

Replace the default shadcn focus ring (`outline-2 outline-ring outline-offset-2`) with a sage 2px ring + 2px offset. This lives in individual components in Task 3, but the token `--ring` is set here so it flows through.

### Step 1.1: Read current `styles/globals.css` end-to-end

Understand what's there now — variables, `@layer` blocks, custom utilities, imports. Take note of any token you're about to change that's referenced in unexpected places (e.g., by a `.scrollbar-thin` utility or similar).

### Step 1.2: Overhaul the `:root` block

Apply the table above. Each `--token: value;` gets a new value. Preserve exact variable names (lowercase kebab-case, `--*` prefix).

### Step 1.3: Add the three new utilities (`.tabular-nums`, `.meta-label`, `.note-block-ai`)

Place them in an `@layer utilities` block after the root. If a `.tabular-nums` already exists, preserve it (Tailwind v4 might ship one).

### Step 1.4: Leave `.dark` block untouched

For Phase 2, we're not updating dark mode tokens. This is an intentional choice per the spec (dark mode is Phase 2+N). If the user toggles dark mode they'll see the old rose/black theme, which is acceptable for a light-only v1.

### Step 1.5: Quality gate

```bash
bun run typecheck && bun run lint && bun test
```

All green. Test count unchanged.

**No tests exercise the color values** (unit tests don't run against rendered CSS). The visual change surfaces only in the browser. Any test that breaks is a regression signal worth investigating.

### Step 1.6: Browser verification

```bash
# Dev server should be running. If not, start it.
agent-browser open http://localhost:3000
agent-browser screenshot /tmp/noter-phase2-verify/01-landing-after-tokens.png
# Navigate to dashboard if auth session is available
# Note: the app may look slightly broken (wrong rounded values on components) until Task 3 — that's expected
```

The landing page should load without errors; colors should shift (warmer bg, sage accents where applicable). Components may still look "old" because Task 3 hasn't run yet — that's the correct intermediate state.

### Step 1.7: Commit

```bash
git add styles/globals.css
git commit -m "feat(design): install Workspace design tokens (sage accent, warm surfaces, rounded-xl default)"
```

---

## Task 2: Delete the templates feature

**Why:** The templates feature was flagged in the static audit (Phase 1.5 pre-work) as user-unused slop with its own page + API + DB table. Per the user's scoping decision, it's being deleted.

**Scope:**
- Delete `app/dashboard/templates/` (the page)
- Delete `app/api/note-templates/` (both routes + tests)
- Delete `lib/note-template.ts` if it only exports template-resolving helpers for the deleted routes. Check callers first — `resolveMeetingTemplate` IS used by the enhance route for prompt context, so the function might need to stay but be simplified to pass a default.
- Delete the template picker UI from `/dashboard/new` (component; grep for usages)
- Delete the "Templates" navigation entry from the sidebar
- **Drop `meetings.template_id` column** via migration (user decision: drop, not keep nullable)
- Remove all `template_id` references from the note-generation + enhance flows
- Add migration `scripts/010_drop_note_templates.sql` (drops table + column)
- Update `CLAUDE.md` to reflect the deletion

**Files:**
- Delete: `app/dashboard/templates/` (entire directory, page + related)
- Delete: `app/api/note-templates/` (entire directory, routes + tests)
- Delete: `scripts/008_create_note_templates_table.sql` (NO — append-only rule means we don't edit or delete old migrations; we only add a new one that drops)
- Create: `scripts/010_drop_note_templates.sql`
- Modify: `lib/note-template.ts` (simplify or verify it still exports what's needed by enhance + generate-notes)
- Modify: `components/app-sidebar.tsx` (remove Templates link)
- Modify: `app/dashboard/new/page.tsx` (remove template picker if present)
- Modify: any other consumer that linked to the templates page
- Modify: `CLAUDE.md` (database section notes migration 010)

### Step 2.1: Inventory references

```bash
rg "note-templates|note_templates|NoteTemplate|template_id|/dashboard/templates|resolveMeetingTemplate" app components hooks lib --type ts --type tsx
```

Categorize hits:
- **Deletable**: UI links to /dashboard/templates, imports from the deleted routes, the template picker component
- **Keep-but-simplify**: `resolveMeetingTemplate` (if still used by enhance-validation to provide a default prompt template) — make it return a hardcoded default instead of querying the DB
- **Database references**: the `template_id` column on `meetings` table — decide: keep the column nullable (leave historical data intact, don't require migration) or drop it (additional migration)

### Step 2.2: Determine `resolveMeetingTemplate` fate

Read `lib/note-template.ts`. It likely does:
1. Look up a template by `template_id` from the `note_templates` table
2. Return a default template if `template_id` is null or the row doesn't exist
3. Return a `ResolvedNoteTemplate` object with `name`, `prompt`, etc. for use in `buildNotesGenerationPrompt` / `buildDraftProposalPrompt`

After templates deletion, the simplification is:
- Drop the DB lookup entirely
- Return a hardcoded default `ResolvedNoteTemplate` with whatever the current "default" template looks like
- Keep the function signature so callers don't need to change

Alternatively, if inlining the default is simple enough, replace the function with a constant export `DEFAULT_NOTE_TEMPLATE: ResolvedNoteTemplate` and have callers use that directly.

Pick whichever is cleaner. Justify in the commit message.

### Step 2.3: Delete routes + page

```bash
git rm -r app/dashboard/templates
git rm -r app/api/note-templates
```

### Step 2.4: Update sidebar / nav

In `components/app-sidebar.tsx`, remove the "Templates" link entry. Verify no other navigation references `/dashboard/templates`.

### Step 2.5: Update `/dashboard/new`

Read `app/dashboard/new/page.tsx`. If it has a template picker, remove it. The simpler flow is: "Start a new meeting" → title field (optional) → Start Recording button.

### Step 2.6: Add migration

Create `scripts/010_drop_note_templates.sql`:

```sql
-- Phase 2 Task 2: drop templates feature entirely
-- The templates feature was removed in Phase 2 (per the Workspace redesign spec §4.1).
-- User decision: drop both the table AND the meetings.template_id column (no historical data to preserve).

drop table if exists public.note_templates cascade;

-- Also drop the foreign key column from meetings — no longer referenced by any code.
alter table public.meetings drop column if exists template_id;
```

### Step 2.7: Update `CLAUDE.md`

In the Database section, note migration 010. No other doc changes required.

### Step 2.8: Quality gate

```bash
bun run typecheck && bun run lint && bun test
```

All green. Test count drops by however many `/api/note-templates/*` tests existed (expect ~5 based on prior audit). Report the delta.

### Step 2.9: Browser verification

```bash
agent-browser open http://localhost:3000/dashboard
agent-browser snapshot
# Confirm: no "Templates" link in the sidebar
# Confirm: /dashboard/templates returns 404 (try visiting directly)
agent-browser open http://localhost:3000/dashboard/templates
# Should render a 404 page (Next.js default not-found)
```

### Step 2.10: Commit

```bash
git add app lib components scripts CLAUDE.md
git commit -m "refactor: delete unused templates feature (page + routes + table)"
```

---

## Task 3: Retune `components/ui/*` with the seven signature component moves

**Why:** This is where the design language becomes visible. Every screen inherits these component primitives; retuning them propagates the Workspace look without per-screen rework in Phase 3.

**The seven moves (per spec §2):**

1. **Tinted cards** (never white-on-white): `Card` defaults to `bg-card` (the new `#f1efe8`), no shadow, no border unless elevated.
2. **Left-stripe note blocks**: a utility class `.note-block-ai` (added in Task 1) + a `<NoteBlock>` component or Tiptap node decoration for AI content.
3. **Status dots with soft ring**: a new `<StatusDot>` component that replaces `Badge` usage for meeting status.
4. **Uppercase small-caps meta labels**: `.meta-label` utility class (added in Task 1), applied at consumer sites.
5. **Button hierarchy** — 3 variants only: `primary` (filled), `ghost` (transparent, hover tint), `destructive` (rare). Remove `outline`, `secondary`, `link` variants.
6. **Ghost-icon toolbar buttons**: 32px square, `rounded-lg`, hover tint `bg-accent-soft`.
7. **Rounded-xl everywhere**: `rounded-md` banned except tiny elements. Global grep-and-replace + audit.

### Sub-task 3.1: `components/ui/card.tsx` — tinted surface, no default shadow

Current state likely: `bg-card` (which was `#ffffff`, now `#f1efe8`), `border`, `rounded-xl` or `rounded-lg`, maybe `shadow-sm` default.

Changes:
- Confirm `bg-card` resolves to the new value (Task 1 already did this via the token)
- Remove any `shadow-*` from the base variant
- Apply `rounded-xl` explicitly (don't rely on `--radius` — bake it into the class)
- Remove `border` from the default variant — differentiation via color tint, not border
- Add an `elevated` prop or class variant that opts INTO `shadow-md` for floating surfaces (keep usage rare)

Test surface: `bun test components/ui/card.test.tsx` if exists; otherwise visual verification via browser.

### Sub-task 3.2: `components/ui/button.tsx` — three variants only

Current state: shadcn default has `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` variants.

Changes:
- Rename `default` → `primary` (or keep `default` if breaking too many callers)
- Keep `destructive`
- Keep `ghost` (transparent, hover adds `bg-accent-soft`)
- **Delete** `outline`, `secondary`, `link` variants from the `cva` definition
- **Migrate every call site** that used a deleted variant to the closest survivor (outline → ghost, secondary → ghost, link → ghost)

Migration scan:
```bash
rg "variant=\"(outline|secondary|link)\"" app components --type tsx
rg "variant: '(outline|secondary|link)'" app components --type tsx
```

Each hit gets switched to `ghost`. Commit this alongside the button.tsx change so the typecheck stays green within the commit.

### Sub-task 3.3: `components/ui/status-dot.tsx` — NEW component

Create a canonical component:

```tsx
// components/ui/status-dot.tsx
import { cn } from '@/lib/utils'

interface StatusDotProps {
  /** The logical status. Maps to a color + label internally. */
  status: 'recording' | 'generating' | 'done' | 'error' | 'neutral'
  /** Optional label shown next to the dot. */
  label?: string
  className?: string
}

const STATUS_STYLES: Record<StatusDotProps['status'], string> = {
  recording: 'bg-[oklch(0.66_0.11_24)] ring-[oklch(0.66_0.11_24/0.18)]',
  generating: 'bg-accent ring-accent-ring',
  done: 'bg-accent ring-accent-ring',
  error: 'bg-destructive ring-[oklch(0.59_0.15_40/0.18)]',
  neutral: 'bg-muted-foreground ring-[oklch(0.49_0.006_85/0.12)]',
}

export function StatusDot({ status, label, className }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <span
        aria-hidden
        className={cn(
          'inline-block size-2 rounded-full ring-[3px]',
          STATUS_STYLES[status],
        )}
      />
      {label && <span>{label}</span>}
    </span>
  )
}
```

Then sweep existing uses of `<Badge>` for status-like scenarios and replace with `<StatusDot>`. Grep:

```bash
rg "<Badge" components app --type tsx | grep -i "status\|recording\|processing\|error"
```

### Sub-task 3.4: `components/ui/tabs.tsx` — underline style

Per the spec and CLAUDE.md, tabs use underlines, not pills. Retune the `TabsTrigger` styling so the active tab has a bottom border in `--accent` (sage) and inactive tabs have muted text, no background.

### Sub-task 3.5: Dialog / Popover / DropdownMenu / Tooltip — `rounded-xl` + `shadow-md`

These are floating surfaces. They keep shadow (allowed in the rules). Change radius to `rounded-xl`, ensure background is `bg-popover` (the new warm tint), and the shadow stays as `shadow-md` with the existing color (inherited from tokens).

### Sub-task 3.6: Input / Textarea — `rounded-xl`

Straightforward: replace `rounded-md` with `rounded-xl` in the base classes. Verify focus ring uses `--ring` (now sage).

### Sub-task 3.7: Global `rounded-md` → `rounded-xl` sweep in `components/ui/`

After the specific component retunes above, do a final pass:

```bash
rg "rounded-md" components/ui --type tsx
```

For each remaining hit:
- If the element is a card, input, dialog, or "major" surface, change to `rounded-xl`
- If the element is tiny (e.g., a color swatch, a 12px chip), change to `rounded-lg` or leave as-is if `rounded-md` is appropriate for that specific element
- Document any remaining `rounded-md` usages in the commit message so reviewer knows they were considered

### Sub-task 3.8: Quality gate

```bash
bun run typecheck && bun run lint && bun test
```

All green. If a `cva` variant-type change broke call sites (removed variants), fix each at its consumer. Tests may need snapshot updates — if so, carefully review each updated snapshot to confirm the change is desired (new rounded corners, new colors), not a regression (content flip, missing elements).

### Sub-task 3.9: Browser verification

```bash
agent-browser open http://localhost:3000/dashboard
agent-browser screenshot /tmp/noter-phase2-verify/03-dashboard-after-retune.png
# Log in if needed, navigate to an existing meeting
agent-browser screenshot /tmp/noter-phase2-verify/03-meeting-after-retune.png
```

The app should look meaningfully different now — sage accents, warm tinted cards, rounded-xl everywhere, simpler button set.

### Sub-task 3.10: Commit

This task may land as 2-3 related commits if the sub-tasks are large. A reasonable grouping:

- Commit 1: `refactor(ui): retune Card, Button, Tabs — tinted surfaces, 3 button variants, underline tabs`
- Commit 2: `feat(ui): add StatusDot component with sage soft-ring`
- Commit 3: `refactor(ui): rounded-xl sweep across ui/ components`

Or one commit if the diff stays manageable:

- `refactor(ui): apply seven Workspace signature component moves`

Pick based on how much changes — if total diff is >300 LOC or touches >10 files, split.

---

## Task 4: Sweep non-UI code for token consistency

**Why:** The token installation (Task 1) automatically updates any component that used Tailwind's semantic classes (`bg-background`, `text-foreground`, etc.). But there are three sources of inconsistency to sweep:

1. **Hardcoded colors** — any `bg-white`, `text-black`, `bg-[#xxxxxx]` not going through tokens
2. **Leftover `rounded-md`** outside `components/ui/`
3. **Leftover old-variant button usages** — these should have been caught in Task 3, but worth a final pass

**Files:** All under `components/` (not ui/), `app/`, `hooks/` if any styling lives there.

### Step 4.1: Grep for hardcoded colors

```bash
rg "bg-white|bg-black|text-white|text-black|bg-gray-|text-gray-|bg-\[#|text-\[#|border-\[#" \
   components app hooks --type tsx --type ts --glob '!components/ui/*'
```

For each hit:
- If it's a hardcoded brand color (rare), check the spec — does it have a semantic token now?
- If it's `bg-white` used for contrast (e.g., a light surface on top of the tinted card), keep but add a comment explaining why token wasn't used
- If it's a gray from Tailwind's default palette (`bg-gray-100`, `text-gray-500`), switch to the appropriate token (`bg-muted`, `text-muted-foreground`)

### Step 4.2: Grep for leftover `rounded-md`

```bash
rg "rounded-md" components app --type tsx --glob '!components/ui/*'
```

Same decision tree as Task 3 sub-task 3.7 — change to `rounded-xl` for major surfaces, keep for genuinely tiny elements.

### Step 4.3: Fix `lib/meetings/meeting-pipeline.ts` `'use client'` pragma

**Small bonus cleanup** — the file has a `'use client'` directive but exports `readApiError` which is imported by server routes. Either:

- Remove the `'use client'` directive (the functions are pure utilities, no DOM / React)
- Or split the file: extract `readApiError` to `lib/api/fetch-helpers.ts` (no `'use client'`) and leave the client-only helpers in `meeting-pipeline.ts`

Pick the simpler option based on what else is in the file. If there's nothing genuinely client-specific, just remove the pragma.

### Step 4.4: Quality gate

```bash
bun run typecheck && bun run lint && bun test
```

All green.

### Step 4.5: Browser sweep

```bash
agent-browser open http://localhost:3000
agent-browser screenshot /tmp/noter-phase2-verify/04-final-landing.png
# Log in, navigate around
agent-browser screenshot /tmp/noter-phase2-verify/04-final-dashboard.png
agent-browser screenshot /tmp/noter-phase2-verify/04-final-meeting.png
```

Compare against Phase 1.5 screenshots — the app should be visually transformed without any layout breakage.

### Step 4.6: Commit

```bash
git add -u components app lib
git commit -m "refactor(ui): sweep non-ui code for Workspace token consistency"
```

---

## Phase 2 completion checklist

After Task 4 commits:

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun test` passes (~285 tests, accounting for template test removal)
- [ ] `rg "rounded-md" components app --type tsx` returns only documented exceptions (tiny elements)
- [ ] `rg "bg-white|text-black|bg-\[#" components app --type tsx --glob '!components/ui/*'` returns zero hits OR only commented/justified cases
- [ ] Sidebar no longer shows "Templates"; `/dashboard/templates` returns 404
- [ ] Meeting detail page renders with warm tinted cards, sage accent, rounded-xl everywhere
- [ ] Buttons use only primary/ghost/destructive variants across the app
- [ ] Focus ring is 2px sage with 2px offset
- [ ] User has manually verified the full recording → notes → enhance flow works visually

When all checks pass, Phase 2 is done. Phase 3 (screen redesigns) can begin.

---

## Rollback plan

Each task is a single commit (Task 3 may be 2-3 related commits). Revert per task with `git revert <sha>`. Task 2 deletes a DB table; rollback means the table stays dropped in the dev database. If that's a concern, stash a schema dump of `note_templates` before running migration 010.

Tasks 1, 3, 4 are in-code-only and trivially reversible.

---

## Decisions (locked 2026-04-16)

1. **Button variant rename**: **`primary`** — rename `default` to `primary` for cleaner semantics. Update all call sites.
2. **`template_id` column fate**: **drop the column** via migration 010 alongside the table drop. No historical data to preserve.
3. **StatusDot adoption scope**: **meeting status only** in Task 3. Broader `<Badge>` audit is Phase 3 per-screen polish.

---

## Out of scope (explicit, for Phase 3 or later)

- **Landing page redesign** — Phase 3
- **Dashboard layout overhaul** — Phase 3
- **Meeting detail screen redesign** (628 LOC split, tab system retune, BubbleMenu art direction) — Phase 3
- **Auth page polish** — Phase 3
- **Dark mode** — deferred (tokens leave structural room)
- **OSS prep** (LICENSE, README, docs/, CI verify) — Phase 4
- **Chat route consolidation** — deferred per standing instruction
- **`enhance-persist.ts` HTTP-response leak** — Phase 3 (error boundary audit)
- **`notes-generation.ts` SDK migration** — post-Phase-4 cleanup
- **Startup env validation** — Phase 4 OSS prep
