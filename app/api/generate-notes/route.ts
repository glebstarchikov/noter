import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'
import { getOpenAI } from '@/lib/openai'
import { buildNotesGenerationPrompt } from '@/lib/prompts'
import { normalizeStringArray, normalizeActionItems } from '@/lib/note-normalization'
import { generatedNotesSchema } from '@/lib/schemas'
import { METADATA_MODEL } from '@/lib/ai-models'
import { resolveMeetingTemplate } from '@/lib/note-template'
import { formatTranscriptForNotes, countSpeakers, buildMeetingContextHeader } from '@/lib/transcript-formatter'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { z } from 'zod'

// ~4 chars per token is a rough estimate; gpt-4o-mini supports 128k context
const MAX_TRANSCRIPT_CHARS = 400_000

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

    // Truncate very long transcripts to stay within model context limits
    const truncatedTranscript = transcriptToProcess.length > MAX_TRANSCRIPT_CHARS
      ? transcriptToProcess.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[Transcript truncated due to length]'
      : transcriptToProcess

    // Update status
    await supabase
      .from('meetings')
      .update({ status: 'generating' })
      .eq('id', meetingId)
      .eq('user_id', user.id)

    const template = await resolveMeetingTemplate(supabase as { from: (table: string) => any }, {
      template_id: meeting.template_id,
      user_id: user.id,
    })

    // Format transcript with speaker labels when diarization is available
    const formattedTranscript = formatTranscriptForNotes(
      truncatedTranscript,
      meeting.diarized_transcript as Parameters<typeof formatTranscriptForNotes>[1]
    )

    // Build meeting context header to help the model calibrate output
    const speakerCount = countSpeakers(meeting.diarized_transcript as Parameters<typeof countSpeakers>[0])
    const contextHeader = buildMeetingContextHeader({
      templateName: template.name,
      audioDuration: meeting.audio_duration as number | null,
      speakerCount,
    })

    // Generate notes with GPT
    const completion = await getOpenAI().chat.completions.create({
      model: METADATA_MODEL,
      messages: [
        { role: 'system', content: buildNotesGenerationPrompt(template) },
        { role: 'user', content: `${contextHeader}\n\nTranscript:\n${formattedTranscript}` },
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

    // Save notes to database
    await supabase
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
