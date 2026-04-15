import { beforeEach, describe, expect, it, mock, jest } from 'bun:test'

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

describe('POST /api/generate-notes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockCompletionCreate as any).mockResolvedValue({
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
    mockSupabase({ user: null })
    const res = await POST(makeRequest({ meetingId: 'id' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  })

  it('returns 400 for malformed payload', async () => {
    mockSupabase({ user: { id: 'user-1' } })
    const res = await POST(makeRequest({ transcript: 'text' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: 'Invalid request body',
      code: 'INVALID_INPUT',
    })
  })

  it('returns 404 if meeting is not found', async () => {
    mockSupabase({ user: { id: 'user-1' }, meetingData: null })
    const res = await POST(makeRequest({ meetingId: 'bad-id' }))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({
      error: 'Meeting not found',
      code: 'MEETING_NOT_FOUND',
    })
  })

  it('returns 400 if transcript is missing in DB and request', async () => {
    mockSupabase({
      user: { id: 'user-1' },
      meetingData: { id: 'meeting-1', user_id: 'user-1', transcript: null, template_id: null },
    })
    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: 'Missing transcript',
      code: 'MISSING_TRANSCRIPT',
    })
  })

  it('uses the builtin template prompt and never writes document_content', async () => {
    const { updateCalls } = mockSupabase({
      user: { id: 'user-1' },
      meetingData: {
        id: 'meeting-1',
        user_id: 'user-1',
        transcript: 'Transcript from DB',
        template_id: 'sales-call',
      },
    })

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(200)

    const completionCall = (mockCompletionCreate as any).mock.calls[0][0]
    expect(completionCall.messages[0].content).toContain('Selected note format: Sales Call')

    const finalUpdate = updateCalls[1] as Record<string, unknown>
    expect(finalUpdate.document_content).toBeDefined()
    expect(finalUpdate.title).toBe('Weekly sync')
    expect(finalUpdate.status).toBe('done')
  })

  it('uses a custom template prompt when template_id points to a user template', async () => {
    mockSupabase({
      user: { id: 'user-1' },
      meetingData: {
        id: 'meeting-1',
        user_id: 'user-1',
        transcript: 'Transcript from DB',
        template_id: 'custom-template',
      },
      templateData: {
        id: 'custom-template',
        name: 'Board Update',
        description: 'Investor-ready structure',
        prompt: 'Focus on metrics, risks, and asks.',
      },
    })

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(200)

    const completionCall = (mockCompletionCreate as any).mock.calls[0][0]
    expect(completionCall.messages[0].content).toContain('Selected note format: Board Update')
    expect(completionCall.messages[0].content).toContain('Focus on metrics, risks, and asks.')
  })

  it('falls back to the default template when the selected custom template is missing', async () => {
    mockSupabase({
      user: { id: 'user-1' },
      meetingData: {
        id: 'meeting-1',
        user_id: 'user-1',
        transcript: 'Transcript from DB',
        template_id: 'missing-template',
      },
      templateData: null,
    })

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(200)

    const completionCall = (mockCompletionCreate as any).mock.calls[0][0]
    expect(completionCall.messages[0].content).toContain('Selected note format: General Meeting')
  })

  it('retries without response_format when the provider rejects structured output options', async () => {
    ;(mockCompletionCreate as any)
      .mockRejectedValueOnce(new Error('400 Invalid input: response_format json_object is not supported'))
      .mockResolvedValueOnce({
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

    mockSupabase({
      user: { id: 'user-1' },
      meetingData: {
        id: 'meeting-1',
        user_id: 'user-1',
        transcript: 'Transcript from DB',
        template_id: null,
      },
    })

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(200)
    expect((mockCompletionCreate as any).mock.calls).toHaveLength(2)
    expect((mockCompletionCreate as any).mock.calls[0][0].response_format).toEqual({
      type: 'json_object',
    })
    expect((mockCompletionCreate as any).mock.calls[1][0].response_format).toBeUndefined()
  })

  it('persists meeting error state when note generation throws', async () => {
    ;(mockCompletionCreate as any).mockRejectedValueOnce(new Error('OpenAI unavailable'))

    const { updateCalls } = mockSupabase({
      user: { id: 'user-1' },
      meetingData: {
        id: 'meeting-1',
        user_id: 'user-1',
        transcript: 'Transcript from DB',
        template_id: null,
      },
    })

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({
      error: 'OpenAI unavailable',
      code: 'NOTES_GENERATION_FAILED',
    })

    const errorUpdate = updateCalls[1] as { status: string; error_message: string }
    expect(errorUpdate.status).toBe('error')
    expect(errorUpdate.error_message).toBe('OpenAI unavailable')
  })
})
