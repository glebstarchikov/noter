import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

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

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  let meetingId: string | null = null

  try {
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (ratelimit) {
      const { success } = await ratelimit.limit(`transcribe_${user.id}`)
      if (!success) {
        return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
      }
    }

    const body = await request.json()
    meetingId = body.meetingId
    const storagePath = body.storagePath as string | undefined

    if (!meetingId) {
      return NextResponse.json({ error: 'Missing meeting ID' }, { status: 400 })
    }

    // Verify user owns the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Update status to transcribing
    await supabase
      .from('meetings')
      .update({ status: 'transcribing' })
      .eq('id', meetingId)

    if (!storagePath) {
      return NextResponse.json({ error: 'Missing audio storage path' }, { status: 400 })
    }

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

    return NextResponse.json({ transcript: transcription, meetingId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Transcription failed'

    // Set meeting status to error so it doesn't stay stuck
    if (meetingId) {
      try {
        await supabase
          .from('meetings')
          .update({
            status: 'error',
            error_message: message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meetingId)
      } catch (dbError) {
        console.error('Failed to update meeting error status:', dbError)
      }
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
