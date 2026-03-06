import { POST } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('ai', () => ({
  streamText: vi.fn(),
  convertToModelMessages: vi.fn().mockResolvedValue([]),
  UIMessage: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockReturnValue(vi.fn()),
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn(),
}))

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: vi.fn() },
}))

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/chat/global', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingsData: unknown[] | null = null) {
  const limitMock = vi.fn().mockResolvedValue({ data: meetingsData })
  const orderMock = vi.fn().mockReturnValue({ limit: limitMock })
  const eqMock = vi.fn().mockReturnValue({ order: orderMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock })

  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({ select: selectMock }),
  }

  vi.mocked(createClient).mockResolvedValue(mock as never)
  return { eqMock }
}

describe('POST /api/chat/global', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(streamText).mockReturnValue({
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
    const call = vi.mocked(streamText).mock.calls[0][0]
    expect(call.system).toContain('Meeting A')
    expect(call.system).toContain('Summary A')
    expect(call.system).toContain('Decision 1')
    // Null title should fall back to 'Untitled Meeting'
    expect(call.system).toContain('Untitled Meeting')
  })
})
