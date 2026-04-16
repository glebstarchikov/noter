import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { generateNotesFromTranscript } from '@/lib/notes/notes-generation'
import { generatedNotesToTiptap } from '@/lib/tiptap/tiptap-converter'
import { createRateLimiter, checkRateLimit } from '@/lib/api/rate-limit'
import { translateToUserError } from '@/lib/notes/error-messages'
import { z } from 'zod'
import type { DiarizedSegment } from '@/lib/types'

const ratelimit = createRateLimiter(5, '1 m')

export const maxDuration = 60

const generateNotesRequestSchema = z.object({
  meetingId: z.string().trim().min(1),
  transcript: z.string().max(500_000).optional(),
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

    const allowed = await checkRateLimit(ratelimit, `generate_notes_${user.id}`, 'generate-notes')
    if (!allowed) {
      return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
    }

    const validated = await validateBody(request, generateNotesRequestSchema)
    if (validated instanceof Response) return validated
    meetingId = validated.data.meetingId
    const requestTranscript = validated.data.transcript

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

    // Save notes to database (including Tiptap document for the editor)
    const tiptapDocument = generatedNotesToTiptap(normalizedNotes)

    await supabase
      .from('meetings')
      .update({
        ...normalizedNotes,
        document_content: tiptapDocument,
        status: 'done',
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', meetingId)
      .eq('user_id', user.id)

    return NextResponse.json({ notes: normalizedNotes, meetingId })
  } catch (error: unknown) {
    const translated = translateToUserError(error)

    // Set meeting status to error so it doesn't stay stuck
    if (meetingId && userId) {
      try {
        await supabase
          .from('meetings')
          .update({
            status: 'error',
            error_message: translated.userMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meetingId)
          .eq('user_id', userId)
      } catch (dbError) {
        Sentry.captureException(dbError)
      }
    }

    Sentry.captureException(error, {
      tags: { route: 'generate-notes' },
      extra: { developerMessage: translated.developerMessage },
    })
    return errorResponse(translated.userMessage, 'NOTES_GENERATION_FAILED', 500)
  }
}
