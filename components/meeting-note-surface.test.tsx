import React, { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { hashDocumentContent } from '@/lib/document-hash'
import type { TiptapDocument } from '@/lib/tiptap-converter'
import type { Meeting } from '@/lib/types'

const refreshMock = mock(() => {})

mock.module('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}))

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
    editable,
  }: {
    documentContent: ReturnType<typeof makeDocument>
    onContentChange?: (document: ReturnType<typeof makeDocument>) => void
    editable?: boolean
  }) => {
    const onContentChangeRef = useRef(onContentChange)

    useEffect(() => {
      onContentChangeRef.current = onContentChange
    }, [onContentChange])

    useEffect(() => {
      onContentChangeRef.current?.(documentContent)
    }, [documentContent])

    return (
      <div data-testid="mock-editor" data-editable={editable ? 'yes' : 'no'}>
        <button
          type="button"
          onClick={() => onContentChange?.(makeDocument('User added a note'))}
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
  beforeEach(() => {
    refreshMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows Generate notes for an empty editor and Enhance for a populated one', () => {
    const emptyMeeting = makeMeeting({ document_content: null })
    const populatedMeeting = makeMeeting()

    const { rerender } = render(<MeetingNoteSurface meeting={emptyMeeting} />)
    expect(screen.getByRole('button', { name: /generate notes/i })).not.toBeNull()

    rerender(<MeetingNoteSurface meeting={populatedMeeting} />)
    expect(screen.getByRole('button', { name: /enhance/i })).not.toBeNull()
  })

  it('shows inline loading and review controls without a fixed overlay', async () => {
    let resolveGenerate: ((response: Response) => void) | undefined

    globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/document')) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      }

      if (url.endsWith('/enhance')) {
        const payload = JSON.parse(String(init?.body ?? '{}'))
        if (payload.action === 'generate') {
          return new Promise<Response>((resolve) => {
            resolveGenerate = resolve
          })
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    const { container } = render(<MeetingNoteSurface meeting={makeMeeting()} />)

    fireEvent.click(screen.getByRole('button', { name: /enhance/i }))

    expect(screen.getByText(/Drafting one inline improvement/i)).not.toBeNull()
    expect(container.querySelector('.fixed')).toBeNull()

    await waitFor(() => {
      expect(resolveGenerate).toBeDefined()
    })

    resolveGenerate!(
      new Response(JSON.stringify({
        sourceHash: hashDocumentContent(makeDocument('Typed note from the user')),
        summary: 'Improves the note',
        mode: 'enhance',
        proposedDocument: makeDocument('Typed note from the user with clear next steps.'),
      }), { status: 200 })
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept all/i })).not.toBeNull()
      expect(screen.getByRole('button', { name: /reject all/i })).not.toBeNull()
    })
  })

  it('hides the CTA after a dismissed review and shows it again once the note changes', async () => {
    const emptyDocument: TiptapDocument = {
      type: 'doc' as const,
      content: [{ type: 'paragraph' as const }],
    }
    const dismissedState = {
      lastReviewedSourceHash: hashDocumentContent(emptyDocument),
      lastOutcome: 'dismissed' as const,
      lastReviewedAt: '2026-03-10T09:00:00.000Z',
      lastError: null,
    }

    globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/document')) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      }

      if (url.endsWith('/enhance')) {
        const payload = JSON.parse(String(init?.body ?? '{}'))

        if (payload.action === 'generate') {
          return Promise.resolve(new Response(JSON.stringify({
            sourceHash: hashDocumentContent(emptyDocument),
            summary: 'Drafts a first note',
            mode: 'generate',
            proposedDocument: makeDocument('Generated draft'),
          }), { status: 200 }))
        }

        if (payload.action === 'complete') {
          return Promise.resolve(new Response(JSON.stringify({
            ok: true,
            enhancement_state: dismissedState,
            document_content: emptyDocument,
          }), { status: 200 }))
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    const { rerender } = render(<MeetingNoteSurface meeting={makeMeeting({ document_content: null })} />)

    fireEvent.click(screen.getByRole('button', { name: /generate notes/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reject all/i })).not.toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: /reject all/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /generate notes/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /enhance/i })).toBeNull()
    })

    rerender(
      <MeetingNoteSurface
        meeting={makeMeeting({
          document_content: makeDocument('User added a note'),
          enhancement_state: dismissedState,
        })}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enhance/i })).not.toBeNull()
    })
  })
})
