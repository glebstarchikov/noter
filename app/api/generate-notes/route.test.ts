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
      chat: {
        completions: {
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
  vi.mocked(createClient).mockResolvedValue(mock as any)
  return { mock, updateMock }
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/generate-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/generate-notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const res = await POST(makeRequest({ meetingId: 'id', transcript: 'text' }))
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 400 if meetingId is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const res = await POST(makeRequest({ transcript: 'text' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Missing meetingId or transcript')
  })

  it('returns 400 if transcript is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const res = await POST(makeRequest({ meetingId: 'id' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Missing meetingId or transcript')
  })

  it('returns 404 if meeting not found or not owned by user', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const res = await POST(makeRequest({ meetingId: 'bad-id', transcript: 'text' }))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Meeting not found')
  })
})
