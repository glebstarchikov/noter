# Noter Workspace Redesign — Design Spec

- **Date**: 2026-04-15
- **Owner**: Gleb (solo, AI Society)
- **Status**: Approved, ready for implementation plan
- **Target**: v1.0 public open-source release

## Summary

Rework Noter's visual identity from "generic shadcn default" into a warm, doc-centric design language called **Workspace**, anchored by a sage-green accent and a single-font (Inter) system. The redesign is bundled with targeted feature deletions, bundled-opportunity architecture refactors, and the prep work needed to ship Noter as an open-source project. Dark mode is explicitly deferred. Primary dogfood user is the AI Society student group; v1 must also be palatable to individuals and small orgs.

## Goals

1. Stop looking like a shadcn demo. Every screen should feel like it belongs to Noter, not to shadcn's example gallery.
2. Ship as an open-source project with a self-host story good enough for a non-founder to deploy.
3. Delete the features that aren't earning their place, so maintenance cost drops.
4. Harden the code architecture while already touching every file for visual reasons — bundle the cleanup.
5. Prepare a dogfood-ready build for the AI Society cohort.

## Non-Goals

- **Dark mode.** Explicitly deferred to a follow-up. Token system must not preclude it, but v1 is light only.
- **Org / multi-tenant features.** No workspaces, teams, roles, invites in v1. Single-user is fine for AI Society dogfood.
- **New user-facing features.** No net-new capabilities beyond what currently exists. This release is "polish + cut + ship".
- **Mobile redesign.** Responsive sanity only. No mobile-first work.
- **Marketing site.** The landing page at `/` is the only marketing surface.

---

## 1. Visual Foundation

### 1.1 Color tokens (light mode only)

Declared as CSS variables in `app/globals.css`. Keep the existing `oklch()` token contract, redefine the values.

| Token | Value | Usage |
|---|---|---|
| `--background` | `#f9f8f5` | App surface |
| `--card` | `#f1efe8` | Tinted card surface (never white) |
| `--foreground` | `#1a1917` | Primary text |
| `--muted-foreground` | `#6b685e` | Meta, captions, labels |
| `--border` | `#e8e5dc` | Hairline borders, dividers |
| `--primary` | `#1a1917` | Primary buttons, link hover |
| `--primary-foreground` | `#f9f8f5` | Text on primary |
| `--accent` | `#5a9a6d` | Sage — the one color Noter owns |
| `--accent-foreground` | `#f9f8f5` | Text on accent |
| `--accent-soft` | `rgba(90,154,109,0.14)` | Chip backgrounds, hover tints |
| `--accent-ring` | `rgba(90,154,109,0.18)` | Soft ring around status dots |
| `--destructive` | `#c5694a` | **Errors only** — terracotta, reserved exclusively for destructive states. Must never be used as a general accent. |
| `--ring` | `#5a9a6d` | Focus ring color |

Values must be expressed as `oklch()` in the actual file; above shown as hex for readability. Alpha values (`--accent-soft`, `--accent-ring`) use `oklch(... / <alpha>)` form, not `rgba()`.

### 1.2 Typography

- **Family**: Inter only. Already bundled. No new font loads.
- **Weights in use**: 400 (body), 500 (meta), 550 (buttons), 650 (titles/headings).
- **Tabular-nums**: default on for all timestamps, durations, counts, status numbers.
- **Scale**:
  - `text-[11px]` with uppercase + `tracking-wider` — section labels, meta
  - `text-xs` (12px) — captions, chip text
  - `text-sm` (13px) — body text, button labels
  - `text-base` (16px) — meeting content
  - `text-[21px]` font-weight 650 — card titles
  - `text-[28px]` font-weight 650 — page headers
  - `text-[40px]+` font-weight 700 — landing hero

### 1.3 Radii

- `rounded-xl` (14px) is the default for cards, note blocks, dialogs, popovers, inputs
- `rounded-lg` (10px) — chips, secondary buttons, tabs
- `rounded-md` (6px) — **banned except on tiny elements** (e.g., color swatches in settings)
- `rounded-full` — avatars, status dots, ring-bearing indicators only

### 1.4 Shadows

- No shadcn-default `shadow-sm` / `shadow` on cards. Cards use the tinted `--card` background for differentiation, not elevation.
- `shadow-md` — allowed on **floating** surfaces only: `BubbleMenu`, popovers, dropdown menus, toasts.
- Shadow values retuned to use a warm neutral base rather than neutral black: `0 12px 24px -16px rgba(74, 51, 24, 0.12)`.

### 1.5 Focus ring

- 2px sage ring + 2px offset in `--background` color.
- Replaces shadcn's default `ring-ring ring-offset-background ring-offset-2`.

---

## 2. The Seven Signature Component Moves

These are the specific, codified details that make Noter stop looking shadcn-stock. Each one is a lint-level rule — deviations require justification in PR review.

### 2.1 Tinted cards (never white-on-white)

Replace shadcn `Card` default (white + subtle border + subtle shadow) with warm-tinted `bg-card` and no border/shadow unless floating.

```tsx
// Before
<div className="bg-background border rounded-md shadow-sm p-4">

// After
<div className="bg-card rounded-xl p-4">
```

### 2.2 Left-stripe note blocks

AI-generated content blocks get a 3px sage left stripe:

```css
.note-block { box-shadow: inset 3px 0 0 var(--accent); }
```

Used on: enhancement output, AI suggestions, summary blocks, action items. **Not** used on user-authored content.

### 2.3 Status dots with soft ring

Replace `Badge` component for meeting status. A dot is 8px, round, with a 3px soft ring in `--accent-ring`.

```tsx
<span className="inline-block size-2 rounded-full bg-accent ring-[3px] ring-accent-ring" />
```

For non-sage states: `ring-muted`, `bg-muted-foreground`.

### 2.4 Uppercase small-caps meta labels

Section labels, timestamps (when standalone), state indicators.

```tsx
<span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
  Recording · 14:32
</span>
```

### 2.5 Button hierarchy (three variants, not five)

Reduce shadcn's `default/destructive/outline/secondary/ghost/link` to **three**:

- `primary` — filled `--primary` (`#1a1917`), `rounded-xl`, font-medium
- `ghost` — transparent, hover: `bg-card`, no border
- `destructive` — filled `--destructive`, rare

Delete the `outline` and `secondary` and `link` variants entirely from `components/ui/button.tsx`. If they're used somewhere, replace with `ghost`.

### 2.6 Ghost-icon toolbar buttons

Toolbar icons (BubbleMenu, meeting controls) use the existing `ghost-icon` variant pattern but tightened: 32px square, `rounded-lg`, hover tint uses `--accent-soft`.

### 2.7 Rounded-xl everywhere

Global find-and-replace `rounded-md` → `rounded-xl` in `components/ui/`, then audit each to confirm it looks right. Exceptions (tiny elements that break at 14px radius) get `rounded-lg`, not `rounded-md`.

---

## 3. Screens Being Redesigned

### 3.1 `/` (Landing page)

**Goal**: Convert the landing from "app marketing" to "open-source project README on a page". Target audience: developers + student society leaders who might self-host.

**Required elements**:
- Hero: Noter logo + one-line pitch + two CTAs ("Try the hosted demo" / "View on GitHub")
- 3 value props: real-time transcription · AI notes · self-hosted
- Live mockup / screenshot of the meeting detail (taken after redesign ships)
- "How it works" — 3 steps with micro-illustrations or numbered mono labels
- Self-host teaser: "Runs on Vercel + Supabase. 10-minute setup." → link to `/docs/self-host`
- Footer: GitHub link, license badge, "made for AI Society" credit

**Out of scope**: pricing, testimonials, feature comparison table, newsletter signup.

### 3.2 `/auth/*`

**Treatment**: token refresh only. Same content, new tokens, new button treatment, tinted cards for form wrappers. ~1 day of work.

### 3.3 `/dashboard` (meeting list)

**Before**: Generic list of cards.
**After**:
- Tinted card rows with generous padding
- Pinned meetings get a sage dot indicator + sit above the divider
- Meta row: uppercase small-caps for date, duration in tabular-nums, status dot + state label
- Hover state: `bg-card` → slight sage tint
- Empty state: illustration-free, just copy + one CTA. Redesign the current empty state which is clearly a shadcn demo placeholder.
- **Delete**: the Templates nav link (Templates feature is cut, see §4)

### 3.4 `/dashboard/new`

**Before**: Template picker + form.
**After**: Single "start meeting" page with optional title field + start button. Template picker removed (§4). ~100 LOC down to ~30.

### 3.5 `/dashboard/[id]` (meeting detail — THE screen)

**This is the load-bearing redesign.** Highest risk, highest impact.

Tri-state FSM unchanged: `recording → processing → done`. Visual treatment per state:

**Recording state**:
- Header: sage pulsing dot + "RECORDING" label + elapsed time (tabular-nums mono)
- Live transcript area: tinted card, speaker bubbles with subtle background tint differentiation, smooth auto-scroll
- In-meeting chat bar (§4.3): **redesigned and tightened**, anchored at bottom, `rounded-xl` tinted surface, composer + ghost icon send

**Processing state**:
- Tinted card with sage pulsing indicator + "Generating notes..." label
- Show partial progress if available (transcript chunks processed)
- No spinner-centric empty state

**Done state**:
- Header: meeting title (text-[28px] 650-weight), uppercase meta row below (date · duration · state)
- Tabs: underline tabs (per CLAUDE.md rule), NOT pills. Tabs: Notes · Transcript · Actions
- Notes tab: Tiptap editor with `max-w-[720px]`, left-stripe treatment on AI-generated blocks
- Transcript tab: speaker bubbles, jump-to-timestamp, search (if already built)
- Actions tab: action items list with sage checkboxes (`TaskItem`)
- Floating BubbleMenu: `shadow-md`, `rounded-xl`, ghost-icon buttons
- Chat bar: collapses to a single "Ask" button at bottom-right when not in use; expands to the redesigned composer when clicked

---

## 4. Deletions

### 4.1 Templates (hard delete)

**Delete**:
- `app/dashboard/templates/page.tsx`
- `app/api/note-templates/route.ts`
- `app/api/note-templates/[id]/route.ts`
- Any `note_templates` DB table (add migration to drop it)
- Any UI references (sidebar link, template picker on `/dashboard/new`)
- Any `lib/` helpers exclusively for templates

**Migration**: Since nobody's used it, just add `scripts/009_drop_note_templates.sql` that drops the table. No data preservation needed.

### 4.2 Health check route (hard delete)

Delete `app/api/health/route.ts`. Unused, dead.

### 4.3 Chat consolidation (redesign + trim, not delete)

**Current state**:
- `/api/chat/route.ts` (173 LOC)
- `/api/chat/support/route.ts` (81 LOC)
- `/api/chat/global/route.ts` (109 LOC)
- `components/chat-bar.tsx` (464 LOC)
- `components/floating-chat-host.tsx` (107 LOC)
- `lib/chat-storage.ts` + `lib/chat-message-utils.ts` + `lib/chat-ui-helpers.ts` (unclear boundaries)

**Required investigation (first step of implementation)**:
- Which of the 3 chat endpoints is actually wired to the UI?
- What are `/support` and `/global` for — are they distinct user-facing features or dead scaffolding?
- Can they be collapsed to a single endpoint with a `context` discriminator?

**Target state**:
- One `/api/chat/route.ts` endpoint, discriminated by context type
- `components/chat-bar.tsx` split into `ChatComposer` + `ChatTranscript` + `ChatBar` wrapper, target ~250 LOC total
- `lib/chat/` subfolder holding all 3 chat helpers, clear exports
- `floating-chat-host.tsx` kept, retuned to match new tokens

### 4.4 Dead code surfaced during refactor

As the `lib/` reorganization touches every file, delete:
- Unused exports
- Commented-out code blocks (none found in audit, but double-check)
- Unreachable branches
- `Record<string, unknown>` types where a real type exists

---

## 5. Architecture Refactors

Bundled with the redesign because we're already in every file.

### 5.1 Reorganize `lib/` into subdomains

**Before**: 54 files flat in `lib/`.
**After**:
- `lib/chat/` — chat-storage, chat-message-utils, chat-ui-helpers
- `lib/notes/` — draft-proposal, enhancement-context, note-normalization, prompts
- `lib/tiptap/` — tiptap-converter, editor-extensions
- `lib/supabase/` — already exists, unchanged
- `lib/api/` — new: api-helpers, error-response, validation middleware
- `lib/` root — truly cross-cutting only (types.ts, utils.ts)

Use `tsx` codemod or simple find-replace for import path updates.

### 5.2 Extract API validation middleware

Current pattern in all 26 routes:
```ts
const rawBody = await request.json().catch(() => null);
const parsed = schema.safeParse(rawBody);
if (!parsed.success) return errorResponse('Invalid request', 'INVALID_INPUT', 400);
```

Extract to `lib/api/validate.ts`:
```ts
export async function validateBody<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T> | Response> { ... }
```

Route usage becomes one line.

### 5.3 Split monster hooks

**`hooks/use-recording.ts`** (375 LOC) →
- `hooks/use-deepgram-connection.ts` — WebSocket, reconnect, token refresh
- `hooks/use-transcript-state.ts` — transcript chunks, speaker tracking
- `hooks/use-recording.ts` — thin composer of the above + UI state

**`hooks/use-note-enhancement.ts`** (381 LOC) →
- `hooks/use-enhancement-api.ts` — API calls, polling, retries
- `hooks/use-draft-proposal.ts` — proposal state, approve/reject
- `hooks/use-note-enhancement.ts` — thin composer

### 5.4 Split `app/api/meetings/[id]/enhance/route.ts` (513 LOC)

- `lib/notes/enhance-validation.ts` — input validation, conflict detection
- `lib/notes/enhance-llm.ts` — LLM call, retry logic, prompt assembly
- `lib/notes/enhance-persist.ts` — DB updates, normalization
- `route.ts` — thin orchestrator, ~120 LOC

### 5.5 Structured logging (Sentry)

- Route handlers and API helpers must use `Sentry.captureException` / `Sentry.captureMessage` with structured context for errors and significant events.
- Bare `console.info` / `console.error` are not permitted in `app/api/**` or `lib/api/**`. Other server code (workers, scripts) may use `console.*` if there's a clear reason.
- `console.log` is fine in dev-only paths and build scripts.
- Client-side errors already go through Sentry (see recent commit).

### 5.6 Error boundary audit

Every Next.js route segment must have an `error.tsx` at its level or inherit from a parent. Verify:
- `app/error.tsx`
- `app/dashboard/error.tsx`
- `app/dashboard/[id]/error.tsx`
- `app/auth/error/page.tsx` (already exists as a page, distinct thing)

Add missing ones. Each error boundary renders the new design tokens and offers a "retry" + "back home" action.

---

## 6. Open-Source Shipping Prep

### 6.1 License + README

- Add `LICENSE` (MIT)
- Rewrite `README.md`:
  - Hero screenshot (taken after redesign ships, from meeting detail)
  - One-line pitch
  - Feature list with emoji-free icons
  - Quickstart (3 commands)
  - Self-host section linking to `docs/self-host.md`
  - Stack overview (Next.js, Supabase, Deepgram, OpenAI, Tiptap, shadcn)
  - License badge
  - "Built for AI Society" credit with link

### 6.2 Contributing guide

- Add `CONTRIBUTING.md`:
  - Development setup (clone, `bun install`, `.env.local`, `bun dev`)
  - Running tests (`bun test`, `bun run typecheck`, `bun run lint`)
  - Commit style (Conventional Commits)
  - PR checklist
  - Code style (refers to `CLAUDE.md`)

### 6.3 Documentation

Create `docs/` folder with:
- `docs/self-host.md` — step-by-step self-hosting on Vercel + Supabase, 10-minute goal
- `docs/supabase-setup.md` — running `scripts/001–009.sql` in order, enabling RLS, creating policies
- `docs/env-vars.md` — required vs optional env vars, where to get each key
- `docs/architecture.md` — 1-page overview of the stack, data flow, major modules

### 6.4 Env example

Verify `.env.example` contains every required and optional env var documented in `docs/env-vars.md`. No real values.

### 6.5 CI pipeline

Verify GitHub Actions CI runs on PR:
- `bun install`
- `bun run typecheck`
- `bun run lint`
- `bun test`

If missing, add `.github/workflows/ci.yml`.

### 6.6 Launch assets

- 4-6 screenshots of the redesigned app in the Workspace language
- Optional: short screen recording of the record → transcribe → notes flow
- Social preview card (OG image) for the repo
- A pinned "Launch day" issue with AI Society dogfood rollout plan

---

## 7. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Meeting detail redesign breaks tri-state transitions | High | Manual test each state transition before merging; add component tests for state machine |
| `lib/` reorg causes import breakage | Medium | Do it in a single dedicated commit, TypeScript compiler will catch everything |
| Chat endpoint consolidation removes something in use | Medium | Investigation step first; keep removed code in a separate `archive/` branch for 2 weeks |
| Sage accent feels wellness-app at scale | Low | First dogfood round will tell us; can retune saturation without changing tokens |
| Dark mode deferral alienates dev audience | Low-medium | Mention in README that dark mode is "coming soon"; ship it in v1.1 within 2 weeks of v1 |
| Open-source prep gets deprioritized | High | Spec explicitly includes it; PR reviews enforce that launch assets exist before merge |
| Load-bearing hooks (use-recording, use-enhancement) break when split | Medium | Tests first for current behavior before splitting; use TDD discipline |

---

## 8. Acceptance Criteria

v1 ships when:

1. **Visual**
   - [ ] Every page uses Workspace tokens from `globals.css` — zero hardcoded colors
   - [ ] Zero instances of `rounded-md` outside approved exceptions list
   - [ ] Every card uses `bg-card`, no white-on-white surfaces
   - [ ] All 7 signature component moves are in place and lint/review-enforced
   - [ ] Landing, dashboard, meeting detail, auth screens all reviewed visually

2. **Features cut**
   - [ ] `/dashboard/templates` and related API/DB gone
   - [ ] `/api/health` gone
   - [ ] Chat consolidated to one endpoint with clear context discrimination
   - [ ] `chat-bar.tsx` under 300 LOC

3. **Architecture**
   - [ ] `lib/` reorganized into subdomains
   - [ ] API validation middleware extracted and used in all 26 routes
   - [ ] `use-recording` and `use-note-enhancement` each split into 3 hooks
   - [ ] `enhance/route.ts` under 150 LOC
   - [ ] No bare `console.*` calls in `app/api/**` or `lib/api/**` — all errors/events routed through Sentry
   - [ ] All route segments have error boundaries

4. **Open source**
   - [ ] LICENSE, README, CONTRIBUTING, docs/ all committed
   - [ ] Self-host guide tested end-to-end by a non-founder
   - [ ] CI passing on PRs
   - [ ] Launch screenshots + OG image ready

5. **Quality gates**
   - [ ] `bun run typecheck` passes
   - [ ] `bun run lint` passes
   - [ ] `bun test` passes
   - [ ] Manual test of record → transcribe → generate notes → edit → save flow
   - [ ] AI Society pilot group has access and at least 3 meetings logged

---

## 9. Rollout

1. **Week 1** — Architecture refactor (`lib/` reorg, hook splits, middleware extraction, chat investigation). No UI changes. Ship as one PR or a small series. No user-visible changes.
2. **Week 2** — Deletions + token system (delete templates, health, chat consolidation, install new Workspace tokens in `globals.css`, retune `components/ui/*`). App visually transformed but not polished.
3. **Week 3** — Screen-by-screen polish (landing, dashboard, meeting detail, auth). Real content, real testing, screenshots taken.
4. **Week 4** — Open-source prep (README, LICENSE, docs, CI verify, launch assets). Private AI Society dogfood. Bug bash.
5. **Launch** — Public repo, ShowHN/Reddit post, AI Society rollout.

---

## Open Questions

- [ ] Which of the 3 chat endpoints is the "real" one? (investigation task on day 1 of impl)
- [ ] Is `sources` / file upload actually used by anyone? (kept per user decision, but should be spot-checked)
- [ ] Final hero copy for the landing page (deferred to copywriting pass during week 3)
- [ ] Supabase migration strategy — does dropping `note_templates` require app downtime? (probably no, since nobody's using it)
