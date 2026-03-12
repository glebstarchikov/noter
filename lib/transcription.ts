import { getOpenAI } from '@/lib/openai'
import { MAX_AUDIO_SIZE_BYTES } from '@/lib/truncation-limits'

const MIME_TYPES: Record<string, string> = {
  webm: 'audio/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
}

function resolveMimeType(extension: string): string {
  return MIME_TYPES[extension] ?? 'audio/webm'
}

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{ data: Blob | null; error: { message: string } | null }>
    }
  }
}

/**
 * Downloads audio from Supabase Storage and transcribes it with Whisper.
 * Returns the transcript text.
 */
export async function transcribeAudioFromStorage(
  supabase: StorageClient,
  storagePath: string,
): Promise<string> {
  const { data: audioData, error: downloadError } = await supabase.storage
    .from('meeting-audio')
    .download(storagePath)

  if (downloadError || !audioData) {
    throw new Error('Failed to download audio from storage')
  }

  if (audioData.size > MAX_AUDIO_SIZE_BYTES) {
    throw new Error('Audio file exceeds 25MB limit')
  }

  const extension = storagePath.split('.').pop() || 'webm'
  const mimeType = resolveMimeType(extension)
  const audioFile = new File([audioData], `audio.${extension}`, { type: mimeType })

  const transcript = await getOpenAI().audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'text',
  })

  return transcript
}
