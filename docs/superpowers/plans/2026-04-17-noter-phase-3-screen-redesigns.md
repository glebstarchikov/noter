# Phase 3: Screen Redesigns + Flow Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken record → transcribe → notes flow by removing auto-generation, unify the meeting page into a single always-editable surface, split oversized components, and apply Workspace visual polish.

**Architecture:** Remove the competing auto-generation path (`/api/generate-notes` + `handleStop()` auto-call). All AI note actions flow through the existing `/api/meetings/[id]/enhance` route. The meeting page becomes one unified component (editor always visible, recording is an inline action). Chat bar is modularized into hook + shell + thin composer.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Tiptap 3, Supabase, Vercel AI SDK

**Spec:** `docs/superpowers/specs/2026-04-17-noter-phase-3-screen-redesigns.md`

---

### Task 1: Remove auto-generation from recording stop

Remove the `POST /api/generate-notes` call from `handleStop()` in `use-recording.ts`. After recording stops, the meeting status goes to `'done'` (not `'generating'`), and the user sees the "Create notes" button.

**Files:**
- Modify: `hooks/use-recording.ts:175-275`

- [ ] **Step 1: Modify handleStop to skip auto-generation**

In `hooks/use-recording.ts`, replace the section that sets `status: 'generating'` and calls `/api/generate-notes` with a simple `status: 'done'` update. Remove the `generationStarted` flag and the error recovery for post-generation failures.

Replace lines 214-274 (from the `supabase.from('meetings').update(...)` through the end of the function body before the `return` block):

```ts
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          status: 'done',
          audio_url: storagePath,
          audio_duration: duration,
          ...(flatTranscript ? { transcript: flatTranscript } : {}),
          ...(segments.length > 0 ? { diarized_transcript: segments } : {}),
        })
        .eq('id', meetingId)
        .eq('user_id', user.id)

      if (updateError) throw new Error(updateError.message)

      setPhase('done')
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save recording'
      toast.error(message)
      resetRecordingSurface()
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
      stopAllStreams()
      mediaRecorderRef.current = null
      chunksRef.current = []
      closeAudioSession()
      setIsPaused(false)
    }
```

Remove the `readApiError` import since it's no longer used in this file.

- [ ] **Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS (the removed `readApiError` import may cause lint warning if it's the only usage — check)

- [ ] **Step 3: Commit**

```bash
git add hooks/use-recording.ts
git commit -m "refactor: remove auto-generation from recording stop

Recording now sets status to 'done' instead of 'generating'.
Note generation is user-triggered via the enhance route."
```

---

### Task 2: Delete generate-notes route + ProcessingView + workspace helpers

Remove the orphaned auto-generation infrastructure.

**Files:**
- Delete: `app/api/generate-notes/route.ts`
- Delete: `components/processing-view.tsx`
- Delete: `lib/meetings/meeting-workspace.ts`
- Modify: `app/dashboard/[id]/page.tsx` (remove ProcessingView routing)
- Modify: `app/dashboard/new/page.tsx` (remove ProcessingView import)
- Modify: `components/meeting-detail-wrapper.tsx` (remove workspace/detail split)
- Modify: `lib/meetings/meeting-upload.ts` (remove generate-notes call)

- [ ] **Step 1: Find all imports of deleted files**

Run: `grep -r 'generate-notes\|processing-view\|meeting-workspace' --include='*.ts' --include='*.tsx' app/ components/ hooks/ lib/`

Identify every file that imports from the three files being deleted.

- [ ] **Step 2: Delete the generate-notes API route**

```bash
rm app/api/generate-notes/route.ts
```

- [ ] **Step 3: Delete ProcessingView component**

```bash
rm components/processing-view.tsx
```

- [ ] **Step 4: Delete meeting-workspace.ts helpers**

```bash
rm lib/meetings/meeting-workspace.ts
```

- [ ] **Step 5: Update meeting-upload.ts — remove generate-notes call**

Replace `lib/meetings/meeting-upload.ts` with a simplified version that only handles upload + transcription (no note generation, no waitForMeetingCompletion):

```ts
import { createClient } from '@/lib/supabase/client'
import { readApiError } from '@/lib/meetings/meeting-pipeline'

interface UploadAndTranscribeOptions {
  meetingId: string
  userId: string
  blob: Blob
  extension: string
  contentType: string
  onProgress?: (step: 'uploading' | 'transcribing' | 'done') => void
}

/**
 * Uploads audio to Supabase Storage, saves the path, and triggers transcription.
 * Note generation is user-triggered separately via the enhance route.
 */
export async function uploadAndTranscribeMeeting({
  meetingId,
  userId,
  blob,
  extension,
  contentType,
  onProgress,
}: UploadAndTranscribeOptions): Promise<void> {
  const supabase = createClient()

  onProgress?.('uploading')

  const storagePath = `${userId}/${meetingId}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from('meeting-audio')
    .upload(storagePath, blob, { contentType })

  if (uploadError) throw new Error('Failed to upload audio: ' + uploadError.message)

  const { error: audioUrlError } = await supabase
    .from('meetings')
    .update({ audio_url: storagePath })
    .eq('id', meetingId)

  if (audioUrlError) throw new Error('Failed to save audio URL: ' + audioUrlError.message)

  onProgress?.('transcribing')

  const transcribeRes = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId, storagePath }),
  })

  if (!transcribeRes.ok) {
    const { message } = await readApiError(transcribeRes, 'Transcription failed')
    throw new Error(message)
  }

  onProgress?.('done')
}
```

- [ ] **Step 6: Simplify meeting detail page routing**

In `app/dashboard/[id]/page.tsx`, remove the ProcessingView routing. All meetings go to the same component:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MeetingDetailWrapper } from '@/components/meeting-detail-wrapper'
import type { Meeting } from '@/lib/types'

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!meeting) notFound()

  return <MeetingDetailWrapper meeting={meeting as Meeting} />
}
```

- [ ] **Step 7: Simplify MeetingDetailWrapper — remove workspace/detail split**

For now, have `MeetingDetailWrapper` always render `MeetingWorkspace` (which handles both recording and done states). We'll unify the components in Task 4.

In `components/meeting-detail-wrapper.tsx`:

```tsx
'use client'

import { MeetingWorkspace } from '@/components/meeting-workspace'
import { PageShell } from '@/components/page-shell'
import type { Meeting } from '@/lib/types'

export function MeetingDetailWrapper({ meeting }: { meeting: Meeting }) {
  return (
    <PageShell size="detail">
      <MeetingWorkspace meeting={meeting} />
    </PageShell>
  )
}
```

- [ ] **Step 8: Remove ProcessingView from dashboard/new page**

In `app/dashboard/new/page.tsx`, remove the `ProcessingView` import and the `processing` state that renders it. The upload flow will be redesigned in Task 6, but for now keep the page functional by removing the broken processing redirect. The page still uses `AudioUploader` which needs updating — that happens in Task 6. For now, just remove the ProcessingView dependency so the build doesn't break:

Remove the `processing` state, the `if (processing)` early return block, and the `ProcessingView` import. Pass a no-op for `onProcessing` to `AudioUploader` temporarily (Task 6 will replace this page entirely).

- [ ] **Step 9: Run typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: delete auto-generation infrastructure

Remove generate-notes API route, ProcessingView component, and
meeting-workspace helpers. Simplify meeting-upload to upload+transcribe
only. All meetings now route to the same detail component."
```

---

### Task 3: New note entry point

Replace `/dashboard/new` chooser page with direct meeting creation. Sidebar "New meeting" creates an empty meeting and redirects to `/dashboard/[id]`.

**Files:**
- Create: `lib/meetings/create-meeting.ts`
- Modify: `app/dashboard/new/page.tsx` (rewrite to server action redirect)
- Modify: `components/app-sidebar.tsx` (update "New meeting" link)

- [ ] **Step 1: Create server action for meeting creation**

Create `lib/meetings/create-meeting.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createNewMeeting() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      user_id: user.id,
      title: 'Untitled note',
      status: 'done',
    })
    .select('id')
    .single()

  if (error || !meeting) {
    throw new Error('Failed to create meeting')
  }

  redirect(`/dashboard/${meeting.id}`)
}
```

- [ ] **Step 2: Replace /dashboard/new with redirect page**

Replace `app/dashboard/new/page.tsx` with a simple page that creates a meeting and redirects. This keeps the `/dashboard/new` URL functional (sidebar links, bookmarks) but immediately creates and redirects:

```tsx
import { createNewMeeting } from '@/lib/meetings/create-meeting'

export default async function NewMeetingPage() {
  await createNewMeeting()
}
```

- [ ] **Step 3: Update sidebar to use server action**

In `components/app-sidebar.tsx`, the "New meeting" button already links to `/dashboard/new`. This still works since the new page auto-redirects. No change needed to the sidebar — the link target is the same, the behavior is just faster.

- [ ] **Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/meetings/create-meeting.ts app/dashboard/new/page.tsx
git commit -m "feat: new note creates empty meeting directly

Replace the record/upload chooser page with a server action that
creates an empty meeting (status: 'done') and redirects to it.
Recording and upload are now actions within the meeting page."
```

---

### Task 4: Unified meeting page

Merge `MeetingWorkspace` and `MeetingDetail` into a single unified component. The page always shows the editor with optional recording controls.

**Files:**
- Create: `components/unified-meeting-page.tsx`
- Modify: `components/meeting-detail-wrapper.tsx` (use new unified component)
- Delete: `components/meeting-detail.tsx` (after merge)

- [ ] **Step 1: Create unified-meeting-page.tsx**

This component combines the best of `MeetingWorkspace` (recording controls) and `MeetingDetail` (done-state rendering) into one. It has 3 zones: header, recording controls, and editor.

The component should:
- Always render the page header (title, meta, actions menu) from `MeetingDetail`
- Show recording controls from `MeetingWorkspace` when `meeting.status === 'recording'`
- Show "Record" + "Upload audio" buttons when status is `'done'` and no transcript exists
- Show "Recording complete" confirmation when transcript exists and status is `'done'`
- Always render `MeetingNoteSurface` at the bottom

Use the existing `useRecording` hook, `RecordingStatusBar`, `RecordingErrorBoundary`, `StatusPanel`, and `MeetingAssistantBridge` from `MeetingWorkspace`. Use the page header structure (back link, title, meta row, actions dropdown) from `MeetingDetail`.

Keep `MeetingNoteSurface` props the same — it already handles all note states. Pass `isRecordingComplete` based on whether recording phase is `'done'` or meeting status is not `'recording'`.

Target: ~300 LOC (down from 375 + 215 = 590 combined).

- [ ] **Step 2: Update MeetingDetailWrapper to use unified component**

```tsx
'use client'

import { UnifiedMeetingPage } from '@/components/unified-meeting-page'
import { PageShell } from '@/components/page-shell'
import type { Meeting } from '@/lib/types'

export function MeetingDetailWrapper({ meeting }: { meeting: Meeting }) {
  return (
    <PageShell size="detail">
      <UnifiedMeetingPage meeting={meeting} />
    </PageShell>
  )
}
```

- [ ] **Step 3: Delete old split components**

```bash
rm components/meeting-detail.tsx
rm components/meeting-workspace.tsx
```

- [ ] **Step 4: Run typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS. Fix any broken imports in other files referencing the deleted components.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: unify meeting page into single component

Merge MeetingWorkspace + MeetingDetail into UnifiedMeetingPage.
One component handles all states: recording, done, error.
Editor is always visible. Recording is an inline action."
```

---

### Task 5: Simplify and split meeting-note-surface.tsx

Remove dead code from the flow simplification, then split into 3 focused components.

**Files:**
- Create: `components/note-editor-surface.tsx`
- Create: `components/draft-action-bar.tsx`
- Modify: `components/meeting-note-surface.tsx` (slim to thin composer)

- [ ] **Step 1: Identify dead code to remove**

These items are dead after the flow redesign:
- `showManualEditor` state + `handleShowEditor` callback — editor is always visible
- `showGeneratedReveal` state + reveal timer effect — user triggers generation explicitly
- `DraftProgressIcon` component — no auto-draft progress
- `AUTO_DRAFT_PROGRESS_STEPS` constant — no auto-draft progress
- `empty-generating` branch in `getNoteSurfaceView` — no auto-generation empty state
- The entire `showEmptyState` rendering block (empty-generating, empty-ready, error empty states with progress steps) — replaced by always-visible editor + draft action bar
- `showEmptyStatePrimaryAction` flag — buttons move to draft action bar
- The `showGeneratedReveal` ring styling on the section wrapper

- [ ] **Step 2: Extract draft-action-bar.tsx**

Create `components/draft-action-bar.tsx` containing the AI action button, undo button, and error/retry UI. This is the "Create notes" / "Improve with AI" bar that sits in the editor section header.

Props interface:
```ts
interface DraftActionBarProps {
  draftState: DraftUiState
  actionMode: 'generate' | 'enhance'
  canReview: boolean
  shouldShowAction: boolean
  hasDocumentContent: boolean
  reviewState: EnhancementState
  undoDocument: TiptapDocument | null
  documentConflict: unknown
  onDraftRequest: () => void
  onUndo: () => void
}
```

The component renders:
- "Create notes" button (when `actionMode === 'generate'` and `shouldShowAction`)
- "Improve with AI" button (when `actionMode === 'enhance'` and `shouldShowAction`)
- Greyed-out disabled button (when `!shouldShowAction` and has content)
- Spinner state (when `draftState !== 'idle'`)
- Undo button (when `undoDocument` exists and `draftState === 'idle'`)
- Error badge + retry (when `reviewState.lastError` exists)

Move the relevant JSX from the current `showHeaderActions` block in `meeting-note-surface.tsx`.

- [ ] **Step 3: Extract note-editor-surface.tsx**

Create `components/note-editor-surface.tsx` containing the Tiptap editor wrapper, autosave integration, and conflict alert.

Props interface:
```ts
interface NoteEditorSurfaceProps {
  meeting: Meeting
  editorSeed: TiptapDocument
  editorRevision: number
  editable: boolean
  acknowledgedHash: string
  documentConflict: DocumentSaveConflict | null
  onEditorReady: (editor: Editor | null) => void
  onContentChange: (document: unknown) => void
  onAutosaveSuccess: (payload: { documentHash: string }) => void
  onAutosaveConflict: (payload: { currentDocument: TiptapDocument; currentHash: string; message: string }) => void
  onLoadLatestVersion: () => void
  onKeepLocalDraft: () => void
  onDismissConflict: () => void
}
```

Move the `MeetingEditor` rendering, conflict alert, and related handlers from `meeting-note-surface.tsx`.

- [ ] **Step 4: Slim meeting-note-surface.tsx to thin composer**

The remaining `meeting-note-surface.tsx` becomes a ~100 LOC composer that:
1. Owns the `useNoteEnhancement` hook wiring
2. Manages `editorSeed`, `editorRevision`, `currentDocument`, `acknowledgedHash` state
3. Derives `actionMode`, `canReview`, `hasDocumentContent`
4. Renders `<DraftActionBar />` + `<NoteEditorSurface />`

Remove: `getNoteSurfaceView` function, `NoteSurfaceView` type, `DraftProgressState` type, `DraftProgressIcon`, `AUTO_DRAFT_PROGRESS_STEPS`, the entire empty-state rendering block, `showManualEditor` state, `showGeneratedReveal` state + timer effect.

The `shouldShowEditor` flag is no longer needed — the editor is always visible. The editor section wrapper simplifies to always render.

- [ ] **Step 5: Run typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/draft-action-bar.tsx components/note-editor-surface.tsx components/meeting-note-surface.tsx
git commit -m "refactor: split meeting-note-surface into 3 focused components

Extract DraftActionBar (AI buttons, undo, error) and
NoteEditorSurface (Tiptap editor, autosave, conflicts).
Remove dead auto-generation UI code (~150 LOC deleted)."
```

---

### Task 6: Inline upload audio flow

Adapt `AudioUploader` to work within an existing meeting page instead of creating a new meeting.

**Files:**
- Modify: `components/audio-uploader.tsx` (work within existing meeting)
- Modify: `components/unified-meeting-page.tsx` (add upload button + inline uploader)

- [ ] **Step 1: Refactor AudioUploader for inline use**

The current `AudioUploader` creates a new meeting and orchestrates the full pipeline. Refactor it to:
- Accept `meetingId` and `userId` as props (meeting already exists)
- Use the new `uploadAndTranscribeMeeting` from `lib/meetings/meeting-upload.ts`
- Call `onComplete` when transcription finishes instead of redirecting
- Show inline progress: "Uploading..." → "Transcribing..." → done

New props:
```ts
interface AudioUploaderProps {
  meetingId: string
  userId: string
  onComplete: () => void
  onError: (message: string) => void
}
```

Remove the meeting creation logic (`supabase.from('meetings').insert(...)`) and the `router.push` redirect. Replace `onProcessing` callback with the simpler `onComplete`/`onError` pattern.

- [ ] **Step 2: Add upload button + inline uploader to unified meeting page**

In `components/unified-meeting-page.tsx`, add Zone 2 controls:
- When no transcript exists and status is `'done'`: show "Record" button + "Upload audio" button
- When "Upload audio" is clicked, show the inline `AudioUploader` component
- When upload completes, call `router.refresh()` to reload the meeting data with the new transcript

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: Manual test — upload flow**

Test: navigate to a new note → click "Upload audio" → select a file → verify transcription completes → verify "Create notes" button appears.

- [ ] **Step 5: Commit**

```bash
git add components/audio-uploader.tsx components/unified-meeting-page.tsx lib/meetings/meeting-upload.ts
git commit -m "feat: inline upload audio flow on meeting page

AudioUploader now works within an existing meeting page.
Upload + transcribe happens inline. Note generation is
user-triggered via 'Create notes' button."
```

---

### Task 7: Transcript bubble fix

Fix the bubble shape, bar animation, and recording indicator.

**Files:**
- Modify: `components/transcript-bubble.tsx`
- Modify: `hooks/use-audio-visualizer.ts`
- Modify: `lib/assistant-shell-layout.ts`

- [ ] **Step 1: Update layout constants for circular bubble**

In `lib/assistant-shell-layout.ts`, update the transcript trigger dimensions:

```ts
export const ASSISTANT_COLLAPSED_HEIGHT = 64
export const ASSISTANT_TRANSCRIPT_TRIGGER_WIDTH = 48  // was 56, now matches size-12 circle
```

- [ ] **Step 2: Update audio visualizer — reduce bars + improve smoothing**

In `hooks/use-audio-visualizer.ts`, change the default bar count and smoothing constants:

```ts
const RELEASE_SMOOTHING = 0.20    // was 0.14 — bars decay more gradually
```

Update the `useAudioVisualizer` signature default:

```ts
export function useAudioVisualizer(
  analyserNode: AnalyserNode | null | undefined,
  barCount = 4,  // was 6 — cleaner visual in smaller circle
): number[]
```

- [ ] **Step 3: Redesign transcript bubble**

In `components/transcript-bubble.tsx`:

Update `IDLE_BAR_HEIGHTS` to uniform heights with 4 bars:
```ts
const IDLE_BAR_HEIGHTS = [0.12, 0.12, 0.12, 0.12]
```

Update `AudioBars` — smaller bars for the circular container:
```tsx
function AudioBars({
  barHeights,
  barStyle = "idle",
}: {
  barHeights: number[];
  barStyle?: BarStyle;
}) {
  return (
    <div
      className={cn(
        "flex items-end justify-center gap-[2px]",
        barStyle === "idle" && "opacity-75",
      )}
      aria-hidden
    >
      {barHeights.map((height, index) => (
        <div
          key={index}
          className={cn(
            "rounded-full transition-[height,background-color,opacity] duration-150 ease-out",
            barStyle === "live"
              ? "bg-primary"
              : barStyle === "active"
                ? "bg-foreground/70"
                : "bg-muted-foreground/45",
          )}
          style={{
            width: "2.5px",
            height: `${Math.max(4, height * 16)}px`,
            opacity: barStyle === "live" ? 1 : 0.9,
          }}
        />
      ))}
    </div>
  );
}
```

Update the `TranscriptBubble` button — circular shape with ring recording indicator:
```tsx
<button
  type="button"
  data-slot="transcript-bubble"
  data-live={isRecording ? "true" : "false"}
  data-open={isTranscriptMode ? "true" : "false"}
  onClick={() => shellContext?.setMode("transcript")}
  className={cn(
    "assistant-shell-trigger pointer-events-auto relative flex size-12 items-center justify-center rounded-full",
    "transition-[border-color,box-shadow,background-color,ring-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
    isRecording && "ring-[3px] ring-[var(--recording)]/20",
  )}
  aria-label={isRecording ? "Open live transcript" : "Open transcript"}
  aria-pressed={isTranscriptMode}
>
  <AudioBars barHeights={displayBars} barStyle={barStyle} />
</button>
```

Remove the absolute-positioned recording dot (`<span className="absolute right-2 top-2 ...">`) — it's replaced by the ring.

Update the outer container dimensions:
```tsx
<div
  className="relative shrink-0"
  style={{
    height: ASSISTANT_COLLAPSED_HEIGHT,
    width: ASSISTANT_TRANSCRIPT_TRIGGER_WIDTH,
  }}
>
```

- [ ] **Step 4: Run typecheck + visual check**

Run: `bun run typecheck`
Start dev server and verify the bubble appears as a proper circle with smooth bars.

- [ ] **Step 5: Commit**

```bash
git add components/transcript-bubble.tsx hooks/use-audio-visualizer.ts lib/assistant-shell-layout.ts
git commit -m "fix(ui): transcript bubble — circle shape, smoother bars, ring indicator

Change bubble from 56×64 oval to 48px circle. Reduce bars from
6 to 4, increase release smoothing, cap height at 16px. Replace
corner dot with ring-based recording indicator."
```

---

### Task 8: Chat bar modularization

Extract `use-chat-session` hook and `chat-shell` component from `chat-bar.tsx`. Redesign composer with [+] tray.

**Files:**
- Create: `hooks/use-chat-session.ts`
- Create: `components/chat/chat-shell.tsx`
- Modify: `components/chat-bar.tsx` (slim to thin composer)
- Modify: `components/chat/chat-composer.tsx` (add [+] tray, hide tools by default)

- [ ] **Step 1: Extract use-chat-session hook**

Create `hooks/use-chat-session.ts` containing all chat state management extracted from `chat-bar.tsx`:

- `useChat` wiring with transport selection
- `chatId` derivation from scope
- Message persistence (localStorage read/write with debounce)
- Scope state + sync effect
- `handleClearChat`, `handleSubmit`, `handleStarterPrompt`
- `resetComposer`, file state, model state, searchEnabled state
- Derived state: `isLoading`, `submitDisabled`, `selectedFiles`, `prompt`, `starterPrompts`

Return type:
```ts
interface UseChatSessionReturn {
  messages: UIMessage[]
  status: ChatStatus
  error: Error | undefined
  input: string
  setInput: (value: string) => void
  activeScope: ChatSurfaceScope
  setActiveScope: (scope: ChatSurfaceScope) => void
  model: ChatModelId
  setModel: (model: ChatModelId) => void
  searchEnabled: boolean
  setSearchEnabled: (value: boolean | ((prev: boolean) => boolean)) => void
  files: FileList | undefined
  setFiles: (files: FileList | undefined) => void
  selectedFiles: File[]
  isLoading: boolean
  submitDisabled: boolean
  prompt: string
  starterPrompts: string[]
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleSubmit: (text: string) => void
  handleStarterPrompt: (prompt: string) => void
  handleClearChat: () => void
  removeSelectedFile: (index: number) => void
  resetComposer: () => void
}
```

- [ ] **Step 2: Extract chat-shell.tsx**

Create `components/chat/chat-shell.tsx` containing the animated shell container:

- `useShellAnimation` integration
- Keyboard shortcuts (⌘J toggle, Escape close)
- Click-outside dismiss
- Focus input on chat open
- Auto-scroll on messages
- The shell DOM structure (fixed section, spacer, outer shell with `liquid-glass-shell`)
- Collapsed dock button rendering

Props:
```ts
interface ChatShellProps {
  mode: AssistantShellMode
  setMode: (mode: AssistantShellMode) => void
  isExpanded: boolean
  spacerHeight: number
  reserveInFlow: boolean
  transcriptBubble?: React.ReactNode
  dockPrompt: string
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  messages: unknown[]
  status: string
  children: React.ReactNode
}
```

- [ ] **Step 3: Slim chat-bar.tsx**

Reduce `chat-bar.tsx` to a thin composer (~80 LOC) that:
1. Reads shell context (mode, setMode)
2. Calls `useChatSession`
3. Reads transcript data from meeting context
4. Renders `ChatShell` wrapping `ChatTranscriptContent` (transcript mode) or `ChatMessageList` + `ChatComposer` (chat mode)

- [ ] **Step 4: Redesign ChatComposer with [+] tray**

In `components/chat/chat-composer.tsx`, hide power-user tools behind a [+] button:

Add a `showToolsTray` state. Default: `false`.

Default view: just the textarea + send button.

[+] button toggles `showToolsTray`. When open, show: file attach, web search toggle, model selector, and scope toggle (if `allowGlobalToggle`). The context popover and its complex rendering move into this tray.

Remove the always-visible Context button, file attach button, web search button, model selector, and more menu from the default composer view. They only appear when the [+] tray is open.

Keep: error alert, textarea, send button always visible.

- [ ] **Step 5: Run typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS

- [ ] **Step 6: Manual test — chat bar**

Test: ⌘J opens chat → type message → send → receive response. Click [+] → attach file → send. Escape closes. Click outside closes. Transcript bubble opens transcript mode.

- [ ] **Step 7: Commit**

```bash
git add hooks/use-chat-session.ts components/chat/chat-shell.tsx components/chat-bar.tsx components/chat/chat-composer.tsx
git commit -m "refactor: modularize chat bar — extract hook, shell, slim composer

Extract use-chat-session hook (state + persistence) and
ChatShell (animation + keyboard + click-outside). Chat bar
is now ~80 LOC thin composer. Composer hides tools behind [+] tray."
```

---

### Task 9: Dashboard list polish

Apply Workspace design tokens to the meetings list.

**Files:**
- Modify: `components/meetings-list.tsx`

- [ ] **Step 1: Replace inline StatusDot with canonical component**

In `components/meetings-list.tsx`:

Remove the inline `StatusDot` component (lines 53-78) and the `statusMeta` function (lines 38-51). Remove the `StatusMeta` type.

Add import:
```ts
import { StatusDot } from '@/components/ui/status-dot'
```

Remove the `Badge` import (no longer used after this change).

In the meeting row rendering, replace `<StatusDot status={meeting.status} />` (the old inline version) with the canonical one. Map the status to include a label:

```tsx
<StatusDot
  status={meeting.status}
  label={
    meeting.status === 'done' ? 'Ready'
    : meeting.status === 'error' ? 'Needs attention'
    : meeting.status === 'recording' ? 'Recording'
    : 'In progress'
  }
/>
```

- [ ] **Step 2: Apply Workspace hover states + meta labels**

In the meeting row `<div>`, change hover state:
```tsx
className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-card"
```
(was `hover:bg-secondary/35`)

For the date display in the meta row, add uppercase tracking:
```tsx
<span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
  {formatRelativeDate(meeting.created_at)}
</span>
```

Ensure duration values (if shown) use `tabular-nums`.

- [ ] **Step 3: Run typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/meetings-list.tsx
git commit -m "refactor(ui): dashboard list — canonical StatusDot, Workspace hover + meta labels"
```

---

### Task 10: Auth pages + sidebar + final cleanup

Token refresh on auth pages, sidebar cleanup, and final quality gates.

**Files:**
- Modify: `app/auth/login/page.tsx`
- Modify: `app/auth/sign-up/page.tsx`
- Modify: `components/app-sidebar.tsx`
- Modify: `CLAUDE.md` (update project structure docs)

- [ ] **Step 1: Auth pages — rounded-xl inputs + Workspace focus ring**

In both `app/auth/login/page.tsx` and `app/auth/sign-up/page.tsx`, find all Input className strings and replace:

```
h-11 rounded-lg bg-background border-border/70 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-accent transition-colors shadow-sm
```

with:

```
h-11 rounded-xl bg-background border-border/70 shadow-sm
```

(The Workspace focus ring is already defined in the `Input` component from Phase 2's retune. Removing the per-input overrides lets it inherit the correct ring style.)

- [ ] **Step 2: Sidebar — remove ThemeToggle**

In `components/app-sidebar.tsx`:

Remove the `ThemeToggleInline` import:
```ts
// Delete this line:
import { ThemeToggleInline } from '@/components/theme-toggle'
```

In the `DropdownMenuContent`, remove:
```tsx
<ThemeToggleInline />
<DropdownMenuSeparator />
```

(The separator above the ThemeToggle should also be removed to avoid a double separator.)

- [ ] **Step 3: Sidebar — fix rounded-md**

Search `app-sidebar.tsx` for `rounded-md`. The `SidebarBrandToggle` collapsed state button has `rounded-md`. Change to `rounded-lg`:

```tsx
className="group/brand text-sidebar-foreground ring-sidebar-ring relative flex size-8 items-center justify-center rounded-lg outline-hidden focus-visible:ring-2"
```

Also fix the expanded state link:
```tsx
className="ring-sidebar-ring flex items-center gap-3 rounded-lg outline-hidden focus-visible:ring-2"
```

(This one is already `rounded-lg` but double-check.)

- [ ] **Step 4: Update CLAUDE.md — reflect Phase 3 changes**

Update the Active Initiative section to note Phase 3 is complete. Update the Project Structure section:
- Remove mention of `MeetingWorkspace` / `MeetingDetail` split
- Note that `/dashboard/new` now auto-creates and redirects
- Note that the meeting page is a unified component
- Update Architecture section: remove "tri-state surface" language, note that recording and note generation are inline actions on one page

- [ ] **Step 5: Run all quality gates**

```bash
bun run typecheck && bun run lint && bun test
```

Expected: all PASS.

- [ ] **Step 6: Manual test — full flow**

Test the complete flow end-to-end:
1. Click "New meeting" → lands on empty editor immediately
2. Type some text → autosave works
3. Click "Record" → recording starts with status bar
4. Speak → live transcript appears
5. Click "Stop" → recording saves, "Create notes" button appears
6. Click "Create notes" → AI generates notes, button greys out
7. Edit the notes → "Improve with AI" re-enables
8. Click "Improve with AI" → AI enhances, button greys out
9. Click "Undo" → reverts AI changes
10. Verify chat bar works (⌘J, send message, [+] tray)
11. Verify transcript bubble is circular with smooth bars
12. Verify dashboard list has proper StatusDots and hover states
13. Verify auth pages have rounded-xl inputs

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(ui): auth + sidebar polish, update CLAUDE.md for Phase 3

Auth inputs use rounded-xl. Sidebar removes ThemeToggle and
fixes rounded-md. CLAUDE.md updated to reflect unified meeting
page and new entry point."
```

---

## Self-Review Checklist

**Spec coverage:**
- §1 Core Flow Redesign → Tasks 1–4 + Task 6
- §2 meeting-note-surface split → Task 5
- §3 Chat Bar Redesign → Task 8
- §4 Transcript Bubble Fix → Task 7
- §5 Dashboard List Polish → Task 9
- §6 Auth Pages → Task 10
- §7 Sidebar Cleanup → Task 10
- §8 Acceptance Criteria → Task 10 step 5+6 validates all gates

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references.

**Type consistency:** `uploadAndTranscribeMeeting` (Task 2) → used in `AudioUploader` (Task 6). `UnifiedMeetingPage` (Task 4) → used in `MeetingDetailWrapper` (Task 4). `DraftActionBarProps` (Task 5) → consumed by `meeting-note-surface.tsx` (Task 5). `UseChatSessionReturn` (Task 8) → consumed by `chat-bar.tsx` (Task 8).
