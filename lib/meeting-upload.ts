import { createClient } from '@/lib/supabase/client'
import {
  readApiError,
  waitForMeetingCompletion,
  runLegacyPipeline,
  type ProcessingState,
} from '@/lib/meeting-pipeline'

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

  onProcessing({ meetingId, step: 'uploading' })

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
      return
    }
    throw new Error(processError.message)
  }

  onProcessing({ meetingId, step: 'transcribing' })
  await waitForMeetingCompletion(meetingId, onProcessing)
  onProcessing({ meetingId, step: 'done' })
}
