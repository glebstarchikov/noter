import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const meetingId = formData.get('meetingId') as string | null

    if (!audioFile || !meetingId) {
      return NextResponse.json({ error: 'Missing audio file or meeting ID' }, { status: 400 })
    }

    // Update status to transcribing
    await supabase
      .from('meetings')
      .update({ status: 'transcribing' })
      .eq('id', meetingId)

    // Transcribe with OpenAI Whisper
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const transcription = await openai.audio.transcriptions.create({
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
