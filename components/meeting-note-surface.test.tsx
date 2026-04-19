import React, { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { hashDocumentContent } from '@/lib/document-hash'
import { ENHANCEMENT_NO_USEFUL_CHANGES_MESSAGE } from '@/lib/notes/enhancement-errors'
import type { TiptapDocument } from '@/lib/tiptap/tiptap-converter'
import type { Meeting } from '@/lib/types'

function makeDocument(text: string): TiptapDocument {
  return {
    type: 'doc' as const,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

mock.module('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}))

mock.module('@/components/meeting-editor', () => ({
  MeetingEditor: ({
    documentContent,
    onContentChange,
    onEditorReady,
    editable,
  }: {
    documentContent: ReturnType<typeof makeDocument>
    onContentChange?: (document: ReturnType<typeof makeDocument>) => void
    onEditorReady?: (editor: unknown) => void
    editable?: boolean
  }) => {
    const onContentChangeRef = useRef(onContentChange)

    useEffect(() => {
      onContentChangeRef.current = onContentChange
    }, [onContentChange])

    useEffect(() => {
      onContentChangeRef.current?.(documentContent)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      if (!onEditorReady) return
      const mockEditor = {
        commands: {
          focus: () => true,
          setContent: () => true,
        },
      }
      onEditorReady(mockEditor)
      return () => onEditorReady(null)
    }, [onEditorReady])

    return (
      <div data-testid="mock-editor" data-editable={editable ? 'yes' : 'no'}>
        <button
          type="button"
          onClick={() => onContentChangeRef.current?.(makeDocument('User added a note'))}
        >
          Simulate edit
        </button>
        <span>{documentContent.content[0]?.content?.[0]?.text ?? 'Empty note'}</span>
      </div>
    )
  },
}))

const { MeetingNoteSurface } = await import('./meeting-note-surface')

function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'meeting-1',
    user_id: 'user-1',
    title: 'Weekly sync',
    audio_url: null,
    audio_duration: 120,
    transcript: 'Transcript text',
    summary: 'Summary',
    action_items: [],
    key_decisions: [],
    topics: [],
    follow_ups: [],
    detailed_notes: '',
    status: 'done',
    error_message: null,
    is_pinned: false,
    document_content: makeDocument('Typed note from the user'),
    diarized_transcript: null,
    enhancement_status: 'idle',
    enhancement_state: null,
    created_at: '2026-03-10T08:00:00.000Z',
    updated_at: '2026-03-10T08:00:00.000Z',
    ...overrides,
  }
}

const FAKE_TEMPLATES_RESPONSE = new Response(
  JSON.stringify({
    templates: [{ id: 'builtin-general', name: 'General', description: '', prompt: 'p', isBuiltin: true }],
    defaultTemplateId: 'builtin-general',
  }),
  { status: 200 }
)

describe('MeetingNoteSurface', () => {
  beforeEach(() => {
    // Default fetch: handle /api/templates so useTemplates doesn't throw.
    // Individual tests that need to intercept /enhance or /document override globalThis.fetch.
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      if (String(input).includes('/api/templates')) {
        return Promise.resolve(FAKE_TEMPLATES_RESPONSE.clone())
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`))
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    cleanup()
  })

  it('shows state-based AI actions for empty and populated notes', async () => {
    const emptyMeeting = makeMeeting({
      document_content: null,
      summary: null,
      detailed_notes: null,
    })
    const populatedMeeting = makeMeeting({
      id: 'meeting-2',
      document_content: makeDocument('Typed note from the user'),
    })

    const { rerender } = render(<MeetingNoteSurface meeting={emptyMeeting} />)

    // Empty meeting with a transcript shows "Create notes with:"; no auto-gen or improve button
    expect(screen.queryByRole('button', { name: /generate notes with ai/i })).toBeNull()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create notes with/i })).not.toBeNull()
    })
    expect(screen.queryByRole('button', { name: /improve with ai/i })).toBeNull()

    rerender(<MeetingNoteSurface meeting={populatedMeeting} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /improve with ai/i })).not.toBeNull()
    })
  })

  it('streams AI content into the editor and shows undo chip when done', async () => {
    let resolveGenerate: ((response: Response) => void) | undefined

    const baseDocHash = hashDocumentContent(makeDocument('Typed note from the user'))

    globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/templates')) {
        return Promise.resolve(FAKE_TEMPLATES_RESPONSE.clone())
      }

      if (url.endsWith('/document')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ ok: true, documentHash: baseDocHash }),
            { status: 200 }
          )
        )
      }

      if (url.endsWith('/enhance')) {
        const payload = JSON.parse(String(init?.body ?? '{}'))

        if (payload.action === 'generate') {
          return new Promise<Response>((resolve) => {
            resolveGenerate = resolve
          })
        }

        if (payload.action === 'complete') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                enhancement_state: {
                  lastReviewedSourceHash: baseDocHash,
                  lastOutcome: 'accepted',
                  lastReviewedAt: '2026-03-10T09:00:00.000Z',
                  lastError: null,
                },
                document_content: makeDocument('Typed note from the user with clear next steps.'),
                documentHash: hashDocumentContent(
                  makeDocument('Typed note from the user with clear next steps.')
                ),
              }),
              { status: 200 }
            )
          )
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    const { container } = render(<MeetingNoteSurface meeting={makeMeeting()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /improve with ai/i })).not.toBeNull()
    })
    fireEvent.click(screen.getByRole('button', { name: /improve with ai/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /improving/i })).not.toBeNull()
    })
    expect(container.querySelector('.fixed')).toBeNull()

    await waitFor(() => {
      expect(resolveGenerate).toBeDefined()
    })

    resolveGenerate!(
      new Response(JSON.stringify({
        sourceHash: baseDocHash,
        summary: 'Improves the note',
        mode: 'enhance',
        proposedDocument: makeDocument('Typed note from the user with clear next steps.'),
      }), { status: 200 })
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /undo/i })).not.toBeNull()
    })
  })

  it('renders no useful changes as neutral inline feedback instead of a destructive failure', async () => {
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/templates')) {
        return Promise.resolve(FAKE_TEMPLATES_RESPONSE.clone())
      }

      if (url.endsWith('/document')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              documentHash: hashDocumentContent(makeDocument('Typed note from the user')),
            }),
            { status: 200 }
          )
        )
      }

      if (url.endsWith('/enhance')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: ENHANCEMENT_NO_USEFUL_CHANGES_MESSAGE,
              code: 'NO_USEFUL_CHANGES',
            }),
            { status: 409 }
          )
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render(<MeetingNoteSurface meeting={makeMeeting()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /improve with ai/i })).not.toBeNull()
    })
    fireEvent.click(screen.getByRole('button', { name: /improve with ai/i }))

    await waitFor(() => {
      expect(screen.getByText(/no changes suggested/i)).not.toBeNull()
    })
  })
})
