import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { transcribeAudioFromStorage } from '@/lib/transcription'
import { createRateLimiter, checkRateLimit } from '@/lib/api/rate-limit'
import { z } from 'zod'

const ratelimit = createRateLimiter(5, '1 m')

export const maxDuration = 120

const transcribeRequestSchema = z.object({
  meetingId: z.string().trim().min(1),
  storagePath: z.string().trim().min(1),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  let meetingId: string | null = null
  let userId: string | null = null

  try {
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }
    userId = user.id

    const allowed = await checkRateLimit(ratelimit, `transcribe_${user.id}`, 'transcribe')
    if (!allowed) {
      return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
    }

    const validated = await validateBody(request, transcribeRequestSchema)
    if (validated instanceof Response) return validated
    const { data: body } = validated

    meetingId = body.meetingId
    const { storagePath } = body

    // Verify user owns the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    const transcription = await transcribeAudioFromStorage(supabase, storagePath)

    // Save transcript and mark meeting as done — note generation is user-triggered
    // via the enhance route, so the transcribe step is the terminal step here.
    await supabase
      .from('meetings')
      .update({
        transcript: transcription,
        status: 'done',
        updated_at: new Date().toISOString(),
      })
      .eq('id', meetingId)
      .eq('user_id', user.id)

    return NextResponse.json({ transcript: transcription, meetingId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Transcription failed'

    // Set meeting status to error so it doesn't stay stuck
    if (meetingId && userId) {
      try {
        await supabase
          .from('meetings')
          .update({
            status: 'error',
            error_message: message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meetingId)
          .eq('user_id', userId)
      } catch (dbError) {
        Sentry.captureException(dbError)
      }
    }

    return errorResponse(message, 'TRANSCRIPTION_FAILED', 500)
  }
}
