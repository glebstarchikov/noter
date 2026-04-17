# Phase 3.5 — System-Wide Visual Consistency Pass

**Date:** 2026-04-17  
**Goal:** Make Noter feel built by one hand — consistent design language across every element, ready for OSS launch screenshots.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | System-wide (typography, spacing, motion, empty states, every element) | App needs to look premium for OSS launch |
| Chat composer glass | Replace all `liquid-glass-*` with Workspace card surfaces | Glass was fitting when chat was a floating overlay; now it clashes with the docked card-surface UI |
| Recording zone feel | Calm & minimal — card surface, static sage dot, no sage tint | Recording shouldn't compete for attention; transcript rolling in is the signal |
| Implementation order | Page-by-page in user-journey order | Meeting page → chat bar → dashboard; each zone ships complete before the next |

## Typography Scale

All Inter. No exceptions.

| Role | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| Page title | 22px | 650 | -0.02em | Meeting title, dashboard heading |
| Section heading | 15px | 600 | — | H3 inside editor content |
| Body text | 14px | 400 | — | Editor prose, descriptions |
| Meta / caption | 11px | 500 | — | Dates, durations, status |
| Section label | 10px | 600 | +0.1em uppercase | "RECORDING · 04:22", zone headers |
| Timestamps | any | 500 | — | Always `tabular-nums` |

## Color Tokens — Additions

No new tokens needed. Map existing violations to what's already in `globals.css`:

| Current violation | Replace with |
|---|---|
| `amber-50/80`, `amber-300/60`, `amber-950`, `amber-900/70` (conflict alert) | `bg-destructive/5 border-destructive/20 text-foreground` + `text-destructive` for title |
| `liquid-glass-context-chip` | `bg-secondary border-border rounded-full` with a `size-1.5 rounded-full bg-accent` dot |
| `liquid-glass-toolbar` | plain `flex` row, buttons use `hover:bg-accent-soft rounded-lg` |
| `liquid-glass-popover` | `bg-card border border-border shadow-lg rounded-xl` |
| `liquid-glass-button` (in note-editor-surface) | standard `variant="ghost"` button |

## Zone-by-Zone Changes

### Zone 1 — Meeting page header (`unified-meeting-page.tsx`)

- Page title: add `tracking-tight` (or `-0.02em`) to the `<h1>` / title element
- Meta row: `text-[11px] font-medium` for date + duration, `tabular-nums` on duration
- No other structural changes; spacing already correct

### Zone 2 — Recording status bar (`recording-status-bar.tsx`)

Current state is already Workspace-aligned (`surface-status`, `rounded-[24px]`, correct button variants). Minor audit only:
- Confirm ping animation on the recording dot is removed (calm/minimal decision) — replace `animate-ping` with static dot
- Confirm label text uses `uppercase tracking-wider text-[10px]` pattern
- Confirm Pause and Stop buttons use `rounded-full` pill shape

### Zone 2b — Status panels (`status-panel.tsx`, `unified-meeting-page.tsx`)

- "Ready to record" panel: confirm `surface-status` and correct tone
- "Recording complete" panel: confirm `surface-status` success tone
- "Stopping / saving" panel: confirm `surface-status` with `Loader2` spinner

### Zone 3 — Editor surface (`note-editor-surface.tsx`)

Three changes:

1. **Conflict alert colors**: Replace `rounded-2xl border-amber-300/60 bg-amber-50/80 text-amber-950` with `rounded-xl bg-destructive/5 border-destructive/20 text-foreground`. Title text: `text-destructive`. Body text: `text-muted-foreground`.

2. **Resolve/dismiss button**: Replace `liquid-glass-button h-8 rounded-full` with `variant="ghost" size="sm" className="rounded-full"`.

### Zone 3b — Draft action bar (`draft-action-bar.tsx`)

Current state is mostly aligned. Audit only:
- "Create notes / Improve with AI" button: confirm `rounded-full` pill, `bg-primary text-primary-foreground`
- Undo button: confirm `variant="ghost"` with `rounded-full`
- Error/retry badge: confirm uses semantic destructive token, not hardcoded color

### Zone 4 — Chat composer (`chat/chat-composer.tsx`)

Three `liquid-glass-*` replacements:

1. **Context chips** (`liquid-glass-context-chip` → card surface):
   ```tsx
   // Before
   className="liquid-glass-context-chip ..."
   // After
   className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
   // Add a sage dot before the label:
   // <span className="size-1.5 rounded-full bg-accent flex-shrink-0" />
   ```

2. **Toolbar** (`liquid-glass-toolbar` → plain surface):
   ```tsx
   // Before
   className="liquid-glass-toolbar ..."
   // After
   className="flex items-center gap-1 border-t border-border pt-2 mt-2"
   // Toolbar buttons: className="rounded-lg hover:bg-accent-soft hover:text-accent text-muted-foreground"
   ```

3. **Popover** (`liquid-glass-popover` → card surface):
   ```tsx
   // Before
   className="liquid-glass-popover ..."
   // After
   className="bg-card border border-border shadow-lg rounded-xl"
   ```

### Zone 4b — Chat shell + dock (`chat/chat-shell.tsx`)

Already using `bg-card` after Phase 3 fix. Audit:
- Shell: confirm `bg-card border border-border/60 shadow-lg rounded-[28px]`
- Dock button: confirm `bg-card border border-border rounded-full shadow-sm`
- No glass classes remaining

### Zone 5 — Dashboard (`meetings-list.tsx`, `app/dashboard/page.tsx`)

Already mostly aligned after Phase 3. Audit:
- Meetings list items: hover state is `hover:bg-card`, confirm
- Date meta: confirm `text-[11px] uppercase tracking-wider font-medium text-muted-foreground`
- Status dots: confirm canonical `StatusDot` component is used everywhere
- Dashboard page title: apply same `tracking-tight` as meeting title

### Zone 6 — Empty states

Check dashboard empty state (no notes yet) and any inline empty states in the editor. Apply:
- `surface-empty` class (already defined in `globals.css`)
- Consistent `text-muted-foreground` messaging
- If CTAs exist, use `variant="ghost"` buttons

## Spacing Rhythm

- Between page zones (header / recording / editor): `gap-8` (2rem) — already in `unified-meeting-page.tsx`, verify
- Within a zone (e.g., toolbar → content): `gap-4` (1rem)
- Within a card/panel: `px-5 py-4` for standard panels, `px-4 py-3` for compact chips/badges

## Motion

Default transition for interactive elements: `transition-colors duration-150 ease-out`. Already in Tailwind config via `transition-colors`. Audit:
- No `duration-0` or missing transition on hover states
- Status panels fade-in: keep existing (no change needed)
- Chat bar open/close: keep existing spring animation

## Acceptance Criteria

- Zero `liquid-glass-*` class names remaining in `components/chat/chat-composer.tsx` and `components/note-editor-surface.tsx`
- Zero hardcoded `amber-*` color classes remaining
- Every alert/notice uses either `bg-destructive/5` (conflict/warning) or `bg-accent/10` (info/success)  
- Every button uses an approved variant: `default`, `destructive`, `ghost`, `ghost-icon`, `ghost-destructive`
- Recording dot has no `animate-ping` — static only
- Typography spot-check: page titles have negative tracking, timestamps have `tabular-nums`, section labels are uppercase
- `bun run typecheck && bun run lint` pass
- `bun test` passes (245+ tests)

## Out of Scope

- Dark mode (deferred post-v1)
- Landing page (Phase 4)
- Any new features or layout changes
- Tiptap bubble menu styling (complex, separate task)
