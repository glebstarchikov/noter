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
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingData: unknown, sourcesData: unknown[] = []) {
  const meetingSingle = vi.fn().mockResolvedValue({ data: meetingData })
  const meetingEqUser = vi.fn().mockReturnValue({ single: meetingSingle })
  const meetingEqId = vi.fn().mockReturnValue({ eq: meetingEqUser })
  const meetingSelect = vi.fn().mockReturnValue({ eq: meetingEqId })

  const sourcesEqUser = vi.fn().mockResolvedValue({ data: sourcesData })
  const sourcesEqMeeting = vi.fn().mockReturnValue({ eq: sourcesEqUser })
  const sourcesSelect = vi.fn().mockReturnValue({ eq: sourcesEqMeeting })

  const from = vi.fn((table: string) => {
    if (table === 'meetings') {
      return { select: meetingSelect }
    }
    return { select: sourcesSelect }
  })

  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  }

  vi.mocked(createClient).mockResolvedValue(mock as never)
  return { sourcesEqUser }
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(streamText).mockReturnValue({
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
