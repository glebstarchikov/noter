import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

let PATCH: typeof import('./route').PATCH
let createClient: typeof import('@/lib/supabase/server').createClient

beforeAll(async () => {
  const routeModule = await import('./route')
  const supabaseModule = await import('@/lib/supabase/server')

  PATCH = routeModule.PATCH
  createClient = supabaseModule.createClient
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/meetings/meeting-1/pin', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingData: unknown = null) {
  const selectSingle = mock(() => Promise.resolve({ data: meetingData }))
  const selectEqUser = mock(() => ({ single: selectSingle }))
  const selectEqId = mock(() => ({ eq: selectEqUser }))
  const selectMock = mock(() => ({ eq: selectEqId }))

  const updateEqUser = mock(() => Promise.resolve({ error: null }))
  const updateEqId = mock(() => ({ eq: updateEqUser }))
  const updateMock = mock(() => ({ eq: updateEqId }))

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from: mock(() => ({
      select: selectMock,
      update: updateMock,
    })),
  };

  (createClient as any).mockResolvedValue(supabaseMock as never)
  return { updateMock, updateEqUser }
}

describe('PATCH /api/meetings/[id]/pin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 400 if body is missing pinned field', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.code).toBe('INVALID_INPUT')
  })

  it('returns 400 if pinned is not a boolean', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await PATCH(makeRequest({ pinned: 'yes' }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.code).toBe('INVALID_INPUT')
  })

  it('returns 400 if request body is invalid JSON', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await PATCH(
      new Request('http://localhost/api/meetings/meeting-1/pin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      { params: Promise.resolve({ id: 'meeting-1' }) },
    )
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.code).toBe('INVALID_INPUT')
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const response = await PATCH(makeRequest({ pinned: true }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })
    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 if meeting not found or not owned by user', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const response = await PATCH(makeRequest({ pinned: true }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.code).toBe('MEETING_NOT_FOUND')
  })

  it('pins a meeting successfully', async () => {
    const { updateMock } = mockSupabase({ id: 'user-1' }, { id: 'meeting-1' })
    const response = await PATCH(makeRequest({ pinned: true }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({ pinned: true })
    expect(updateMock).toHaveBeenCalledWith({ is_pinned: true })
  })

  it('unpins a meeting successfully', async () => {
    const { updateMock } = mockSupabase({ id: 'user-1' }, { id: 'meeting-1' })
    const response = await PATCH(makeRequest({ pinned: false }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({ pinned: false })
    expect(updateMock).toHaveBeenCalledWith({ is_pinned: false })
  })
})
