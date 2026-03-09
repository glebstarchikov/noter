import { describe, it, expect, beforeEach, mock, jest } from 'bun:test'

const mockTranscriptionCreate = mock(() => {})
const mockCompletionCreate = mock(() => {})

mock.module('@/lib/supabase/admin', () => ({
  createAdminClient: mock(() => {}),
}))

mock.module('@/lib/openai', () => ({
  getOpenAI: mock(() => ({
    audio: {
      transcriptions: {
        create: mockTranscriptionCreate,
      },
    },
    chat: {
      completions: {
        create: mockCompletionCreate,
      },
    },
  })),
}))

const { GET } = await import('./route')
const { createAdminClient } = await import('@/lib/supabase/admin')
const { NextRequest } = await import('next/server')

function makeRequest(path = 'http://localhost/api/processing/worker?limit=1') {
  return new NextRequest(path, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer cron-secret',
    },
  })
}

function makeNoJobsAdminMock() {
  const limit = mock(() => Promise.resolve({ data: [], error: null }))
  const order = mock(() => ({ limit }))
  const or = mock(() => ({ order }))
  const lte = mock(() => ({ or }))
  const inMock = mock(() => ({ lte }))
  const select = mock(() => ({ in: inMock }))

  return {
    from: mock(() => ({
      select,
      update: mock(() => {}),
    })),
    storage: {
      from: mock(() => {}),
    },
  }
}

function makeSingleSuccessAdminMock() {
  const job = {
    id: 'job-1',
    meeting_id: 'meeting-1',
    user_id: 'user-1',
    status: 'queued',
    attempt_count: 0,
    max_attempts: 3,
    next_run_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
    idempotency_key: 'meeting:meeting-1:user:user-1',
    last_error: null,
  }

  const lockedJob = {
    ...job,
    status: 'running',
    attempt_count: 1,
    locked_at: new Date().toISOString(),
    locked_by: 'worker-1',
  }

  // processing_jobs.select(...).in(...).lte(...).or(...).order(...).limit(...)
  const limit = mock(() => Promise.resolve({ data: [job], error: null }))
  const order = mock(() => ({ limit }))
  const claimOr = mock(() => ({ order }))
  const lte = mock(() => ({ or: claimOr }))
  const inMock = mock(() => ({ lte }))
  const processingJobsSelect = mock(() => ({ in: inMock }))

  // first update call -> lock job
  const lockMaybeSingle = mock(() => Promise.resolve({ data: lockedJob, error: null }))
  const lockSelect = mock(() => ({ maybeSingle: lockMaybeSingle }))
  const lockOr = mock(() => ({ select: lockSelect }))
  const lockEqStatus = mock(() => ({ or: lockOr }))
  const lockEqId = mock(() => ({ eq: lockEqStatus }))

  // second update call -> complete job
  const completeEqLockedBy = mock(() => Promise.resolve({ error: null }))
  const completeEqId = mock(() => ({ eq: completeEqLockedBy }))

  const processingJobsUpdate = mock(() => {})
  processingJobsUpdate
    .mockReturnValueOnce({ eq: lockEqId })
    .mockReturnValueOnce({ eq: completeEqId })

  // meetings.select(...).eq(...).eq(...).single()
  const meetingsSingle = mock(() => Promise.resolve({
    data: { id: 'meeting-1', user_id: 'user-1', audio_url: 'user-1/meeting-1.webm' },
  }))
  const meetingsSelectEqUser = mock(() => ({ single: meetingsSingle }))
  const meetingsSelectEqId = mock(() => ({ eq: meetingsSelectEqUser }))
  const meetingsSelect = mock(() => ({ eq: meetingsSelectEqId }))

  const meetingsUpdateEqUser = mock(() => Promise.resolve({ error: null }))
  const meetingsUpdateEqId = mock(() => ({ eq: meetingsUpdateEqUser }))
  const meetingsUpdate = mock(() => ({ eq: meetingsUpdateEqId }))

  const adminMock = {
    from: mock((table: string) => {
      if (table === 'processing_jobs') {
        return {
          select: processingJobsSelect,
          update: processingJobsUpdate,
        }
      }

      if (table === 'meetings') {
        return {
          select: meetingsSelect,
          update: meetingsUpdate,
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
    storage: {
      from: mock(() => ({
        download: mock(() => Promise.resolve({ data: new Blob(['audio']), error: null })),
      })),
    },
  }

  return adminMock
}

describe('GET /api/processing/worker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    mockTranscriptionCreate.mockResolvedValue('This is a transcript')
    mockCompletionCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: 'Meeting title',
              summary: 'Summary',
              detailed_notes: '## Notes',
              action_items: [{ task: 'Do thing', owner: 'Alex', done: false }],
              key_decisions: ['Go live'],
              topics: ['Launch'],
              follow_ups: ['Send update'],
            }),
          },
        },
      ],
    })
  })

  it('returns 401 when unauthorized', async () => {
    const request = new NextRequest('http://localhost/api/processing/worker')
    const response = await GET(request)

    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('UNAUTHORIZED')
  })

  it('returns no-op response when queue has no available jobs', async () => {
    (createAdminClient as any).mockReturnValue(makeNoJobsAdminMock() as never)

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      claimed: 0,
      processed: 0,
      failed: 0,
    })
  })

  it('processes a claimed job successfully', async () => {
    (createAdminClient as any).mockReturnValue(makeSingleSuccessAdminMock() as never)

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      claimed: 1,
      processed: 1,
      failed: 0,
    })
    expect(mockTranscriptionCreate).toHaveBeenCalled()
    expect(mockCompletionCreate).toHaveBeenCalled()
  })
})
