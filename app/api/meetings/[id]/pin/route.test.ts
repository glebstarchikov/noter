import { PATCH } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/meetings/meeting-1/pin', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(user: { id: string } | null, meetingData: unknown = null) {
  const selectSingle = vi.fn().mockResolvedValue({ data: meetingData })
  const selectEqUser = vi.fn().mockReturnValue({ single: selectSingle })
  const selectEqId = vi.fn().mockReturnValue({ eq: selectEqUser })
  const selectMock = vi.fn().mockReturnValue({ eq: selectEqId })

  const updateEqUser = vi.fn().mockResolvedValue({ error: null })
  const updateEqId = vi.fn().mockReturnValue({ eq: updateEqUser })
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqId })

  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: selectMock,
      update: updateMock,
    }),
  }

  vi.mocked(createClient).mockResolvedValue(mock as never)
  return { updateMock, updateEqUser }
}

describe('PATCH /api/meetings/[id]/pin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 if body is missing pinned field', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.code).toBe('INVALID_BODY')
  })

  it('returns 400 if pinned is not a boolean', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await PATCH(makeRequest({ pinned: 'yes' }), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.code).toBe('INVALID_BODY')
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
    expect(payload.code).toBe('INVALID_BODY')
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
