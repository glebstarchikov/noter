import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'
import { generateNotesFromTranscript } from '@/lib/notes-generation'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { z } from 'zod'
import type { DiarizedSegment } from '@/lib/types'

const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
    })
    : null

export const maxDuration = 60

const generateNotesRequestSchema = z.object({
  meetingId: z.string().trim().min(1),
  transcript: z.string().optional(),
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

    if (ratelimit) {
      const { success } = await ratelimit.limit(`generate_notes_${user.id}`)
      if (!success) {
        return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
      }
    }

    const rawBody = await request.json().catch(() => null)
    const parsedBody = generateNotesRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }
    meetingId = parsedBody.data.meetingId
    const requestTranscript = parsedBody.data.transcript

    // Verify user owns the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, user_id, transcript, template_id, diarized_transcript, audio_duration')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    const transcriptFromDb = typeof meeting.transcript === 'string' ? meeting.transcript : null
    const transcriptToProcess = transcriptFromDb || requestTranscript

    if (!transcriptToProcess || transcriptToProcess.trim().length === 0) {
      return errorResponse('Missing transcript', 'MISSING_TRANSCRIPT', 400)
    }

    // Update status
    await supabase
      .from('meetings')
      .update({ status: 'generating' })
      .eq('id', meetingId)
      .eq('user_id', user.id)

    const normalizedNotes = await generateNotesFromTranscript(supabase, {
      transcript: transcriptToProcess,
      templateId: meeting.template_id,
      userId: user.id,
      diarizedTranscript: meeting.diarized_transcript as DiarizedSegment[] | null,
      audioDuration: meeting.audio_duration as number | null,
    })

    // Save notes to database
    await supabase
      .from('meetings')
      .update({
        ...normalizedNotes,
        status: 'done',
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', meetingId)
      .eq('user_id', user.id)

    return NextResponse.json({ notes: normalizedNotes, meetingId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Notes generation failed'

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
        console.error('Failed to update meeting error status:', dbError)
      }
    }

    return errorResponse(message, 'NOTES_GENERATION_FAILED', 500)
  }
}
