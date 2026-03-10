import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

let GET: typeof import('./route').GET
let DELETE: typeof import('./route').DELETE
let createClient: typeof import('@/lib/supabase/server').createClient

beforeAll(async () => {
  const routeModule = await import('./route')
  const supabaseModule = await import('@/lib/supabase/server')

  GET = routeModule.GET
  DELETE = routeModule.DELETE
  createClient = supabaseModule.createClient
})

function mockSupabase(user: { id: string } | null, meetingData: unknown = null) {
  const selectSingle = mock(() => Promise.resolve({ data: meetingData }))
  const selectEqUser = mock(() => ({ single: selectSingle }))
  const selectEqId = mock(() => ({ eq: selectEqUser }))
  const selectMock = mock(() => ({ eq: selectEqId }))

  const deleteEqUser = mock(() => Promise.resolve({ error: null }))
  const deleteEqId = mock(() => ({ eq: deleteEqUser }))
  const deleteMock = mock(() => ({ eq: deleteEqId }))

  const removeMock = mock(() => Promise.resolve({ error: null }))
  const storageMock = {
    from: mock(() => ({
      remove: removeMock,
    })),
  }

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from: mock(() => ({
      select: selectMock,
      delete: deleteMock,
    })),
    storage: storageMock,
  };

  (createClient as any).mockResolvedValue(supabaseMock as never)
  return { removeMock, deleteEqUser }
}

describe('DELETE /api/meetings/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const response = await DELETE(new Request('http://localhost/api/meetings/meeting-1'), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.error).toBe('Unauthorized')
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 if meeting is not found', async () => {
    mockSupabase({ id: 'user-1' }, null)
    const response = await DELETE(new Request('http://localhost/api/meetings/meeting-1'), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error).toBe('Meeting not found')
    expect(payload.code).toBe('MEETING_NOT_FOUND')
  })

  it('deletes storage object and meeting record on success', async () => {
    const { removeMock, deleteEqUser } = mockSupabase(
      { id: 'user-1' },
      { id: 'meeting-1', audio_url: 'user-1/meeting-1.webm' }
    )

    const response = await DELETE(new Request('http://localhost/api/meetings/meeting-1'), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(200)
    expect(removeMock).toHaveBeenCalledWith(['user-1/meeting-1.webm'])
    expect(deleteEqUser).toHaveBeenCalledWith('user_id', 'user-1')
    expect(await response.json()).toEqual({ success: true })
  })
})

describe('GET /api/meetings/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const response = await GET(new Request('http://localhost/api/meetings/meeting-1'), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.error).toBe('Unauthorized')
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  it('returns meeting status when found', async () => {
    mockSupabase({ id: 'user-1' }, {
      id: 'meeting-1',
      status: 'transcribing',
      error_message: null,
      updated_at: '2026-03-03T00:00:00.000Z',
    })

    const response = await GET(new Request('http://localhost/api/meetings/meeting-1'), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      meeting: {
        id: 'meeting-1',
        status: 'transcribing',
        error_message: null,
        updated_at: '2026-03-03T00:00:00.000Z',
      },
    })
  })
})
