import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

let POST: typeof import('./route').POST
let GET: typeof import('./route').GET
let DELETE: typeof import('./route').DELETE
let createClient: typeof import('@/lib/supabase/server').createClient
let NextRequest: typeof import('next/server').NextRequest

beforeAll(async () => {
  const routeModule = await import('./route')
  const supabaseModule = await import('@/lib/supabase/server')
  const nextServerModule = await import('next/server')

  POST = routeModule.POST
  GET = routeModule.GET
  DELETE = routeModule.DELETE
  createClient = supabaseModule.createClient
  NextRequest = nextServerModule.NextRequest
})

function mockSupabase(user: { id: string } | null, meetingData: any = { id: 'meeting-1' }) {
  const deleteMock = mock(() => ({
    eq: mock(() => ({
      eq: mock(() => Promise.resolve({ error: null })),
    })),
  }))
  const insertMock = mock(() => ({
    select: mock(() => ({
      single: mock(() => Promise.resolve({
        data: { id: 'source-1', name: 'test.txt', file_type: 'txt', content: 'hello' },
        error: null,
      })),
    })),
  }))
  const selectMock = mock(() => ({
    eq: mock(() => ({
      eq: mock(() => ({
        single: mock(() => Promise.resolve({ data: meetingData })),
      })),
      order: mock(() => Promise.resolve({ data: [], error: null })),
    })),
  }))
  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from: mock(() => ({
      select: selectMock,
      insert: insertMock,
      delete: deleteMock,
    })),
  };
  (createClient as any).mockResolvedValue(supabaseMock as any)
  return supabaseMock
}

describe('POST /api/sources', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const formData = new FormData()
    formData.append('file', new File(['hello'], 'test.txt', { type: 'text/plain' }))
    formData.append('meetingId', 'meeting-1')
    const req = new NextRequest('http://localhost/api/sources', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.code).toBe('UNAUTHORIZED')
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
    const data = await res.json()
    expect(data.code).toBe('INVALID_REQUEST')
  })

  it('returns 400 if meetingId is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const formData = new FormData()
    formData.append('file', 'hello')
    const req = new NextRequest('http://localhost/api/sources', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Missing file or meetingId')
    expect(data.code).toBe('INVALID_REQUEST')
  })
})

describe('GET /api/sources', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const req = new NextRequest('http://localhost/api/sources?meetingId=meeting-1')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 if meetingId is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const req = new NextRequest('http://localhost/api/sources')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.code).toBe('INVALID_REQUEST')
  })
})

describe('DELETE /api/sources', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const req = new NextRequest('http://localhost/api/sources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: 'source-1' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.code).toBe('UNAUTHORIZED')
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
    const data = await res.json()
    expect(data.error).toBe('Invalid request body')
    expect(data.code).toBe('INVALID_REQUEST')
  })
})
