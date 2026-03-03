import { POST } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

const mockCompletionCreate = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('openai', () => {
  const MockOpenAI = function () {
    return {
      chat: {
        completions: {
          create: mockCompletionCreate,
        },
      },
    }
  }
  return { default: MockOpenAI }
})

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn(),
}))

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: vi.fn() },
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/generate-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingData: unknown = null) {
  const updateSecondEq = vi.fn().mockResolvedValue({ error: null })
  const updateFirstEq = vi.fn().mockReturnValue({ eq: updateSecondEq })
  const updateMock = vi.fn().mockReturnValue({ eq: updateFirstEq })

  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: meetingData }),
          }),
        }),
      }),
      update: updateMock,
    }),
  }

  vi.mocked(createClient).mockResolvedValue(mock as never)
  return { updateSecondEq }
}

describe('POST /api/generate-notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCompletionCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: 'Weekly sync',
              summary: 'Summary text',
              detailed_notes: '## Notes',
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
    mockSupabase({ id: 'user-1' }, { id: 'meeting-1', transcript: null })
    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error).toBe('Missing transcript')
    expect(payload.code).toBe('MISSING_TRANSCRIPT')
  })

  it('uses DB transcript fallback and applies ownership filter on updates', async () => {
    const { updateSecondEq } = mockSupabase(
      { id: 'user-1' },
      { id: 'meeting-1', transcript: 'Transcript from DB' }
    )

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(200)
    expect(mockCompletionCreate).toHaveBeenCalled()
    expect(updateSecondEq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
