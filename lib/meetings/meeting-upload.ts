import { createClient } from '@/lib/supabase/client'
import {
  readApiError,
  waitForMeetingCompletion,
  type ProcessingState,
} from '@/lib/meetings/meeting-pipeline'

type OnProcessing = (state: ProcessingState) => void

interface UploadAndProcessOptions {
  meetingId: string
  userId: string
  blob: Blob
  extension: string
  contentType: string
  onProcessing: OnProcessing
}

/**
 * Uploads audio to Supabase Storage, saves the path, triggers processing,
 * and waits for completion. Shared between AudioRecorder and AudioUploader.
 */
export async function uploadAndProcessMeeting({
  meetingId,
  userId,
  blob,
  extension,
  contentType,
  onProcessing,
}: UploadAndProcessOptions): Promise<void> {
  const supabase = createClient()

  onProcessing({ meetingId, step: 'generating' })

  const storagePath = `${userId}/${meetingId}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from('meeting-audio')
    .upload(storagePath, blob, { contentType })

  if (uploadError) throw new Error('Failed to upload audio: ' + uploadError.message)

  const { error: audioUrlError } = await supabase
    .from('meetings')
    .update({ audio_url: storagePath })
    .eq('id', meetingId)

  if (audioUrlError) throw new Error('Failed to save audio URL: ' + audioUrlError.message)

  const transcribeRes = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId, storagePath }),
  })

  if (!transcribeRes.ok) {
    const { message } = await readApiError(transcribeRes, 'Transcription failed')
    throw new Error(message)
  }

  onProcessing({ meetingId, step: 'generating' })

  const notesRes = await fetch('/api/generate-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId }),
  })

  if (!notesRes.ok) {
    const { message } = await readApiError(notesRes, 'Notes generation failed')
    throw new Error(message)
  }

  await waitForMeetingCompletion(meetingId, onProcessing)
  onProcessing({ meetingId, step: 'done' })
}
