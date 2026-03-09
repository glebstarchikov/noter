import { describe, it, expect, beforeEach, mock, jest } from 'bun:test'

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

mock.module('ai', () => ({
  streamText: mock(() => {}),
  convertToModelMessages: mock(() => Promise.resolve([])),
  UIMessage: mock(() => {}),
}))

mock.module('@ai-sdk/openai', () => ({
  createOpenAI: mock(() => mock(() => {})),
}))

mock.module('@upstash/ratelimit', () => ({
  Ratelimit: mock(() => {}),
}))

mock.module('@upstash/redis', () => ({
  Redis: { fromEnv: mock(() => {}) },
}))

const { POST } = await import('./route')
const { createClient } = await import('@/lib/supabase/server')
const { streamText } = await import('ai')

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingData: unknown, sourcesData: unknown[] = []) {
  const meetingSingle = mock(() => Promise.resolve({ data: meetingData }))
  const meetingEqUser = mock(() => ({ single: meetingSingle }))
  const meetingEqId = mock(() => ({ eq: meetingEqUser }))
  const meetingSelect = mock(() => ({ eq: meetingEqId }))

  const sourcesEqUser = mock(() => Promise.resolve({ data: sourcesData }))
  const sourcesEqMeeting = mock(() => ({ eq: sourcesEqUser }))
  const sourcesSelect = mock(() => ({ eq: sourcesEqMeeting }))

  const from = mock((table: string) => {
    if (table === 'meetings') {
      return { select: meetingSelect }
    }
    return { select: sourcesSelect }
  })

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from,
  };

  (createClient as any).mockResolvedValue(supabaseMock as never)
  return { sourcesEqUser }
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (streamText as any).mockReturnValue({
      toUIMessageStreamResponse: () => new Response('ok', { status: 200 }),
    } as never)
  })

  it('returns 401 Unauthorized if user is not authenticated', async () => {
    mockSupabase(null, null)
    const response = await POST(makeRequest({ meetingId: 'test-id', messages: [] }))
    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.error).toBe('Unauthorized')
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 for malformed payload', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const response = await POST(makeRequest({ messages: [] }))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toBe('Invalid request body')
    expect(payload.code).toBe('INVALID_REQUEST')
  })

  it('returns 404 if meeting not found or not owned by user', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const response = await POST(makeRequest({ meetingId: 'bad-id', messages: [] }))
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error).toBe('Meeting not found')
    expect(payload.code).toBe('MEETING_NOT_FOUND')
  })

  it('filters attached sources by user_id', async () => {
    const meetingData = {
      title: 'Meeting',
      transcript: 'Transcript',
      summary: '',
      detailed_notes: '',
      action_items: [],
      key_decisions: [],
      topics: [],
      follow_ups: [],
    }

    const { sourcesEqUser } = mockSupabase(
      { id: 'user-1' },
      meetingData,
      [{ name: 'Doc', file_type: 'txt', content: 'hello' }]
    )

    const response = await POST(makeRequest({ meetingId: 'meeting-1', messages: [] }))

    expect(response.status).toBe(200)
    expect(sourcesEqUser).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
