import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

const mockBuildChatModelMessages = mock(() => Promise.resolve([]))
const mockSearchWeb = mock(() => Promise.resolve(''))
const mockGateway = mock((model: string) => model)

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

mock.module('ai', () => ({
  streamText: mock(() => {}),
  gateway: mockGateway,
}))

mock.module('@/lib/chat/chat-message-utils', () => ({
  buildChatModelMessages: mockBuildChatModelMessages,
  getLastUserText: mock(() => 'What changed across notes?'),
}))

mock.module('@/lib/tavily', () => ({
  searchWeb: mockSearchWeb,
}))

mock.module('@upstash/ratelimit', () => ({
  Ratelimit: mock(() => {}),
}))

mock.module('@upstash/redis', () => ({
  Redis: { fromEnv: mock(() => {}) },
}))

let POST: typeof import('./route').POST
let createClient: typeof import('@/lib/supabase/server').createClient
let streamText: typeof import('ai').streamText

beforeAll(async () => {
  const routeModule = await import('./route')
  const supabaseModule = await import('@/lib/supabase/server')
  const aiModule = await import('ai')

  POST = routeModule.POST
  createClient = supabaseModule.createClient
  streamText = aiModule.streamText
})

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

  const from = mock((table: string) => {
    if (table === 'meetings') {
      return { select: selectMock }
    }

    throw new Error(`Unexpected table ${table}`)
  })

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from,
  }

  ;(createClient as typeof createClient & { mockResolvedValue: (value: unknown) => void })
    .mockResolvedValue(supabaseMock as never)

  return { from, eqMock }
}

describe('POST /api/chat/global', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(streamText as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      toUIMessageStreamResponse: () => new Response('ok', { status: 200 }),
    })
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)

    const response = await POST(makeRequest({ messages: [] }))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  })

  it('returns 400 for invalid request body', async () => {
    mockSupabase({ id: 'user-1' })

    const response = await POST(new Request('http://localhost/api/chat/global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: 'Invalid request body',
      code: 'INVALID_REQUEST',
    })
  })

  it('returns 404 when the user has no meetings', async () => {
    mockSupabase({ id: 'user-1' }, [])

    const response = await POST(makeRequest({ messages: [] }))

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      error: 'No meetings found',
      code: 'NO_MEETINGS',
    })
  })

  it('routes model selection through gateway without querying meeting_sources', async () => {
    const meetings = [
      {
        id: 'm-1',
        title: 'Sprint Planning',
        summary: 'Discussed sprint goals',
        action_items: [{ task: 'Write tests', owner: 'Alice', done: false }],
        key_decisions: ['Ship the redesign'],
        topics: ['Frontend polish'],
        follow_ups: ['Review PR'],
        document_content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Typed note for the global chat context' }] }],
        },
        transcript: 'Alice discussed the roadmap.',
        created_at: '2026-03-01T00:00:00.000Z',
      },
    ]

    const { from, eqMock } = mockSupabase({ id: 'user-1' }, meetings)

    const response = await POST(makeRequest({
      messages: [],
      model: 'gpt-5.4',
      searchEnabled: false,
    }))

    expect(response.status).toBe(200)
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1')
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('meetings')
    expect(mockGateway).toHaveBeenCalledWith('openai/gpt-5.4')
  })

  it('builds note context with fallbacks and includes web search when enabled', async () => {
    mockSearchWeb.mockResolvedValueOnce('1. Result\nhttps://example.com\nContext')

    const meetings = [
      {
        id: 'm-1',
        title: 'Meeting A',
        summary: 'Summary A',
        action_items: [],
        key_decisions: ['Decision 1'],
        topics: [],
        follow_ups: [],
        document_content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Meeting note body' }] }],
        },
        transcript: 'Transcript excerpt',
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
        document_content: null,
        transcript: null,
        created_at: '2026-02-28T00:00:00.000Z',
      },
    ]

    mockSupabase({ id: 'user-1' }, meetings)

    const response = await POST(makeRequest({
      messages: [{ id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'What changed across notes?' }] }],
      searchEnabled: true,
    }))

    expect(response.status).toBe(200)
    expect(mockSearchWeb).toHaveBeenCalledWith('What changed across notes?')

    const call = (streamText as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0][0]
    expect(call.system).toContain('Meeting A')
    expect(call.system).toContain('Meeting note body')
    expect(call.system).toContain('Summary A')
    expect(call.system).toContain('Decision 1')
    expect(call.system).toContain('Transcript excerpt')
    expect(call.system).toContain('Untitled Meeting')
    expect(call.system).toContain('Web Search Context')
  })
})
