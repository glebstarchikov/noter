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
  const updateSecondEq = mock(() => Promise.resolve({ error: null }))
  const updateFirstEq = mock(() => ({ eq: updateSecondEq }))
  const updateMock = mock(() => ({ eq: updateFirstEq }))

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
  };

  (createClient as any).mockResolvedValue(supabaseMock as never)
  return { updateSecondEq }
}

describe('POST /api/generate-notes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
