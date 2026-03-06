'use client'

import { createClient } from '@/lib/supabase/client'
import {
  readApiError,
  runLegacyPipeline,
  waitForMeetingCompletion,
  type ProcessingState,
} from '@/lib/meeting-pipeline'

type IngestMeetingAudioInput = {
  title: string
  audioFile: Blob
  fileExtension: string
  contentType: string
  audioDuration?: number
  onProcessing: (state: ProcessingState) => void
}

type IngestMeetingAudioResult = {
  meetingId: string
}

export async function ingestMeetingAudio({
  title,
  audioFile,
  fileExtension,
  contentType,
  audioDuration,
  onProcessing,
}: IngestMeetingAudioInput): Promise<IngestMeetingAudioResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: meeting, error: insertError } = await supabase
    .from('meetings')
    .insert({
      user_id: user.id,
      title,
      status: 'uploading',
      ...(typeof audioDuration === 'number' ? { audio_duration: audioDuration } : {}),
    })
    .select('id')
    .single()

  if (insertError || !meeting) {
    throw new Error('Failed to create meeting')
  }

  const meetingId = meeting.id
  onProcessing({ meetingId, step: 'uploading' })

  const normalizedExtension = fileExtension.replace(/^\./, '').toLowerCase()
  const storagePath = `${user.id}/${meetingId}.${normalizedExtension}`

  const { error: uploadError } = await supabase.storage
    .from('meeting-audio')
    .upload(storagePath, audioFile, { contentType })

  if (uploadError) {
    throw new Error('Failed to upload audio: ' + uploadError.message)
  }

  const { error: updateError } = await supabase
    .from('meetings')
    .update({ audio_url: storagePath })
    .eq('id', meetingId)

  if (updateError) {
    throw new Error('Failed to save audio URL: ' + updateError.message)
  }

  const processRes = await fetch(`/api/meetings/${meetingId}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })

  if (!processRes.ok) {
    const processError = await readApiError(processRes, 'Failed to queue processing')
    if (processError.code === 'QUEUE_UNAVAILABLE') {
      await runLegacyPipeline(meetingId, storagePath, onProcessing)
      onProcessing({ meetingId, step: 'done' })
      return { meetingId }
    }

    throw new Error(processError.message)
  }

  onProcessing({ meetingId, step: 'transcribing' })
  await waitForMeetingCompletion(meetingId, onProcessing)
  onProcessing({ meetingId, step: 'done' })

  return { meetingId }
}

