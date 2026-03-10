import { beforeAll, beforeEach, describe, expect, it, mock, jest } from 'bun:test'
import { hashDocumentContent } from '@/lib/document-hash'
import {
  MAX_ENHANCEMENT_DOCUMENT_CHARS,
  MAX_ENHANCEMENT_STRUCTURED_CHARS,
  MAX_ENHANCEMENT_TRANSCRIPT_CHARS,
} from '@/lib/enhancement-context'
import type { TiptapDocument } from '@/lib/tiptap-converter'

const mockCompletionCreate = mock(() => {})

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

mock.module('@/lib/openai', () => ({
  getOpenAI: mock(() => ({
    chat: {
      completions: {
        create: mockCompletionCreate,
      },
    },
  })),
}))

let POST: typeof import('./route').POST
let createClient: typeof import('@/lib/supabase/server').createClient

beforeAll(async () => {
  const routeModule = await import('./route')
  const supabaseModule = await import('@/lib/supabase/server')

  POST = routeModule.POST
  createClient = supabaseModule.createClient
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/meetings/meeting-1/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDocument(text: string): TiptapDocument {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

function makeMeeting(overrides: Record<string, unknown> = {}) {
  return {
    id: 'meeting-1',
    user_id: 'user-1',
    title: 'Weekly sync',
    audio_url: null,
    audio_duration: 120,
    transcript: 'Alice shared updates. Bob owns the follow-up.',
    summary: 'Weekly project sync',
    action_items: [{ task: 'Follow up', owner: 'Bob', done: false }],
    key_decisions: ['Ship on Friday'],
    topics: ['Roadmap'],
    follow_ups: ['Share the deck'],
    detailed_notes: 'Detailed notes',
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

function buildMeetingsSelect(meetingData: unknown) {
  const single = mock(() => Promise.resolve({ data: meetingData }))
  const eqUser = mock(() => ({ single }))
  const eqId = mock(() => ({ eq: eqUser }))
  return mock(() => ({ eq: eqId }))
}

function buildNoteTemplatesSelect(templateData: unknown = null) {
  const maybeSingle = mock(() => Promise.resolve({ data: templateData, error: null }))
  const eqUser = mock(() => ({ maybeSingle }))
  const eqId = mock(() => ({ eq: eqUser }))
  return mock(() => ({ eq: eqId }))
}

function mockSupabase({
  user,
  meetingData = null,
  templateData = null,
}: {
  user: { id: string } | null
  meetingData?: unknown
  templateData?: unknown
}) {
  const updateCalls: unknown[] = []
  const updateMock = mock((payload: unknown) => {
    updateCalls.push(payload)
    const eqUser = mock(() => Promise.resolve({ error: null }))
    const eqId = mock(() => ({ eq: eqUser }))
    return { eq: eqId }
  })

  const from = mock((table: string) => {
    if (table === 'meetings') {
      return {
        select: buildMeetingsSelect(meetingData),
        update: updateMock,
      }
    }

    if (table === 'note_templates') {
      return {
        select: buildNoteTemplatesSelect(templateData),
      }
    }

    throw new Error(`Unexpected table ${table}`)
  })

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from,
  }

  ;(createClient as any).mockResolvedValue(supabaseMock as never)
  return { from, updateCalls }
}

describe('POST /api/meetings/[id]/enhance', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockCompletionCreate as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Tightens the next steps.',
              proposed_document_content: makeDocument('Typed note from the user with clear next steps.'),
            }),
          },
        },
      ],
    })
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase({ user: null })

    const response = await POST(makeRequest({
      action: 'generate',
      mode: 'enhance',
      documentContent: makeDocument('Typed note from the user'),
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  })

  it('returns 400 for invalid request bodies', async () => {
    mockSupabase({ user: { id: 'user-1' } })

    const response = await POST(makeRequest({ action: 'launch' }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: 'Invalid request body',
      code: 'INVALID_REQUEST',
    })
  })

  it('returns 400 when transcript is missing', async () => {
    mockSupabase({ user: { id: 'user-1' }, meetingData: makeMeeting({ transcript: '   ' }) })

    const response = await POST(makeRequest({
      action: 'generate',
      mode: 'enhance',
      documentContent: makeDocument('Typed note from the user'),
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: 'Transcript is required before generating note drafts',
      code: 'MISSING_TRANSCRIPT',
    })
  })

  it('returns a first draft for an empty note without writing meeting state', async () => {
    const { updateCalls } = mockSupabase({
      user: { id: 'user-1' },
      meetingData: makeMeeting({
        document_content: {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        },
      }),
    })

    const response = await POST(makeRequest({
      action: 'generate',
      mode: 'generate',
      documentContent: {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      },
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(200)
    expect(updateCalls).toHaveLength(0)

    const payload = await response.json()
    expect(payload.mode).toBe('generate')
    expect(payload.proposedDocument).toEqual(makeDocument('Typed note from the user with clear next steps.'))
  })

  it('returns a refinement proposal for a populated note and uses template context softly', async () => {
    mockSupabase({
      user: { id: 'user-1' },
      meetingData: makeMeeting({ template_id: 'one-on-one' }),
    })

    const currentDocument = makeDocument('Typed note from the user')
    const response = await POST(makeRequest({
      action: 'generate',
      mode: 'enhance',
      documentContent: currentDocument,
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(200)

    const completionCall = (mockCompletionCreate as any).mock.calls[0][0]
    expect(completionCall.messages[0].content).toContain('Preserve the user\'s structure and tone whenever possible')
    expect(completionCall.messages[0].content).toContain('Selected note format: 1:1 Meeting')

    const payload = await response.json()
    expect(payload.sourceHash).toBe(hashDocumentContent(currentDocument))
  })

  it('truncates long draft context before prompting the model', async () => {
    mockSupabase({
      user: { id: 'user-1' },
      meetingData: makeMeeting({
        transcript: 't'.repeat(MAX_ENHANCEMENT_TRANSCRIPT_CHARS + 200),
        detailed_notes: 'n'.repeat(MAX_ENHANCEMENT_STRUCTURED_CHARS + 200),
        summary: 's'.repeat(300),
      }),
    })

    const response = await POST(makeRequest({
      action: 'generate',
      mode: 'enhance',
      documentContent: makeDocument('x'.repeat(MAX_ENHANCEMENT_DOCUMENT_CHARS + 200)),
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(200)

    const completionCall = (mockCompletionCreate as any).mock.calls[0][0]
    expect(completionCall.messages[0].content).toContain(
      `[Current note truncated to ${MAX_ENHANCEMENT_DOCUMENT_CHARS} characters]`
    )
    expect(completionCall.messages[0].content).toContain(
      `[Structured metadata truncated to ${MAX_ENHANCEMENT_STRUCTURED_CHARS} characters]`
    )
    expect(completionCall.messages[0].content).toContain(
      `[Transcript truncated to ${MAX_ENHANCEMENT_TRANSCRIPT_CHARS} characters]`
    )
  })

  it('returns NO_USEFUL_CHANGES and persists the generate failure state', async () => {
    const sourceDocument = makeDocument('Typed note from the user')
    const { updateCalls } = mockSupabase({
      user: { id: 'user-1' },
      meetingData: makeMeeting({
        document_content: sourceDocument,
      }),
    })

    ;(mockCompletionCreate as any).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'No change',
              proposed_document_content: sourceDocument,
            }),
          },
        },
      ],
    })

    const response = await POST(makeRequest({
      action: 'generate',
      mode: 'enhance',
      documentContent: sourceDocument,
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: 'No useful changes were proposed',
      code: 'NO_USEFUL_CHANGES',
    })
    expect(updateCalls).toHaveLength(1)
    expect((updateCalls[0] as Record<string, unknown>).enhancement_status).toBe('error')
    expect(
      ((updateCalls[0] as Record<string, unknown>).enhancement_state as Record<string, unknown>)
        .lastError
    ).toBe('No useful changes were proposed')
  })

  it('returns INVALID_PROPOSAL and persists the generate failure state', async () => {
    const { updateCalls } = mockSupabase({
      user: { id: 'user-1' },
      meetingData: makeMeeting(),
    })

    ;(mockCompletionCreate as any).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Broken proposal',
              proposed_document_content: { type: 'paragraph' },
            }),
          },
        },
      ],
    })

    const response = await POST(makeRequest({
      action: 'generate',
      mode: 'enhance',
      documentContent: makeDocument('Typed note from the user'),
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({
      error: 'AI returned an invalid draft proposal',
      code: 'INVALID_PROPOSAL',
    })
    expect(updateCalls).toHaveLength(1)
    expect((updateCalls[0] as Record<string, unknown>).enhancement_status).toBe('error')
  })

  it('persists accepted reviews and records lightweight enhancement metadata', async () => {
    const sourceDocument = makeDocument('Typed note from the user')
    const acceptedDocument = makeDocument('Typed note from the user with clear next steps.')
    const { updateCalls } = mockSupabase({
      user: { id: 'user-1' },
      meetingData: makeMeeting({
        document_content: sourceDocument,
      }),
    })

    const response = await POST(makeRequest({
      action: 'complete',
      outcome: 'accepted',
      sourceHash: hashDocumentContent(sourceDocument),
      documentContent: acceptedDocument,
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(200)
    expect(updateCalls).toHaveLength(1)

    const updatePayload = updateCalls[0] as Record<string, unknown>
    expect(updatePayload.document_content).toEqual(acceptedDocument)
    expect(updatePayload.enhancement_status).toBe('idle')
    expect((updatePayload.enhancement_state as Record<string, unknown>).lastOutcome).toBe('accepted')

    const payload = await response.json()
    expect(payload.document_content).toEqual(acceptedDocument)
    expect(payload.enhancement_state.lastReviewedSourceHash).toBe(hashDocumentContent(acceptedDocument))
    expect(payload.documentHash).toBe(hashDocumentContent(acceptedDocument))
  })

  it('records dismissals without changing document_content', async () => {
    const sourceDocument = makeDocument('Typed note from the user')
    const { updateCalls } = mockSupabase({
      user: { id: 'user-1' },
      meetingData: makeMeeting({
        document_content: sourceDocument,
      }),
    })

    const response = await POST(makeRequest({
      action: 'complete',
      outcome: 'dismissed',
      sourceHash: hashDocumentContent(sourceDocument),
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(200)
    expect(updateCalls).toHaveLength(1)

    const updatePayload = updateCalls[0] as Record<string, unknown>
    expect(updatePayload.document_content).toBeUndefined()
    expect((updatePayload.enhancement_state as Record<string, unknown>).lastOutcome).toBe('dismissed')
  })

  it('rejects stale source hashes', async () => {
    const sourceDocument = makeDocument('Typed note from the user')

    mockSupabase({
      user: { id: 'user-1' },
      meetingData: makeMeeting({
        document_content: sourceDocument,
      }),
    })

    const response = await POST(makeRequest({
      action: 'complete',
      outcome: 'accepted',
      sourceHash: 'stale-hash',
      documentContent: makeDocument('Updated note'),
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: 'The note changed before this review was completed',
      code: 'STALE_SOURCE_HASH',
    })
  })

  it('stores enhancement error metadata when completing a review fails', async () => {
    const sourceDocument = makeDocument('Typed note from the user')
    const failingUpdate = mock(() => {
      const eqUser = mock(() => Promise.resolve({ error: { message: 'DB unavailable' } }))
      const eqId = mock(() => ({ eq: eqUser }))
      return { eq: eqId }
    })
    const failureStateMeeting = makeMeeting({
      document_content: sourceDocument,
      enhancement_state: {
        lastReviewedSourceHash: null,
        lastOutcome: null,
        lastReviewedAt: null,
        lastError: null,
      },
    })

    const meetingsSelect = buildMeetingsSelect(failureStateMeeting)
    const noteTemplatesSelect = buildNoteTemplatesSelect(null)
    const updateCalls: unknown[] = []

    const from = mock((table: string) => {
      if (table === 'meetings') {
        return {
          select: meetingsSelect,
          update: mock((payload: unknown) => {
            updateCalls.push(payload)
            if (updateCalls.length === 1) {
              return failingUpdate()
            }

            const eqUser = mock(() => Promise.resolve({ error: null }))
            const eqId = mock(() => ({ eq: eqUser }))
            return { eq: eqId }
          }),
        }
      }

      if (table === 'note_templates') {
        return {
          select: noteTemplatesSelect,
        }
      }

      throw new Error(`Unexpected table ${table}`)
    })

    ;(createClient as any).mockResolvedValue({
      auth: { getUser: mock(() => Promise.resolve({ data: { user: { id: 'user-1' } } })) },
      from,
    } as never)

    const response = await POST(makeRequest({
      action: 'complete',
      outcome: 'accepted',
      sourceHash: hashDocumentContent(sourceDocument),
      documentContent: makeDocument('Updated note'),
    }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      error: 'DB unavailable',
      code: 'ENHANCEMENT_FAILED',
    })
    expect((updateCalls[1] as Record<string, unknown>).enhancement_status).toBe('error')
    expect(((updateCalls[1] as Record<string, unknown>).enhancement_state as Record<string, unknown>).lastError).toBe('DB unavailable')
  })
})
