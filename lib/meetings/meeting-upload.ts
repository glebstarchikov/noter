import { createClient } from '@/lib/supabase/client'
import { readApiError } from '@/lib/meetings/meeting-pipeline'

interface UploadAndTranscribeOptions {
  meetingId: string
  userId: string
  blob: Blob
  extension: string
  contentType: string
  onProgress?: (step: 'uploading' | 'transcribing' | 'done') => void
}

/**
 * Uploads audio to Supabase Storage, saves the path, and triggers transcription.
 * Note generation is user-triggered separately via the enhance route.
 */
export async function uploadAndTranscribeMeeting({
  meetingId,
  userId,
  blob,
  extension,
  contentType,
  onProgress,
}: UploadAndTranscribeOptions): Promise<void> {
  const supabase = createClient()

  onProgress?.('uploading')

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

  onProgress?.('transcribing')

  const transcribeRes = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId, storagePath }),
  })

  if (!transcribeRes.ok) {
    const { message } = await readApiError(transcribeRes, 'Transcription failed')
    throw new Error(message)
  }

  onProgress?.('done')
}
