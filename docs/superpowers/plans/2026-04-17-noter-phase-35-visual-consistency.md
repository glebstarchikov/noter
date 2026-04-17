# Phase 3.5 — Visual Consistency Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all visual inconsistencies — remove `animate-ping` from the recording dot, replace hardcoded amber conflict-alert colors with Workspace tokens, and remove all `liquid-glass-*` classes from the chat composer.

**Architecture:** Three focused edits to three files. No structural changes, no new components. The rest of the app is already Workspace-aligned per the design audit. Each task is a self-contained visual fix that ships independently.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Bun test runner + Happy DOM + @testing-library/react

---

## File Map

| File | Change |
|------|--------|
| `components/recording-status-bar.tsx` | Remove `animate-ping` outer span from the recording dot — keep only the static inner dot |
| `components/note-editor-surface.tsx` | Replace amber conflict-alert colors with `bg-destructive/5 border-destructive/20 text-destructive`, replace `liquid-glass-button` with `variant="ghost"` |
| `components/chat/chat-composer.tsx` | Replace `liquid-glass-context-chip` (line 39), `liquid-glass-popover` (line 198), `liquid-glass-toolbar` (line 247) with Workspace card-surface classes |

---

## Task 1: Recording dot — calm and static

**Spec ref:** Recording zone feel → "Calm & minimal — static sage dot, no ping animation"

**Files:**
- Modify: `components/recording-status-bar.tsx:33-46`

**Context:** The recording dot currently uses two nested spans — an outer `animate-ping` span that pulses, and an inner static dot. The calm/minimal decision means we remove the ping animation entirely. The outer span goes; only the static inner dot remains.

Current code (lines 33–46):
```tsx
<span className="relative flex size-2 shrink-0">
  <span
    className={cn(
      'absolute inline-flex h-full w-full rounded-full opacity-75',
      !isPaused ? 'animate-ping bg-accent' : 'bg-muted-foreground'
    )}
  />
  <span
    className={cn(
      'relative inline-flex size-2 rounded-full',
      !isPaused ? 'bg-accent' : 'bg-muted-foreground/40'
    )}
  />
</span>
```

- [ ] **Step 1: Write the failing test**

`components/recording-status-bar.test.tsx` already exists. Add this test inside the existing `describe('RecordingStatusBar', ...)` block:

```tsx
it('recording dot has no animate-ping class', () => {
  const { container } = render(
    <RecordingStatusBar
      isPaused={false}
      isConnected={true}
      hasSystemAudio={false}
      durationLabel="01:23"
      onTogglePause={() => {}}
      onStop={() => {}}
    />
  )
  const pingSpan = container.querySelector('.animate-ping')
  expect(pingSpan).toBeNull()
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/glebstarcikov/Noter && bun test components/recording-status-bar.test.tsx
```

Expected: FAIL — `animate-ping` span is found, `pingSpan` is not null.

- [ ] **Step 3: Replace the double-span dot with a single static dot**

In `components/recording-status-bar.tsx`, replace lines 33–46:

```tsx
<span
  className={cn(
    'inline-flex size-2 shrink-0 rounded-full',
    !isPaused ? 'bg-accent' : 'bg-muted-foreground/40'
  )}
/>
```

The outer `relative flex size-2 shrink-0` wrapper span and the inner `animate-ping` span are both removed. Only the static dot remains.

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd /Users/glebstarcikov/Noter && bun test components/__tests__/recording-status-bar.test.tsx
```

Expected: PASS

- [ ] **Step 5: Run full test suite and typecheck**

```bash
cd /Users/glebstarcikov/Noter && bun test && bun run typecheck
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/glebstarcikov/Noter && git add components/recording-status-bar.tsx components/recording-status-bar.test.tsx && git commit -m "fix(ui): recording dot — remove animate-ping for calm/minimal feel"
```

---

## Task 2: Conflict alert — replace amber with Workspace tokens

**Spec ref:** Zone 3 — Editor surface, conflict alert colors

**Files:**
- Modify: `components/note-editor-surface.tsx:53-95`

**Context:** The conflict alert uses hardcoded `amber-*` Tailwind colors (not CSS variables) for background, border, and text. These need to be replaced with the Workspace `--destructive` token at low opacity. Also, the "Replace with my draft" button uses `liquid-glass-button` which is not a Workspace button variant — it should be `variant="ghost"`.

Current violations in `note-editor-surface.tsx`:
- Line 54: `rounded-2xl border-amber-300/60 bg-amber-50/80 text-amber-950` on `<Alert>`
- Line 61: `text-amber-900/80` on `<AlertDescription>`
- Line 71: `border-amber-300/70 bg-transparent shadow-none` on "Load latest" button
- Line 79: `liquid-glass-button h-8 rounded-full` on "Replace with my draft" button
- Line 88: `text-amber-900/70 shadow-none` on "Keep editing" button

- [ ] **Step 1: Write the failing tests**

Create `components/note-editor-surface.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'bun:test'
import { NoteEditorSurface } from '@/components/note-editor-surface'
import type { DocumentSaveConflict } from '@/lib/document-sync'

// Minimal meeting stub — only fields NoteEditorSurface touches
const meeting = {
  id: 'test-id',
  title: 'Test',
  status: 'done',
  user_id: 'user-1',
  created_at: new Date().toISOString(),
  transcript: null,
  diarized_transcript: null,
  document_content: null,
  audio_path: null,
  audio_duration: null,
  error_message: null,
  summary: null,
  topics: null,
  is_pinned: false,
  enhancement_state: null,
} as any

const editorSeed = { type: 'doc', content: [] } as any

const conflict: DocumentSaveConflict = {
  currentDocument: editorSeed,
  currentHash: 'abc',
  message: 'Someone else updated this note.',
}

const baseProps = {
  meeting,
  editorSeed,
  editorRevision: 0,
  editable: true,
  acknowledgedHash: 'abc',
  documentConflict: null,
  draftState: 'idle' as const,
  onEditorReady: () => {},
  onContentChange: () => {},
  onAutosaveSuccess: () => {},
  onAutosaveConflict: () => {},
  onLoadLatestVersion: () => {},
  onKeepLocalDraft: () => {},
  onDismissConflict: () => {},
}

describe('NoteEditorSurface — conflict alert', () => {
  it('uses no hardcoded amber classes', () => {
    const { container } = render(
      <NoteEditorSurface {...baseProps} documentConflict={conflict} />
    )
    const html = container.innerHTML
    expect(html).not.toContain('amber-')
    expect(html).not.toContain('liquid-glass')
  })

  it('uses destructive token for conflict background', () => {
    const { container } = render(
      <NoteEditorSurface {...baseProps} documentConflict={conflict} />
    )
    const alert = container.querySelector('[role="alert"]') ?? container.firstElementChild
    expect(alert?.className ?? container.innerHTML).toContain('destructive')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/glebstarcikov/Noter && bun test components/note-editor-surface.test.tsx
```

Expected: FAIL — `amber-` classes found in innerHTML.

- [ ] **Step 3: Replace all amber classes and the liquid-glass button**

Replace the entire `documentConflict && (...)` block in `components/note-editor-surface.tsx` (lines 53–95):

```tsx
{documentConflict && (
  <Alert className="rounded-xl border-destructive/20 bg-destructive/5 text-foreground">
    <AlertCircle className="text-destructive" />
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-1">
        <AlertTitle className="line-clamp-none">
          A newer version of this note exists
        </AlertTitle>
        <AlertDescription className="text-muted-foreground">
          {documentConflict.message}
        </AlertDescription>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLoadLatestVersion}
          className="h-8 rounded-full shadow-none"
        >
          Load latest
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onKeepLocalDraft}
          className="h-8 rounded-full shadow-none"
        >
          Replace with my draft
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDismissConflict}
          className="h-8 rounded-full shadow-none"
        >
          Keep editing
        </Button>
      </div>
    </div>
  </Alert>
)}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/glebstarcikov/Noter && bun test components/note-editor-surface.test.tsx
```

Expected: PASS

- [ ] **Step 5: Run full test suite and typecheck**

```bash
cd /Users/glebstarcikov/Noter && bun test && bun run typecheck
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/glebstarcikov/Noter && git add components/note-editor-surface.tsx components/note-editor-surface.test.tsx && git commit -m "fix(ui): conflict alert — replace amber colors with destructive token"
```

---

## Task 3: Chat composer — replace all liquid-glass classes

**Spec ref:** Zone 4 — Chat composer, three liquid-glass replacements

**Files:**
- Modify: `components/chat/chat-composer.tsx:37-43` (ContextChip component)
- Modify: `components/chat/chat-composer.tsx:196-199` (PopoverContent)
- Modify: `components/chat/chat-composer.tsx:247` (ToggleGroup)

**Context:** Three `liquid-glass-*` classes remain in the chat composer. Each maps to a Workspace card-surface replacement:
- `liquid-glass-context-chip` → `bg-secondary border-border` pill with a sage dot indicator
- `liquid-glass-popover` on `PopoverContent` → `bg-card border border-border shadow-lg rounded-xl` (remove the existing `rounded-[24px]` and `border-border/40` overrides since `PopoverContent` will get clean card styling)
- `liquid-glass-toolbar` on `ToggleGroup` → remove the class entirely; `ToggleGroup` has its own `variant="outline"` which uses card surfaces

- [ ] **Step 1: Write the failing tests**

Create `components/chat-composer.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'bun:test'
import { ChatComposer } from '@/components/chat/chat-composer'
import { createRef } from 'react'

const baseProps = {
  input: '',
  onInputChange: () => {},
  onSubmit: () => {},
  onFocus: () => {},
  isLoading: false,
  error: undefined,
  activeScope: 'meeting' as const,
  allowGlobalToggle: false,
  onScopeChange: () => {},
  model: 'claude-sonnet-4-6' as any,
  onModelChange: () => {},
  searchEnabled: false,
  onSearchToggle: () => {},
  selectedFiles: [],
  onRemoveFile: () => {},
  onFilesSelected: () => {},
  fileInputRef: createRef(),
  inputRef: createRef(),
  messagesCount: 0,
  onClearChat: () => {},
  submitDisabled: false,
}

describe('ChatComposer', () => {
  it('has no liquid-glass class names', () => {
    const { container } = render(<ChatComposer {...baseProps} />)
    expect(container.innerHTML).not.toContain('liquid-glass')
  })

  it('context chip uses card surface classes when files are selected', () => {
    const { container } = render(
      <ChatComposer
        {...baseProps}
        selectedFiles={[new File([''], 'test.pdf', { type: 'application/pdf' })]}
      />
    )
    // The context chip should use bg-secondary not liquid-glass
    expect(container.innerHTML).not.toContain('liquid-glass-context-chip')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/glebstarcikov/Noter && bun test components/chat-composer.test.tsx
```

Expected: FAIL — `liquid-glass-context-chip` found in innerHTML.

- [ ] **Step 3a: Replace ContextChip component (lines 37–43)**

Replace the `ContextChip` function at the top of `components/chat/chat-composer.tsx`:

```tsx
function ContextChip({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 shrink-0 rounded-full bg-accent" />
      {label}
    </div>
  )
}
```

- [ ] **Step 3b: Replace PopoverContent classes (lines 196–199)**

Replace the `PopoverContent` opening tag:

```tsx
// Before:
<PopoverContent
  align="start"
  className="liquid-glass-popover w-[18rem] rounded-[24px] border-border/40 p-4"
>
// After:
<PopoverContent
  align="start"
  className="w-[18rem] rounded-xl border border-border bg-card p-4 shadow-lg"
>
```

- [ ] **Step 3c: Replace ToggleGroup class (line 247)**

Replace the `ToggleGroup` opening tag:

```tsx
// Before:
<ToggleGroup
  type="single"
  variant="outline"
  size="sm"
  value={...}
  onValueChange={...}
  aria-label="Chat scope"
  className="liquid-glass-toolbar w-full"
>
// After:
<ToggleGroup
  type="single"
  variant="outline"
  size="sm"
  value={activeScope === "meeting" ? "meeting" : "global"}
  onValueChange={(value) => {
    if (value === "meeting" || value === "global") {
      onScopeChange(value);
    }
  }}
  aria-label="Chat scope"
  className="w-full"
>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/glebstarcikov/Noter && bun test components/chat-composer.test.tsx
```

Expected: PASS

- [ ] **Step 5: Run full test suite and typecheck**

```bash
cd /Users/glebstarcikov/Noter && bun test && bun run typecheck
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/glebstarcikov/Noter && git add components/chat/chat-composer.tsx components/chat-composer.test.tsx && git commit -m "fix(ui): chat composer — replace liquid-glass with card surfaces"
```

---

## Task 4: Final acceptance check

**Spec ref:** Acceptance Criteria

- [ ] **Step 1: Verify zero liquid-glass classes remain in chat composer and note-editor-surface**

```bash
cd /Users/glebstarcikov/Noter && grep -rn "liquid-glass" components/chat/chat-composer.tsx components/note-editor-surface.tsx
```

Expected: no output (zero matches).

- [ ] **Step 2: Verify zero amber color classes remain**

```bash
cd /Users/glebstarcikov/Noter && grep -rn "amber-" components/
```

Expected: no output.

- [ ] **Step 3: Verify no animate-ping in recording status bar**

```bash
cd /Users/glebstarcikov/Noter && grep -n "animate-ping" components/recording-status-bar.tsx
```

Expected: no output.

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/glebstarcikov/Noter && bun test
```

Expected: 245+ tests pass, 0 fail.

- [ ] **Step 5: Run lint and typecheck**

```bash
cd /Users/glebstarcikov/Noter && bun run lint && bun run typecheck
```

Expected: no errors or warnings.

- [ ] **Step 6: Commit if any stray fixes were needed**

```bash
cd /Users/glebstarcikov/Noter && git add -p && git commit -m "fix(ui): final visual consistency cleanup"
```

Only commit if there were stray fixes. If the grep checks were all clean, skip this step.
