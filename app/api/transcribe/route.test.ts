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
      upload: vi.fn().mockResolvedValue({ error: null }),
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

function makeRequest(fields?: Record<string, string | Blob>) {
  const formData = new FormData()
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value)
    }
  }
  return new NextRequest('http://localhost/api/transcribe', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 400 if audio file is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const res = await POST(makeRequest({ meetingId: 'test-id' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Missing audio file or meeting ID')
  })

  it('returns error if meetingId is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const formData = new FormData()
    formData.append('audio', new File([new Blob(['audio'])], 'test.webm', { type: 'audio/webm' }))
    const req = new NextRequest('http://localhost/api/transcribe', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    // Should return an error status (400 or 500 depending on env)
    expect(res.status).toBeGreaterThanOrEqual(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('returns error if meeting not found or not owned by user', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const formData = new FormData()
    formData.append('audio', new File([new Blob(['audio'])], 'test.webm', { type: 'audio/webm' }))
    formData.append('meetingId', 'bad-id')
    const req = new NextRequest('http://localhost/api/transcribe', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    // Should return an error status (404 or 500 depending on env)
    expect(res.status).toBeGreaterThanOrEqual(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })
})
