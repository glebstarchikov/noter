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
  return new Request('http://localhost/api/chat/global', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingsData: unknown[] | null = null) {
  const limitMock = mock(() => Promise.resolve({ data: meetingsData }))
  const orderMock = mock(() => ({ limit: limitMock }))
  const eqMock = mock(() => ({ order: orderMock }))
  const selectMock = mock(() => ({ eq: eqMock }))

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from: mock(() => ({ select: selectMock })),
  };

  (createClient as any).mockResolvedValue(supabaseMock as never)
  return { eqMock }
}

describe('POST /api/chat/global', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (streamText as any).mockReturnValue({
      toUIMessageStreamResponse: () => new Response('ok', { status: 200 }),
    } as never)
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const response = await POST(makeRequest({ messages: [] }))
    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 for invalid request body', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await POST(new Request('http://localhost/api/chat/global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.code).toBe('INVALID_REQUEST')
  })

  it('returns 404 when user has no meetings', async () => {
    mockSupabase({ id: 'user-1' }, [])
    const response = await POST(makeRequest({ messages: [] }))
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.code).toBe('NO_MEETINGS')
  })

  it('returns 404 when meetings query returns null', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const response = await POST(makeRequest({ messages: [] }))
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.code).toBe('NO_MEETINGS')
  })

  it('streams a response when meetings exist', async () => {
    const meetings = [
      {
        id: 'm-1',
        title: 'Sprint Planning',
        summary: 'Discussed sprint goals',
        action_items: [{ task: 'Write tests', owner: 'Alice', done: false }],
        key_decisions: ['Use React'],
        topics: ['Frontend'],
        follow_ups: ['Review PR'],
        created_at: '2026-03-01T00:00:00.000Z',
      },
    ]
    const { eqMock } = mockSupabase({ id: 'user-1' }, meetings)

    const response = await POST(makeRequest({ messages: [] }))

    expect(response.status).toBe(200)
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1')
    expect(streamText).toHaveBeenCalled()
  })

  it('builds context from multiple meetings with correct data', async () => {
    const meetings = [
      {
        id: 'm-1',
        title: 'Meeting A',
        summary: 'Summary A',
        action_items: [],
        key_decisions: ['Decision 1'],
        topics: [],
        follow_ups: [],
        created_at: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'm-2',
        title: null,
        summary: null,
        action_items: 'not-an-array',
        key_decisions: null,
        topics: [123],
        follow_ups: null,
        created_at: '2026-02-28T00:00:00.000Z',
      },
    ]
    mockSupabase({ id: 'user-1' }, meetings)

    const response = await POST(makeRequest({ messages: [] }))

    expect(response.status).toBe(200)
    expect(streamText).toHaveBeenCalled()

    // Verify the system prompt contains meeting context
    const call = (streamText as any).mock.calls[0][0]
    expect(call.system).toContain('Meeting A')
    expect(call.system).toContain('Summary A')
    expect(call.system).toContain('Decision 1')
    // Null title should fall back to 'Untitled Meeting'
    expect(call.system).toContain('Untitled Meeting')
  })
})
