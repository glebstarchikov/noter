import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createOptionalRatelimit,
  enforceRateLimit,
  errorResponse,
  requireUser,
} from '@/lib/server/api/route-helpers'
import { z } from 'zod'

export const maxDuration = 30

const ratelimit = createOptionalRatelimit(10, '1 m')

const startProcessingSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(256).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

function isQueueConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.CRON_SECRET)
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!id) {
      return errorResponse('Missing meetingId', 'INVALID_MEETING_ID', 400)
    }

    const supabase = await createClient()
    const authResult = await requireUser(supabase)
    if (!authResult.ok) {
      return authResult.response
    }
    const { user } = authResult

    const rateLimitResponse = await enforceRateLimit(ratelimit, user.id, 'process_start')
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    if (!isQueueConfigured()) {
      return errorResponse('Processing queue is not configured', 'QUEUE_UNAVAILABLE', 503)
    }

    const rawBody = await request.json().catch(() => ({}))
    const parsedBody = startProcessingSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, status, audio_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    if (!meeting.audio_url || meeting.audio_url.trim().length === 0) {
      return errorResponse('Meeting audio is not uploaded yet', 'AUDIO_NOT_READY', 400)
    }

    if (meeting.status === 'done') {
      return NextResponse.json({
        success: true,
        queued: false,
        alreadyComplete: true,
      })
    }

    const defaultIdempotencyKey = `meeting:${id}:user:${user.id}`
    const idempotencyKey = parsedBody.data.idempotencyKey ?? defaultIdempotencyKey

    const { data: existingJob } = await supabase
      .from('processing_jobs')
      .select('id, status')
      .eq('meeting_id', id)
      .maybeSingle()

    if (existingJob && ['queued', 'running', 'retrying'].includes(existingJob.status)) {
      return NextResponse.json({
        success: true,
        queued: true,
        jobStatus: existingJob.status,
        workerTriggered: false,
      })
    }

    const nowIso = new Date().toISOString()

    const { error: queueError } = await supabase
      .from('processing_jobs')
      .upsert(
        {
          meeting_id: id,
          user_id: user.id,
          status: 'queued',
          attempt_count: 0,
          max_attempts: 3,
          next_run_at: nowIso,
          locked_at: null,
          locked_by: null,
          idempotency_key: idempotencyKey,
          last_error: null,
          completed_at: null,
          updated_at: nowIso,
        },
        { onConflict: 'meeting_id' }
      )

    if (queueError) {
      return errorResponse('Failed to enqueue meeting processing', 'QUEUE_ENQUEUE_FAILED', 500)
    }

    await supabase
      .from('meetings')
      .update({
        status: 'transcribing',
        error_message: null,
        updated_at: nowIso,
      })
      .eq('id', id)
      .eq('user_id', user.id)

    let workerTriggered = false
    try {
      const workerResponse = await fetch(new URL('/api/processing/worker?limit=1', request.url), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
          'Content-Type': 'application/json',
          'X-Processing-Source': 'start-endpoint',
        },
        cache: 'no-store',
      })
      workerTriggered = workerResponse.ok
    } catch {
      workerTriggered = false
    }

    return NextResponse.json({
      success: true,
      queued: true,
      jobStatus: 'queued',
      workerTriggered,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start processing'
    return errorResponse(message, 'PROCESSING_START_FAILED', 500)
  }
}
