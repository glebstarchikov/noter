# Noter Phase 3 — Screen Redesigns + Flow Fix

- **Date**: 2026-04-17
- **Owner**: Gleb (solo, AI Society)
- **Status**: Approved, ready for implementation plan
- **Depends on**: Phase 2 (Workspace tokens + templates deletion + component retune) — completed
- **Branch**: `refactor/making-the-app-even-better`

## Summary

Phase 3 fixes the broken record → transcribe → write notes flow and applies Workspace-language polish to every screen. The core change: remove auto-generation, make all AI actions user-triggered, and unify the meeting page into a single component that always starts with an editable Tiptap editor. Secondary work: split the 623-LOC `meeting-note-surface.tsx`, strip the chat bar to Linear-inspired essentials, fix the transcript bubble shape, and polish the dashboard list / auth / sidebar.

**Landing page is explicitly deferred** to Phase 4 (OSS prep) since it depends on the GitHub repo, README, and self-host docs that don't exist yet.

## Goals

1. Make the record → transcribe → improve flow unbreakable and user-controlled.
2. Eliminate competing note-creation paths (auto-generation vs manual draft vs enhance).
3. Simplify the meeting page from 3 components to 1 unified surface.
4. Split oversized components (meeting-note-surface, chat-bar) for maintainability.
5. Apply Workspace visual polish to dashboard, auth, and sidebar.

## Non-Goals

- Landing page redesign (Phase 4).
- Chat route consolidation (deferred per user instruction — "don't touch the AI chat pill" API routes).
- Dark mode (deferred post-v1).
- New features — this is simplification + polish only.

---

## 1. Core Flow Redesign

### 1.1 Current flow (broken)

The current flow has two competing note-creation systems:

1. **Auto-generation path**: `use-recording.ts:handleStop()` calls `POST /api/generate-notes` the moment recording stops. Notes are created without any user action.
2. **Manual path**: `MeetingNoteSurface` shows "Create first draft" / "Improve with AI" buttons that call `POST /api/meetings/[id]/enhance`.

These run simultaneously. The user sees a "Create first draft" button appear and then the draft materializes on its own because the auto-generation already fired. The "Start typing manually" button on the empty state shows before recording even starts and doesn't work reliably. The flow feels out of control.

Additionally, the meeting page has a confusing entry point:
- `/dashboard/new` shows a two-card chooser (Record live / Upload audio).
- After creation, the page splits into `MeetingWorkspace` (recording-origin) vs `MeetingDetail` (non-recording), with different UIs for the same meeting.

### 1.2 New flow

```
"New note" → create empty meeting (status: 'done') → /dashboard/[id]
         ↓
  Unified page: editor always visible and editable
         ↓
  [optional] Press Record → live transcript appears alongside editor
         ↓
  Stop recording → transcript saved, editor still there
         ↓
  Button appears: "Create notes" (if empty) or "Improve with AI" (if content exists)
         ↓
  User clicks → AI runs → notes appear/improve in editor
         ↓
  Button greys out → re-enables when user makes edits
```

**Key principles:**
- The editor is always the starting point. Always visible, always editable.
- Recording is a feature within the note page, not a separate flow state.
- All AI actions are explicitly user-triggered. No auto-generation.
- No redirects, no polling pages, everything inline.

### 1.3 Unified meeting page (`/dashboard/[id]`)

The page has three zones:

**Zone 1 — Page header:**
- Title (editable inline), meta row (date, duration if recorded), actions menu (pin, copy, delete).
- Back-to-notes link.

**Zone 2 — Recording controls (contextual):**

| State | UI |
|-------|-----|
| No recording yet | "Record" button + "Upload audio" button (secondary actions in header area) |
| Recording active | Status bar: pulsing dot, elapsed time, pause/stop, system audio toggle |
| Recording complete | Quiet inline confirmation: "Recording complete · 14:32" |
| No transcript available | Controls hidden (user is typing a plain note) |

**Zone 3 — Editor + AI action:**
- Tiptap editor, always visible, placeholder "Start typing..."
- AI action button in the editor section header:

| State | Button | Behavior |
|-------|--------|----------|
| No content, no transcript | No button | User types manually, no AI available |
| No content, transcript available | **"Create notes"** (enabled) | Generates first draft from transcript via enhance route `mode: 'generate'` |
| Content exists, transcript available, user edited since last AI pass | **"Improve with AI"** (enabled) | Enhances existing notes via enhance route `mode: 'enhance'` |
| Content exists, no edits since last AI pass | **"Improve with AI"** (greyed, disabled) | Re-enables when `currentHash !== reviewState.lastReviewedSourceHash` |
| AI running | Button shows spinner, disabled | Request in flight |
| AI finished | Button greys out | Re-enables on next user edit |
| Error during AI | Error badge + "Retry" button | User can retry or keep editing |

### 1.4 Entry point change

- "New note" (sidebar button) creates a meeting with `status: 'done'` and empty content, then redirects to `/dashboard/[id]`.
- The `/dashboard/new` page is removed as a chooser. The creation logic moves to a server action or inline handler.
- Upload audio becomes an action within the note page (Zone 2), not a separate entry path.

### 1.5 Upload audio flow (inline)

When the user clicks "Upload audio" on the note page:
1. File picker opens → audio uploads to Supabase Storage (shows progress inline).
2. Transcription starts automatically via `POST /api/transcribe` → inline status: "Transcribing..."
3. Transcription completes → "Create notes" button appears in Zone 3.
4. User clicks → AI generates notes.

Transcription is automatic (you always need a transcript from uploaded audio). Note generation is user-triggered.

### 1.6 Status field semantics

| Status | Meaning |
|--------|---------|
| `'recording'` | Actively recording audio |
| `'generating'` | AI is working (kept for DB state in case user navigates away mid-generation) |
| `'done'` | Ready for editing — may or may not have content. New notes start here. |
| `'error'` | Something failed |

New notes are created with `status: 'done'` + empty `document_content`. When recording starts, status updates to `'recording'`. When recording stops, status returns to `'done'` (not `'generating'` — generation is user-triggered). When user clicks "Create notes" / "Improve with AI", status temporarily goes to `'generating'`, then back to `'done'` on completion.

### 1.7 Deletions

| Item | Reason |
|------|--------|
| `components/processing-view.tsx` | No more redirect to processing page — everything inline |
| `shouldUseProcessingView()` in `lib/meetings/meeting-workspace.ts` | No more processing view routing |
| `isRecordingOriginMeeting()` in `lib/meetings/meeting-workspace.ts` | No more workspace vs detail split |
| `MeetingWorkspace` component | Merged into unified meeting page |
| `MeetingDetail` component (as separate component) | Merged into unified meeting page |
| `MeetingDetailWrapper` component | No longer needed — one component for all states |
| Auto-generation call in `use-recording.ts:handleStop()` | No auto-generation — user triggers AI explicitly |
| `app/api/generate-notes/route.ts` | Enhance route already supports `mode: 'generate'` — one API for all AI note actions |
| `/dashboard/new` two-card chooser page | "New note" creates directly, record/upload are actions within the note page |
| `meeting-upload.ts` orchestration of generate-notes | Upload + transcribe stays; generation is user-triggered |
| `showManualEditor` toggle in meeting-note-surface | Editor is always visible — no toggle needed |
| `showGeneratedReveal` badge + timer | User explicitly triggered generation — they know it happened |
| `empty-generating` / `empty-ready` view states | No more empty states with competing CTAs |
| `DraftProgressIcon` / `AUTO_DRAFT_PROGRESS_STEPS` | No auto-draft progress display |

### 1.8 Survivals

| Item | Reason |
|------|--------|
| `app/api/meetings/[id]/enhance/route.ts` | Handles both generate and improve — the single AI endpoint |
| Tiptap editor with autosave + conflict detection | Core editing experience unchanged |
| Undo after AI changes | Important safety net |
| `use-recording.ts` + `use-media-stream.ts` + `use-deepgram-transcription.ts` | Recording hooks unchanged (minus the auto-generation call in handleStop) |
| `app/api/transcribe/route.ts` | Still needed for upload audio path |
| `use-draft-proposal.ts` / `use-note-enhancement.ts` | Draft state machine still valid (simplified) |
| Document conflict resolution | Stale document detection still needed |

---

## 2. meeting-note-surface.tsx Split

With the flow simplification, ~150 LOC of complexity vanishes (empty-generating states, auto-reveal effects, showManualEditor toggle, DraftProgressIcon). The remaining ~470 LOC splits into:

| File | LOC (est.) | Responsibility |
|------|-----------|----------------|
| `components/note-editor-surface.tsx` | ~250 | Tiptap editor wrapper, autosave integration, content change tracking, conflict alert display |
| `components/draft-action-bar.tsx` | ~120 | "Create notes" / "Improve with AI" button, loading/disabled states, undo button, error badge, retry |
| `components/meeting-note-surface.tsx` | ~100 | Thin composer of the above two, owns `useNoteEnhancement` hook wiring, state derivation |

---

## 3. Chat Bar Redesign

### 3.1 Design direction: Linear-inspired minimalism

The current composer shows 6 controls at all times (Context popover, File attach, Web search toggle, Model selector, More menu, Send button). Following Linear's principle that "not every element should carry equal visual weight", strip to essentials.

### 3.2 Composer layout

**Collapsed (dock):**
```
┌─────────────────────────────────────────────────┐
│  Ask about this note...                    [⌘J] │
└─────────────────────────────────────────────────┘
```

**Expanded:**
```
┌─────────────────────────────────────────────────┐
│  [×] Chat header                                │
│─────────────────────────────────────────────────│
│  messages...                                    │
│─────────────────────────────────────────────────│
│  ┌───────────────────────────────────────────┐  │
│  │ Ask something...                      [↑] │  │
│  │                                 [+] [⌘J]  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

- **Default state**: textarea + send button only. Clean.
- **[+] button**: opens a compact tray revealing file attach, web search toggle, model selector. Hidden by default — power-user features live here.
- **Context chip**: only visible when files are attached or scope changes from default.
- **Scope toggle** (meeting/global): moves into [+] tray or header area.
- **⌘J badge**: shown in collapsed dock, hidden when expanded.

### 3.3 Modularization

| File | LOC (est.) | Responsibility |
|------|-----------|----------------|
| `hooks/use-chat-session.ts` | ~130 | `useChat` wiring, message persistence (localStorage), scope management, transport selection |
| `components/chat/chat-shell.tsx` | ~100 | Animated shell container, expand/collapse, keyboard shortcuts (⌘J, Escape), click-outside dismiss |
| `components/chat-bar.tsx` | ~80 | Thin composer: plugs session + shell + ChatComposer + ChatMessageList |
| `components/chat/chat-composer.tsx` | ~200 (down from 332) | Trimmed: input + send + [+] tray. Context/scope/model/search move into collapsible tray |

Chat sub-components that survive unchanged: `ChatMessageList`, `ChatTranscriptContent`, `ChatModelSelector`, `ChatAttachmentPreview`.

---

## 4. Transcript Bubble Fix

### 4.1 Shape

Current: 56×64px with `rounded-[22px]` — awkward oval-rectangle hybrid.

**New: proper circle.** `size-12` (48px) with `rounded-full`. Clean, unambiguous shape.

### 4.2 Bar animation smoothing

Current issues: 6 bars with 38% attack / 14% release smoothing — bars jump too aggressively.

**Fixes:**
- Reduce to **4 bars** (instead of 6) — cleaner visual, less visual noise in a smaller circle.
- Increase release smoothing from **14% to 20%** — bars decay more gradually.
- Cap max height at **16px** (instead of 22px) — bars feel contained within the circle.
- Reduce bar width from 3px to **2.5px** with 2px gaps — proportional to smaller container.

### 4.3 Idle state

Current: varying heights `[0.1, 0.14, 0.12, 0.16, 0.11, 0.13]` — looks like frozen mid-animation.

**New: uniform low height** — all bars at the same height (e.g., `[0.12, 0.12, 0.12, 0.12]`). Looks intentional and resting, not broken.

### 4.4 Recording indicator

Current: absolute-positioned red dot in top-right corner.

**New: outer ring pulse** — use the same ring pattern as `StatusDot` but with the `--recording` color. A subtle `ring-[3px]` in recording color around the circle, with a gentle pulse animation. Replaces the arbitrary positioned dot with a design-system-consistent pattern.

---

## 5. Dashboard List Polish

Minor Workspace alignment work:

- Replace inline `StatusDot` function in `meetings-list.tsx` with the canonical `ui/status-dot` component.
- Remove `Badge` import (unused after StatusDot migration).
- Apply Workspace hover states: `hover:bg-card` instead of `hover:bg-secondary/35`.
- Meta row: uppercase small-caps labels per design rules (`text-[11px] uppercase tracking-wider text-muted-foreground font-medium`).
- Duration display: ensure `tabular-nums` on all time values.
- Empty state: verify it uses Workspace surfaces and button variants.

---

## 6. Auth Pages — Token Refresh

Minimal work, ~30 minutes:

- Input fields: `rounded-lg` → `rounded-xl` to match Workspace default radius.
- Focus ring: replace non-Workspace focus ring styles (`focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-accent`) with standard Workspace focus ring (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
- Verify button variants are `primary` (not default/outline).
- Verify `auth-page-layout.tsx` surface uses `bg-card` tinted surface.

---

## 7. Sidebar Cleanup

- Remove `ThemeToggle` / `ThemeToggleInline` from sidebar (dark mode deferred — toggle is non-functional).
- Fix `rounded-md` occurrences → `rounded-xl` or `rounded-lg` per Workspace rules.
- Verify sidebar surfaces use Workspace tokens.

---

## 8. Acceptance Criteria

### Flow
- [ ] "New note" creates an empty meeting and lands on the editor immediately — no chooser page.
- [ ] Editor is always visible and editable on the meeting page.
- [ ] Recording is an action within the note page (Record button + Upload audio button).
- [ ] After recording stops, no auto-generation fires. "Create notes" button appears.
- [ ] User must click "Create notes" / "Improve with AI" to trigger AI.
- [ ] Button greys out after AI runs, re-enables when user edits the document.
- [ ] Undo restores pre-AI document state.
- [ ] Upload audio flow works inline: upload → transcribe → "Create notes" button appears.
- [ ] `ProcessingView` component is deleted.
- [ ] `/dashboard/new` chooser page is removed.
- [ ] `generate-notes` API route is removed (enhance handles both modes).

### Components
- [ ] `meeting-note-surface.tsx` split into 3 files, each under 300 LOC.
- [ ] `chat-bar.tsx` under 100 LOC after modularization.
- [ ] `use-chat-session.ts` hook extracted.
- [ ] `chat-shell.tsx` extracted.
- [ ] `chat-composer.tsx` under 250 LOC with [+] tray pattern.

### Visual
- [ ] Transcript bubble is a proper circle (`rounded-full`, `size-12`).
- [ ] Bars reduced to 4, smoother animation, uniform idle state.
- [ ] Recording indicator uses ring pulse, not positioned dot.
- [ ] Dashboard list uses canonical `StatusDot`, Workspace hover states, uppercase meta labels.
- [ ] Auth inputs use `rounded-xl` and Workspace focus ring.
- [ ] Sidebar has no ThemeToggle, no `rounded-md`.

### Quality gates
- [ ] `bun run typecheck` passes.
- [ ] `bun run lint` passes.
- [ ] `bun test` passes.
- [ ] Manual test: create note → type → record → stop → "Create notes" → edit → "Improve with AI" → undo.
- [ ] Manual test: create note → upload audio → transcription completes → "Create notes" → notes appear.

---

## 9. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Removing auto-generation breaks the upload flow's transcription step | Medium | Transcription stays automatic — only note generation becomes user-triggered. Test upload path end-to-end. |
| Merging MeetingWorkspace + MeetingDetail misses edge cases in recording state management | High | The recording hooks are unchanged — only the component composition changes. Test all recording states (setup, recording, paused, stopping, done). |
| Chat bar modularization breaks shell animation timing | Medium | `use-shell-animation.ts` is untouched — only the component that consumes it changes. Test expand/collapse on desktop and mobile. |
| Deleting `generate-notes` route leaves orphan references | Low | `grep -r 'generate-notes'` to find all callers. Currently: `use-recording.ts:handleStop()` and `meeting-upload.ts`. Both get updated. |
| Transcript bubble bar reduction (6→4) looks sparse | Low | Test visually during implementation. Can adjust bar count without architectural changes. |
