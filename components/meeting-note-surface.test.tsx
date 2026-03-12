import React, { useEffect, useRef } from 'react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { hashDocumentContent } from '@/lib/document-hash'
import { ENHANCEMENT_NO_USEFUL_CHANGES_MESSAGE } from '@/lib/enhancement-errors'
import type { TiptapDocument } from '@/lib/tiptap-converter'
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

    // Simulate real Tiptap: fire onContentChange once on mount, not on every prop change.
    // The real editor only fires onContentChange via the 'update' event (user edits or
    // setContent with emitUpdate:true), not when the documentContent prop changes.
    useEffect(() => {
      onContentChangeRef.current?.(documentContent)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Provide a mock editor instance via onEditorReady so streaming can proceed
    useEffect(() => {
      if (!onEditorReady) return
      const mockEditor = {
        commands: {
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
    template_id: null,
    diarized_transcript: null,
    enhancement_status: 'idle',
    enhancement_state: null,
    created_at: '2026-03-10T08:00:00.000Z',
    updated_at: '2026-03-10T08:00:00.000Z',
    ...overrides,
  }
}

describe('MeetingNoteSurface', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows Improve with AI button for both empty and populated editors', () => {
    const emptyMeeting = makeMeeting({ document_content: null })
    const populatedMeeting = makeMeeting({
      id: 'meeting-2',
      document_content: makeDocument('Typed note from the user'),
    })

    const { rerender } = render(<MeetingNoteSurface meeting={emptyMeeting} />)
    expect(screen.getByRole('button', { name: /improve with ai/i })).not.toBeNull()

    rerender(<MeetingNoteSurface meeting={populatedMeeting} />)
    expect(screen.getByRole('button', { name: /improve with ai/i })).not.toBeNull()
  })

  it('streams AI content into the editor and shows undo chip when done', async () => {
    let resolveGenerate: ((response: Response) => void) | undefined

    const baseDocHash = hashDocumentContent(makeDocument('Typed note from the user'))

    globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

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
                documentHash: hashDocumentContent(makeDocument('Typed note from the user with clear next steps.')),
              }),
              { status: 200 }
            )
          )
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    const { container } = render(<MeetingNoteSurface meeting={makeMeeting()} />)

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

  it('hides the CTA after AI drafting and shows it again once the note changes', async () => {
    const emptyDocument: TiptapDocument = {
      type: 'doc' as const,
      content: [{ type: 'paragraph' as const }],
    }
    const emptyDocHash = hashDocumentContent(emptyDocument)
    const proposedDoc = makeDocument('Generated draft')
    const proposedDocHash = hashDocumentContent(proposedDoc)

    globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/document')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ ok: true, documentHash: emptyDocHash }),
            { status: 200 }
          )
        )
      }

      if (url.endsWith('/enhance')) {
        const payload = JSON.parse(String(init?.body ?? '{}'))

        if (payload.action === 'generate') {
          return Promise.resolve(new Response(JSON.stringify({
            sourceHash: emptyDocHash,
            summary: 'Drafts a first note',
            mode: 'generate',
            proposedDocument: proposedDoc,
          }), { status: 200 }))
        }

        if (payload.action === 'complete') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                enhancement_state: {
                  lastReviewedSourceHash: emptyDocHash,
                  lastOutcome: 'accepted',
                  lastReviewedAt: '2026-03-10T09:00:00.000Z',
                  lastError: null,
                },
                document_content: proposedDoc,
                documentHash: proposedDocHash,
              }),
              { status: 200 }
            )
          )
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render(<MeetingNoteSurface meeting={makeMeeting({ document_content: null, summary: null, detailed_notes: null })} />)

    fireEvent.click(screen.getByRole('button', { name: /improve with ai/i }))

    // After streaming + saving, the undo chip appears and the improve button is disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /undo/i })).not.toBeNull()
      const improveBtn = screen.getByRole('button', { name: /improve with ai/i })
      expect(improveBtn.hasAttribute('disabled')).toBe(true)
    })

    // Simulate a user edit — improve button re-enables, undo chip disappears
    fireEvent.click(screen.getByRole('button', { name: /simulate edit/i }))

    await waitFor(() => {
      const improveBtn = screen.getByRole('button', { name: /improve with ai/i })
      expect(improveBtn.hasAttribute('disabled')).toBe(false)
      expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
    })
  })

  it('renders no useful changes as neutral inline feedback instead of a destructive failure', async () => {
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = String(input)

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

    fireEvent.click(screen.getByRole('button', { name: /improve with ai/i }))

    await waitFor(() => {
      expect(screen.getByText(/No changes suggested/i)).not.toBeNull()
    })
  })
})
