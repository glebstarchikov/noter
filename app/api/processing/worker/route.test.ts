import { GET } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockTranscriptionCreate = vi.fn()
const mockCompletionCreate = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('openai', () => {
  const MockOpenAI = function () {
    return {
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
    }
  }
  return { default: MockOpenAI }
})

function makeRequest(path = 'http://localhost/api/processing/worker?limit=1') {
  return new NextRequest(path, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer cron-secret',
    },
  })
}

function makeNoJobsAdminMock() {
  const limit = vi.fn().mockResolvedValue({ data: [], error: null })
  const order = vi.fn().mockReturnValue({ limit })
  const or = vi.fn().mockReturnValue({ order })
  const lte = vi.fn().mockReturnValue({ or })
  const inMock = vi.fn().mockReturnValue({ lte })
  const select = vi.fn().mockReturnValue({ in: inMock })

  return {
    from: vi.fn().mockReturnValue({
      select,
      update: vi.fn(),
    }),
    storage: {
      from: vi.fn(),
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
  const limit = vi.fn().mockResolvedValue({ data: [job], error: null })
  const order = vi.fn().mockReturnValue({ limit })
  const claimOr = vi.fn().mockReturnValue({ order })
  const lte = vi.fn().mockReturnValue({ or: claimOr })
  const inMock = vi.fn().mockReturnValue({ lte })
  const processingJobsSelect = vi.fn().mockReturnValue({ in: inMock })

  // first update call -> lock job
  const lockMaybeSingle = vi.fn().mockResolvedValue({ data: lockedJob, error: null })
  const lockSelect = vi.fn().mockReturnValue({ maybeSingle: lockMaybeSingle })
  const lockOr = vi.fn().mockReturnValue({ select: lockSelect })
  const lockEqStatus = vi.fn().mockReturnValue({ or: lockOr })
  const lockEqId = vi.fn().mockReturnValue({ eq: lockEqStatus })

  // second update call -> complete job
  const completeEqLockedBy = vi.fn().mockResolvedValue({ error: null })
  const completeEqId = vi.fn().mockReturnValue({ eq: completeEqLockedBy })

  const processingJobsUpdate = vi.fn()
    .mockReturnValueOnce({ eq: lockEqId })
    .mockReturnValueOnce({ eq: completeEqId })

  // meetings.select(...).eq(...).eq(...).single()
  const meetingsSingle = vi.fn().mockResolvedValue({
    data: { id: 'meeting-1', user_id: 'user-1', audio_url: 'user-1/meeting-1.webm' },
  })
  const meetingsSelectEqUser = vi.fn().mockReturnValue({ single: meetingsSingle })
  const meetingsSelectEqId = vi.fn().mockReturnValue({ eq: meetingsSelectEqUser })
  const meetingsSelect = vi.fn().mockReturnValue({ eq: meetingsSelectEqId })

  const meetingsUpdateEqUser = vi.fn().mockResolvedValue({ error: null })
  const meetingsUpdateEqId = vi.fn().mockReturnValue({ eq: meetingsUpdateEqUser })
  const meetingsUpdate = vi.fn().mockReturnValue({ eq: meetingsUpdateEqId })

  const mock = {
    from: vi.fn((table: string) => {
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
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: new Blob(['audio']), error: null }),
      }),
    },
  }

  return mock
}

describe('GET /api/processing/worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    vi.mocked(createAdminClient).mockReturnValue(makeNoJobsAdminMock() as never)

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
    vi.mocked(createAdminClient).mockReturnValue(makeSingleSuccessAdminMock() as never)

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
