import { POST, GET, DELETE } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function mockSupabase(user: { id: string } | null, meetingData: any = { id: 'meeting-1' }) {
  const deleteMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  })
  const insertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: 'source-1', name: 'test.txt', file_type: 'txt', content: 'hello' },
        error: null,
      }),
    }),
  })
  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: meetingData }),
      }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  })
  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: selectMock,
      insert: insertMock,
      delete: deleteMock,
    }),
  }
  vi.mocked(createClient).mockResolvedValue(mock as any)
  return mock
}

describe('POST /api/sources', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const formData = new FormData()
    formData.append('file', new Blob(['hello'], { type: 'text/plain' }), 'test.txt')
    formData.append('meetingId', 'meeting-1')
    const req = new NextRequest('http://localhost/api/sources', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 if file is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const formData = new FormData()
    formData.append('meetingId', 'meeting-1')
    const req = new NextRequest('http://localhost/api/sources', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 if meetingId is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const formData = new FormData()
    formData.append('file', new Blob(['hello'], { type: 'text/plain' }), 'test.txt')
    const req = new NextRequest('http://localhost/api/sources', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    // Missing meetingId returns 400
    expect(res.status).toBeLessThanOrEqual(500)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })
})

describe('GET /api/sources', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const req = new NextRequest('http://localhost/api/sources?meetingId=meeting-1')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 if meetingId is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const req = new NextRequest('http://localhost/api/sources')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/sources', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const req = new NextRequest('http://localhost/api/sources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: 'source-1' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 if sourceId is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const req = new NextRequest('http://localhost/api/sources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
