import { describe, it, expect, beforeEach, mock, jest } from 'bun:test'

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

mock.module('@upstash/ratelimit', () => ({
  Ratelimit: mock(() => {}),
}))

mock.module('@upstash/redis', () => ({
  Redis: { fromEnv: mock(() => {}) },
}))

const { POST } = await import('./route')
const { createClient } = await import('@/lib/supabase/server')
const { NextRequest } = await import('next/server')

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/generate-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingData: unknown = null) {
  const updateCalls: unknown[] = []
  const updateEqUsers: ReturnType<typeof mock>[] = []

  const updateMock = mock((payload: unknown) => {
    updateCalls.push(payload)

    const eqUser = mock(() => Promise.resolve({ error: null }))
    const eqId = mock(() => ({ eq: eqUser }))
    updateEqUsers.push(eqUser)

    return { eq: eqId }
  })

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from: mock(() => ({
      select: mock(() => ({
        eq: mock(() => ({
          eq: mock(() => ({
            single: mock(() => Promise.resolve({ data: meetingData })),
          })),
        })),
      })),
      update: updateMock,
    })),
  }

  ;(createClient as typeof createClient & { mockResolvedValue: (value: unknown) => void })
    .mockResolvedValue(supabaseMock)

  return { updateCalls, updateEqUsers }
}

describe('POST /api/generate-notes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockCompletionCreate as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: 'Weekly sync',
              summary: 'Summary text',
              detailed_notes: '## Notes\n- Follow up with finance',
              action_items: [{ task: 'Do X', owner: 'Alice', done: false }],
              key_decisions: ['Ship'],
              topics: ['Planning'],
              follow_ups: ['Review PR'],
            }),
          },
        },
      ],
    })
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const res = await POST(makeRequest({ meetingId: 'id' }))
    expect(res.status).toBe(401)
    const payload = await res.json()
    expect(payload.error).toBe('Unauthorized')
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 for malformed payload', async () => {
    mockSupabase({ id: 'user-1' })
    const res = await POST(makeRequest({ transcript: 'text' }))
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error).toBe('Invalid request body')
    expect(payload.code).toBe('INVALID_REQUEST')
  })

  it('returns 404 if meeting is not found', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const res = await POST(makeRequest({ meetingId: 'bad-id' }))
    expect(res.status).toBe(404)
    const payload = await res.json()
    expect(payload.error).toBe('Meeting not found')
    expect(payload.code).toBe('MEETING_NOT_FOUND')
  })

  it('returns 400 if transcript is missing in DB and request', async () => {
    mockSupabase({ id: 'user-1' }, { id: 'meeting-1', transcript: null, document_content: null })
    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error).toBe('Missing transcript')
    expect(payload.code).toBe('MISSING_TRANSCRIPT')
  })

  it('merges existing document_content with generated notes and applies ownership filter on updates', async () => {
    const typedNotesDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Typed note from recording' }],
        },
      ],
    }

    const { updateCalls, updateEqUsers } = mockSupabase(
      { id: 'user-1' },
      { id: 'meeting-1', transcript: 'Transcript from DB', document_content: typedNotesDocument }
    )

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(200)
    expect(mockCompletionCreate).toHaveBeenCalled()
    expect(updateEqUsers[0]).toHaveBeenCalledWith('user_id', 'user-1')

    const finalUpdate = updateCalls[1] as {
      document_content: {
        type: string
        content: Array<{ type: string; attrs?: Record<string, unknown>; content?: unknown[] }>
      }
      status: string
    }

    expect(finalUpdate.status).toBe('done')
    expect(finalUpdate.document_content.type).toBe('doc')
    expect(finalUpdate.document_content.content[0]).toEqual(typedNotesDocument.content[0])
    expect(finalUpdate.document_content.content).toContainEqual({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Summary' }],
    })
    expect(finalUpdate.document_content.content).toContainEqual({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Action Items' }],
    })
  })

  it('persists meeting error state when note generation throws', async () => {
    ;(mockCompletionCreate as unknown as { mockRejectedValueOnce: (value: unknown) => void })
      .mockRejectedValueOnce(new Error('OpenAI unavailable'))

    const { updateCalls } = mockSupabase(
      { id: 'user-1' },
      { id: 'meeting-1', transcript: 'Transcript from DB', document_content: null }
    )

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(500)

    const payload = await res.json()
    expect(payload.error).toBe('OpenAI unavailable')
    expect(payload.code).toBe('NOTES_GENERATION_FAILED')

    const errorUpdate = updateCalls[1] as { status: string; error_message: string }
    expect(errorUpdate.status).toBe('error')
    expect(errorUpdate.error_message).toBe('OpenAI unavailable')
  })
})
