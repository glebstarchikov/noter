import { describe, it, expect, beforeEach, mock, jest } from 'bun:test'

const mockTranscriptionCreate = mock(() => {})

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

mock.module('@/lib/openai', () => ({
  getOpenAI: mock(() => ({
    audio: {
      transcriptions: {
        create: mockTranscriptionCreate,
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
  return new NextRequest('http://localhost/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingData: unknown = null) {
  const updateSecondEq = mock(() => Promise.resolve({ error: null }))
  const updateFirstEq = mock(() => ({ eq: updateSecondEq }))
  const updateMock = mock(() => ({ eq: updateFirstEq }))

  const storageMock = {
    from: mock(() => ({
      download: mock(() => Promise.resolve({ data: new Blob(['audio']), error: null })),
    })),
  }

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
    storage: storageMock,
  };

  (createClient as any).mockResolvedValue(supabaseMock as never)
  return { updateSecondEq }
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockTranscriptionCreate as any).mockResolvedValue('mock transcript')
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const res = await POST(makeRequest({ meetingId: 'test-id', storagePath: 'path' }))
    expect(res.status).toBe(401)
    const payload = await res.json()
    expect(payload.error).toBe('Unauthorized')
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 for malformed payload', async () => {
    mockSupabase({ id: 'user-1' })
    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error).toBe('Invalid request body')
    expect(payload.code).toBe('INVALID_INPUT')
  })

  it('returns 404 if meeting is not found', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const res = await POST(makeRequest({ meetingId: 'bad-id', storagePath: 'path' }))
    expect(res.status).toBe(404)
    const payload = await res.json()
    expect(payload.error).toBe('Meeting not found')
    expect(payload.code).toBe('MEETING_NOT_FOUND')
  })

  it('applies ownership filter on update queries', async () => {
    const { updateSecondEq } = mockSupabase({ id: 'user-1' }, { id: 'meeting-1' })
    const res = await POST(makeRequest({ meetingId: 'meeting-1', storagePath: 'user-1/meeting-1.webm' }))

    expect(res.status).toBe(200)
    expect(updateSecondEq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
