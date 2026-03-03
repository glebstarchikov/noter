import { GET, DELETE } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function mockSupabase(user: { id: string } | null, meetingData: unknown = null) {
  const selectSingle = vi.fn().mockResolvedValue({ data: meetingData })
  const selectEqUser = vi.fn().mockReturnValue({ single: selectSingle })
  const selectEqId = vi.fn().mockReturnValue({ eq: selectEqUser })
  const selectMock = vi.fn().mockReturnValue({ eq: selectEqId })

  const deleteEqUser = vi.fn().mockResolvedValue({ error: null })
  const deleteEqId = vi.fn().mockReturnValue({ eq: deleteEqUser })
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqId })

  const removeMock = vi.fn().mockResolvedValue({ error: null })
  const storageMock = {
    from: vi.fn().mockReturnValue({
      remove: removeMock,
    }),
  }

  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: selectMock,
      delete: deleteMock,
    }),
    storage: storageMock,
  }

  vi.mocked(createClient).mockResolvedValue(mock as never)
  return { removeMock, deleteEqUser }
}

describe('DELETE /api/meetings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    vi.clearAllMocks()
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
