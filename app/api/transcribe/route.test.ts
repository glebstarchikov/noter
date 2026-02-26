import { POST } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('openai', () => {
  const MockOpenAI = function() {
    return {
      audio: {
        transcriptions: {
          create: vi.fn(),
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

function mockSupabase(user: { id: string } | null, meetingData: any = null) {
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ eq: vi.fn() }),
  })
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
  vi.mocked(createClient).mockResolvedValue(mock as any)
  return { mock, updateMock }
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const res = await POST(makeRequest({ meetingId: 'test-id', storagePath: 'path' }))
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 400 if meetingId is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const res = await POST(makeRequest({ storagePath: 'path' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Missing meeting ID')
  })

  it('returns 404 if meeting not found or not owned by user', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const res = await POST(makeRequest({ meetingId: 'bad-id', storagePath: 'path' }))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Meeting not found')
  })

  it('returns 400 if storagePath is missing', async () => {
    mockSupabase({ id: 'user-1' }, { id: 'meeting-1' })
    const res = await POST(makeRequest({ meetingId: 'meeting-1' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Missing audio storage path')
  })
})
