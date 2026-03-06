import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/server/api/route-helpers'
import OpenAI from 'openai'
import { z } from 'zod'
import type { ActionItem } from '@/lib/types'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 300

const MAX_TRANSCRIPT_CHARS = 400_000
const LOCK_TIMEOUT_MS = 10 * 60 * 1000
const BASE_RETRY_DELAY_MS = 30 * 1000
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000

const workerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(3),
})

const generatedNotesSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  detailed_notes: z.string().optional(),
  action_items: z
    .array(
      z.object({
        task: z.string(),
        owner: z.string().nullable().optional(),
        done: z.boolean().optional(),
      })
    )
    .optional(),
  key_decisions: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  follow_ups: z.array(z.string()).optional(),
})

const SYSTEM_PROMPT = `You are an expert meeting note-taker. Given a meeting transcript, produce structured notes in the following JSON format. Be concise but thorough.

{
  "title": "A short descriptive title for the meeting",
  "summary": "A 1-2 sentence executive summary of the meeting",
  "detailed_notes": "Comprehensive meeting notes in markdown format. Use ## headers for each major topic discussed. Under each header, include detailed bullet points covering: context and background, key discussion points, arguments or perspectives raised, conclusions reached, and any nuances worth capturing. These notes serve as the canonical record of the meeting and should be thorough enough that someone who missed the meeting can fully understand what happened.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "done": false }
  ],
  "key_decisions": ["Decision 1", "Decision 2"],
  "topics": ["Topic 1", "Topic 2"],
  "follow_ups": ["Follow-up item 1", "Follow-up item 2"]
}

Rules:
- Extract ALL action items mentioned, even implicit ones
- Identify who is responsible for each action item when mentioned
- List key decisions that were made during the meeting
- List the main topics/themes discussed
- List any follow-ups or next steps mentioned
- The detailed_notes field should be comprehensive markdown with section headers per topic, not a repetition of the summary
- Keep language clear, professional, and concise
- Return ONLY valid JSON, nothing else`

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

type ProcessingJob = {
  id: string
  meeting_id: string
  user_id: string
  status: 'queued' | 'running' | 'retrying' | 'completed' | 'failed'
  attempt_count: number
  max_attempts: number
  next_run_at: string
  locked_at: string | null
  locked_by: string | null
  idempotency_key: string
  last_error: string | null
}

function logEvent(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: 'processing.worker', event, ...payload }))
}

function isWorkerAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (!secret) return false
  return authorization === `Bearer ${secret}`
}

function normalizeStringArray(values: string[] | undefined): string[] {
  if (!values) return []
  return values.map((value) => value.trim()).filter(Boolean)
}

function normalizeActionItems(values: z.infer<typeof generatedNotesSchema>['action_items']): ActionItem[] {
  if (!values) return []

  const items: ActionItem[] = []
  for (const item of values) {
    const task = item.task.trim()
    if (!task) continue

    const owner = item.owner?.trim() ?? null
    items.push({
      task,
      owner: owner && owner.length > 0 ? owner : null,
      done: item.done ?? false,
    })
  }

  return items
}

function getBackoffMs(attemptCount: number) {
  const retriesSoFar = Math.max(0, attemptCount - 1)
  return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** retriesSoFar)
}

function isRetryableError(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('429') ||
    normalized.includes('rate limit') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('temporarily') ||
    normalized.includes('network') ||
    normalized.includes('fetch failed') ||
    normalized.includes('econnreset') ||
    normalized.includes('etimedout')
  )
}

async function claimJobs(limit: number, workerId: string) {
  const admin = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const staleLockIso = new Date(now.getTime() - LOCK_TIMEOUT_MS).toISOString()

  const { data: candidates, error } = await admin
    .from('processing_jobs')
    .select('*')
    .in('status', ['queued', 'retrying'])
    .lte('next_run_at', nowIso)
    .or(`locked_at.is.null,locked_at.lt.${staleLockIso}`)
    .order('next_run_at', { ascending: true })
    .limit(limit * 3)

  if (error) {
    throw new Error(`Failed to load processing jobs: ${error.message}`)
  }

  const claimedJobs: ProcessingJob[] = []

  for (const candidate of (candidates ?? []) as ProcessingJob[]) {
    if (claimedJobs.length >= limit) break

    const { data: lockedJob, error: lockError } = await admin
      .from('processing_jobs')
      .update({
        status: 'running',
        attempt_count: (candidate.attempt_count ?? 0) + 1,
        locked_at: nowIso,
        locked_by: workerId,
        updated_at: nowIso,
      })
      .eq('id', candidate.id)
      .eq('status', candidate.status)
      .or(`locked_at.is.null,locked_at.lt.${staleLockIso}`)
      .select('*')
      .maybeSingle()

    if (lockError || !lockedJob) {
      continue
    }

    claimedJobs.push(lockedJob as ProcessingJob)
  }

  return claimedJobs
}

async function completeJob(jobId: string, workerId: string) {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  const { error } = await admin
    .from('processing_jobs')
    .update({
      status: 'completed',
      locked_at: null,
      locked_by: null,
      completed_at: nowIso,
      last_error: null,
      updated_at: nowIso,
    })
    .eq('id', jobId)
    .eq('locked_by', workerId)

  if (error) {
    throw new Error(`Failed to mark job completed: ${error.message}`)
  }
}

async function handleJobFailure(job: ProcessingJob, workerId: string, message: string) {
  const admin = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const retryable = isRetryableError(message)
  const hasAttemptsLeft = job.attempt_count < job.max_attempts

  if (retryable && hasAttemptsLeft) {
    const nextRunAt = new Date(now.getTime() + getBackoffMs(job.attempt_count)).toISOString()
    await admin
      .from('processing_jobs')
      .update({
        status: 'retrying',
        locked_at: null,
        locked_by: null,
        next_run_at: nextRunAt,
        last_error: message,
        updated_at: nowIso,
      })
      .eq('id', job.id)
      .eq('locked_by', workerId)

    return 'retrying' as const
  }

  await admin
    .from('processing_jobs')
    .update({
      status: 'failed',
      locked_at: null,
      locked_by: null,
      completed_at: nowIso,
      last_error: message,
      updated_at: nowIso,
    })
    .eq('id', job.id)
    .eq('locked_by', workerId)

  await admin
    .from('meetings')
    .update({
      status: 'error',
      error_message: message,
      updated_at: nowIso,
    })
    .eq('id', job.meeting_id)
    .eq('user_id', job.user_id)

  return 'failed' as const
}

async function processMeetingJob(job: ProcessingJob, workerId: string) {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data: meeting } = await admin
    .from('meetings')
    .select('id, user_id, audio_url')
    .eq('id', job.meeting_id)
    .eq('user_id', job.user_id)
    .single()

  if (!meeting) {
    throw new Error('Meeting not found for queued job')
  }

  const storagePath = typeof meeting.audio_url === 'string' ? meeting.audio_url : null
  if (!storagePath) {
    throw new Error('Meeting audio path is missing')
  }

  await admin
    .from('meetings')
    .update({
      status: 'transcribing',
      error_message: null,
      updated_at: nowIso,
    })
    .eq('id', job.meeting_id)
    .eq('user_id', job.user_id)

  const { data: audioData, error: downloadError } = await admin.storage
    .from('meeting-audio')
    .download(storagePath)

  if (downloadError || !audioData) {
    throw new Error('Failed to download audio from storage')
  }

  const extension = storagePath.split('.').pop() || 'webm'
  const mimeType = extension === 'webm' ? 'audio/webm'
    : extension === 'mp3' ? 'audio/mpeg'
      : extension === 'wav' ? 'audio/wav'
        : extension === 'm4a' ? 'audio/mp4'
          : extension === 'ogg' ? 'audio/ogg'
            : 'audio/webm'

  const audioFile = new File([audioData], `audio.${extension}`, { type: mimeType })

  const transcript = await getOpenAI().audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'text',
  })

  await admin
    .from('meetings')
    .update({
      transcript,
      status: 'generating',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.meeting_id)
    .eq('user_id', job.user_id)

  const truncatedTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[Transcript truncated due to length]'
    : transcript

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Here is the meeting transcript:\n\n${truncatedTranscript}` },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from AI')
  }

  let parsedContent: unknown
  try {
    parsedContent = JSON.parse(content)
  } catch {
    throw new Error('AI returned invalid JSON. Please try again.')
  }

  const parsedNotes = generatedNotesSchema.safeParse(parsedContent)
  if (!parsedNotes.success) {
    throw new Error('AI returned invalid JSON. Please try again.')
  }

  const normalizedNotes = {
    title: parsedNotes.data.title?.trim() || 'Untitled Meeting',
    summary: parsedNotes.data.summary?.trim() || '',
    detailed_notes: parsedNotes.data.detailed_notes?.trim() || '',
    action_items: normalizeActionItems(parsedNotes.data.action_items),
    key_decisions: normalizeStringArray(parsedNotes.data.key_decisions),
    topics: normalizeStringArray(parsedNotes.data.topics),
    follow_ups: normalizeStringArray(parsedNotes.data.follow_ups),
  }

  await admin
    .from('meetings')
    .update({
      title: normalizedNotes.title,
      summary: normalizedNotes.summary,
      detailed_notes: normalizedNotes.detailed_notes,
      action_items: normalizedNotes.action_items,
      key_decisions: normalizedNotes.key_decisions,
      topics: normalizedNotes.topics,
      follow_ups: normalizedNotes.follow_ups,
      status: 'done',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.meeting_id)
    .eq('user_id', job.user_id)

  await completeJob(job.id, workerId)
}

async function runWorker(request: NextRequest) {
  if (!isWorkerAuthorized(request)) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse('Missing Supabase service role configuration', 'QUEUE_UNAVAILABLE', 500)
  }

  const queryParse = workerQuerySchema.safeParse({
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  })

  if (!queryParse.success) {
    return errorResponse('Invalid worker query params', 'INVALID_REQUEST', 400)
  }

  const { limit } = queryParse.data
  const workerId = crypto.randomUUID()

  try {
    const jobs = await claimJobs(limit, workerId)

    if (jobs.length === 0) {
      return NextResponse.json({ success: true, claimed: 0, processed: 0, failed: 0 })
    }

    let processed = 0
    let failed = 0

    for (const job of jobs) {
      logEvent('job_claimed', {
        workerId,
        jobId: job.id,
        meetingId: job.meeting_id,
        attempt: job.attempt_count,
      })

      try {
        await processMeetingJob(job, workerId)
        processed += 1
        logEvent('job_completed', {
          workerId,
          jobId: job.id,
          meetingId: job.meeting_id,
          attempt: job.attempt_count,
        })
      } catch (error: unknown) {
        failed += 1
        const message = error instanceof Error ? error.message : 'Meeting processing failed'
        const failureStatus = await handleJobFailure(job, workerId, message)

        logEvent('job_failed', {
          workerId,
          jobId: job.id,
          meetingId: job.meeting_id,
          attempt: job.attempt_count,
          failureStatus,
          message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      claimed: jobs.length,
      processed,
      failed,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Worker failed'
    return errorResponse(message, 'WORKER_FAILED', 500)
  }
}

export async function POST(request: NextRequest) {
  return runWorker(request)
}

export async function GET(request: NextRequest) {
  return runWorker(request)
}
