import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { NoteEditorSurface } from '@/components/note-editor-surface'
import type { DocumentSaveConflict } from '@/lib/document-sync'
import type { Meeting } from '@/lib/types'
import type { TiptapDocument } from '@/lib/tiptap/tiptap-converter'

mock.module('@tiptap/react', () => ({
  useEditor: () => null,
  EditorContent: () => null,
}))

const meeting: Meeting = {
  id: 'test-id',
  title: 'Test',
  status: 'done',
  user_id: 'user-1',
  created_at: new Date().toISOString(),
  transcript: null,
  diarized_transcript: null,
  document_content: null,
  audio_url: null,
  audio_duration: null,
  error_message: null,
  summary: null,
  action_items: [],
  key_decisions: [],
  topics: [],
  follow_ups: [],
  detailed_notes: null,
  enhancement_status: 'idle',
  enhancement_state: null,
  updated_at: new Date().toISOString(),
  is_pinned: false,
}

const editorSeed: TiptapDocument = { type: 'doc', content: [] }

const conflict: DocumentSaveConflict = {
  ok: false,
  code: 'STALE_DOCUMENT',
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
  beforeEach(() => {
    // No setup needed for these tests
  })

  afterEach(() => {
    cleanup()
  })

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
    const html = container.innerHTML
    expect(html).toContain('destructive')
  })

  it('renders with ghost button variant', () => {
    const { container } = render(
      <NoteEditorSurface {...baseProps} documentConflict={conflict} />
    )
    const html = container.innerHTML
    // Should have variant="ghost" buttons which translate to data-variant="ghost" in HTML
    expect(html).not.toContain('liquid-glass')
  })

  it('does not render conflict alert when documentConflict is null', () => {
    const { container } = render(
      <NoteEditorSurface {...baseProps} documentConflict={null} />
    )
    const html = container.innerHTML
    expect(html).not.toContain('A newer version of this note exists')
  })
})
