import { describe, it, expect, beforeEach, mock, jest } from 'bun:test'

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

const { POST } = await import('./route')
const { createClient } = await import('@/lib/supabase/server')
const { NextRequest } = await import('next/server')

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
  const meetingsSelectSingle = mock(() => Promise.resolve({ data: meeting }))
  const meetingsSelectEqUser = mock(() => ({ single: meetingsSelectSingle }))
  const meetingsSelectEqId = mock(() => ({ eq: meetingsSelectEqUser }))
  const meetingsSelect = mock(() => ({ eq: meetingsSelectEqId }))

  const meetingsUpdateEqUser = mock(() => Promise.resolve({ error: null }))
  const meetingsUpdateEqId = mock(() => ({ eq: meetingsUpdateEqUser }))
  const meetingsUpdate = mock(() => ({ eq: meetingsUpdateEqId }))

  const jobsMaybeSingle = mock(() => Promise.resolve({ data: existingJob }))
  const jobsEqMeeting = mock(() => ({ maybeSingle: jobsMaybeSingle }))
  const jobsSelect = mock(() => ({ eq: jobsEqMeeting }))
  const jobsUpsert = mock(() => Promise.resolve({ error: upsertError }))

  const from = mock((table: string) => {
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

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from,
  };

  (createClient as any).mockResolvedValue(supabaseMock as never)
  return { jobsUpsert, meetingsUpdateEqUser }
}

describe('POST /api/meetings/[id]/process', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.CRON_SECRET = 'cron-secret'
    globalThis.fetch = mock(() => Promise.resolve(new Response('{}', { status: 200 }))) as any
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
    expect(globalThis.fetch).toHaveBeenCalled()
  })
})
