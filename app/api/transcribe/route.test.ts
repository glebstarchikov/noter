import { POST } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

const mockTranscriptionCreate = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('openai', () => {
  const MockOpenAI = function () {
    return {
      audio: {
        transcriptions: {
          create: mockTranscriptionCreate,
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
  return new NextRequest('http://localhost/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingData: unknown = null) {
  const updateSecondEq = vi.fn().mockResolvedValue({ error: null })
  const updateFirstEq = vi.fn().mockReturnValue({ eq: updateSecondEq })
  const updateMock = vi.fn().mockReturnValue({ eq: updateFirstEq })

  const storageMock = {
    from: vi.fn().mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: new Blob(['audio']), error: null }),
    }),
  }

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
    storage: storageMock,
  }

  vi.mocked(createClient).mockResolvedValue(mock as never)
  return { updateSecondEq }
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTranscriptionCreate.mockResolvedValue('mock transcript')
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
    expect(payload.code).toBe('INVALID_REQUEST')
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
