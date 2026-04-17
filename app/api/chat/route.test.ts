import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

const mockBuildChatModelMessages = mock(() => Promise.resolve([]))
const mockSearchWeb = mock(() => Promise.resolve(''))
const mockOpenai = mock((model: string) => model)

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

mock.module('ai', () => ({
  streamText: mock(() => {}),
}))

mock.module('@ai-sdk/openai', () => ({
  openai: mockOpenai,
}))

mock.module('@/lib/chat/chat-message-utils', () => ({
  buildChatModelMessages: mockBuildChatModelMessages,
  getLastUserText: mock(() => 'What changed?'),
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
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingData: unknown) {
  const meetingSingle = mock(() => Promise.resolve({ data: meetingData }))
  const meetingEqUser = mock(() => ({ single: meetingSingle }))
  const meetingEqId = mock(() => ({ eq: meetingEqUser }))
  const meetingSelect = mock(() => ({ eq: meetingEqId }))

  const from = mock((table: string) => {
    if (table === 'meetings') {
      return { select: meetingSelect }
    }
    throw new Error(`Unexpected table ${table}`)
  })

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from,
  }

  ;(createClient as any).mockResolvedValue(supabaseMock as never)
  return { from }
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(streamText as any).mockReturnValue({
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
    expect(payload.code).toBe('INVALID_INPUT')
  })

  it('returns 404 if meeting not found or not owned by user', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const response = await POST(makeRequest({ meetingId: 'bad-id', messages: [] }))
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error).toBe('Meeting not found')
    expect(payload.code).toBe('MEETING_NOT_FOUND')
  })

  it('uses fixed model and does not query meeting_sources', async () => {
    const meetingData = {
      title: 'Meeting',
      transcript: 'Transcript',
      summary: '',
      detailed_notes: '',
      action_items: [],
      key_decisions: [],
      topics: [],
      follow_ups: [],
      document_content: null,
    }

    const { from } = mockSupabase({ id: 'user-1' }, meetingData)

    const response = await POST(makeRequest({
      meetingId: 'meeting-1',
      messages: [],
      searchEnabled: false,
    }))

    expect(response.status).toBe(200)
    expect(mockOpenai).toHaveBeenCalledWith('gpt-5-mini')
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('meetings')
  })

  it('adds web search context when search is enabled', async () => {
    mockSearchWeb.mockResolvedValueOnce('1. Result\nhttps://example.com\nContext')

    const meetingData = {
      title: 'Meeting',
      transcript: 'Transcript',
      summary: '',
      detailed_notes: '',
      action_items: [],
      key_decisions: [],
      topics: [],
      follow_ups: [],
      document_content: null,
    }

    mockSupabase({ id: 'user-1' }, meetingData)

    const response = await POST(makeRequest({
      meetingId: 'meeting-1',
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'What changed?' }] }],
      searchEnabled: true,
    }))

    expect(response.status).toBe(200)
    expect(mockSearchWeb).toHaveBeenCalledWith('What changed?')

    const call = (streamText as any).mock.calls[0][0]
    expect(call.system).toContain('Web Search Context')
  })
})
