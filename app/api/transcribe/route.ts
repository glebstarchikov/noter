import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { z } from 'zod'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
    })
    : null

export const maxDuration = 120

const transcribeRequestSchema = z.object({
  meetingId: z.string().trim().min(1),
  storagePath: z.string().trim().min(1),
})

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

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
      const { success } = await ratelimit.limit(`transcribe_${user.id}`)
      if (!success) {
        return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
      }
    }

    const rawBody = await request.json().catch(() => null)
    const parsedBody = transcribeRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }
    meetingId = parsedBody.data.meetingId
    const { storagePath } = parsedBody.data

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

    // Update status to transcribing
    await supabase
      .from('meetings')
      .update({ status: 'transcribing' })
      .eq('id', meetingId)
      .eq('user_id', user.id)

    // Download audio from Supabase Storage
    const { data: audioData, error: downloadError } = await supabase.storage
      .from('meeting-audio')
      .download(storagePath)

    if (downloadError || !audioData) {
      throw new Error('Failed to download audio from storage')
    }

    // Determine file extension from path
    const extension = storagePath.split('.').pop() || 'webm'
    const mimeType = extension === 'webm' ? 'audio/webm'
      : extension === 'mp3' ? 'audio/mpeg'
      : extension === 'wav' ? 'audio/wav'
      : extension === 'm4a' ? 'audio/mp4'
      : extension === 'ogg' ? 'audio/ogg'
      : 'audio/webm'

    // Convert Blob to File for OpenAI API
    const audioFile = new File([audioData], `audio.${extension}`, { type: mimeType })

    // Transcribe with OpenAI Whisper
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'text',
    })

    // Save transcript
    await supabase
      .from('meetings')
      .update({
        transcript: transcription,
        status: 'generating',
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
        console.error('Failed to update meeting error status:', dbError)
      }
    }

    return errorResponse(message, 'TRANSCRIPTION_FAILED', 500)
  }
}
