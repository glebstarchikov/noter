import { describe, it, expect, beforeAll, beforeEach, afterEach, mock, jest } from 'bun:test'

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

let POST: typeof import('./route').POST
let createClient: typeof import('@/lib/supabase/server').createClient

beforeAll(async () => {
  const routeModule = await import('./route')
  const supabaseModule = await import('@/lib/supabase/server')

  POST = routeModule.POST
  createClient = supabaseModule.createClient
})

function mockSupabase(user: { id: string } | null) {
  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
  };

  (createClient as ReturnType<typeof mock>).mockResolvedValue(supabaseMock as never)
}

describe('POST /api/transcribe/realtime-token', () => {
  const originalEnv = process.env.DEEPGRAM_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DEEPGRAM_API_KEY = 'test-deepgram-key'
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DEEPGRAM_API_KEY = originalEnv
    } else {
      delete process.env.DEEPGRAM_API_KEY
    }
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const response = await POST()
    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  it('returns 503 if DEEPGRAM_API_KEY is not set', async () => {
    mockSupabase({ id: 'user-1' })
    delete process.env.DEEPGRAM_API_KEY

    const response = await POST()
    expect(response.status).toBe(503)
    const payload = await response.json()
    expect(payload.code).toBe('NOT_CONFIGURED')
  })

  it('returns the API key when authenticated and configured', async () => {
    mockSupabase({ id: 'user-1' })

    const response = await POST()
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.key).toBe('test-deepgram-key')
  })
})
