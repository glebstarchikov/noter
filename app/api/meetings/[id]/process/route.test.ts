import { POST } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function makeRequest(body: unknown = {}) {
  return new NextRequest('http://localhost/api/meetings/meeting-1/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase({
  user,
  meeting,
  existingJob = null,
  upsertError = null,
}: {
  user: { id: string } | null
  meeting: unknown
  existingJob?: unknown
  upsertError?: { message: string } | null
}) {
  const meetingsSelectSingle = vi.fn().mockResolvedValue({ data: meeting })
  const meetingsSelectEqUser = vi.fn().mockReturnValue({ single: meetingsSelectSingle })
  const meetingsSelectEqId = vi.fn().mockReturnValue({ eq: meetingsSelectEqUser })
  const meetingsSelect = vi.fn().mockReturnValue({ eq: meetingsSelectEqId })

  const meetingsUpdateEqUser = vi.fn().mockResolvedValue({ error: null })
  const meetingsUpdateEqId = vi.fn().mockReturnValue({ eq: meetingsUpdateEqUser })
  const meetingsUpdate = vi.fn().mockReturnValue({ eq: meetingsUpdateEqId })

  const jobsMaybeSingle = vi.fn().mockResolvedValue({ data: existingJob })
  const jobsEqMeeting = vi.fn().mockReturnValue({ maybeSingle: jobsMaybeSingle })
  const jobsSelect = vi.fn().mockReturnValue({ eq: jobsEqMeeting })
  const jobsUpsert = vi.fn().mockResolvedValue({ error: upsertError })

  const from = vi.fn((table: string) => {
    if (table === 'meetings') {
      return {
        select: meetingsSelect,
        update: meetingsUpdate,
      }
    }

    if (table === 'processing_jobs') {
      return {
        select: jobsSelect,
        upsert: jobsUpsert,
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  }

  vi.mocked(createClient).mockResolvedValue(mock as never)
  return { jobsUpsert, meetingsUpdateEqUser }
}

describe('POST /api/meetings/[id]/process', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.CRON_SECRET = 'cron-secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
  })

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase({ user: null, meeting: null })

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('UNAUTHORIZED')
  })

  it('returns 503 when queue is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.CRON_SECRET
    mockSupabase({ user: { id: 'user-1' }, meeting: null })

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('QUEUE_UNAVAILABLE')
  })

  it('returns existing queued state for active job', async () => {
    mockSupabase({
      user: { id: 'user-1' },
      meeting: { id: 'meeting-1', status: 'transcribing', audio_url: 'user-1/meeting-1.webm' },
      existingJob: { id: 'job-1', status: 'running' },
    })

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      queued: true,
      jobStatus: 'running',
    })
  })

  it('enqueues a new job and triggers worker', async () => {
    const { jobsUpsert, meetingsUpdateEqUser } = mockSupabase({
      user: { id: 'user-1' },
      meeting: { id: 'meeting-1', status: 'uploading', audio_url: 'user-1/meeting-1.webm' },
      existingJob: null,
    })

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'meeting-1' }),
    })

    expect(response.status).toBe(200)
    expect(jobsUpsert).toHaveBeenCalled()
    expect(meetingsUpdateEqUser).toHaveBeenCalledWith('user_id', 'user-1')

    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      queued: true,
    })
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
  })
})
