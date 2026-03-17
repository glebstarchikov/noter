import type { DiarizedSegment } from '@/lib/types'

/**
 * Formats a transcript for notes generation.
 *
 * When diarized segments are available (from Deepgram real-time transcription),
 * formats the transcript with speaker labels so the model can attribute action
 * items and decisions to specific speakers.
 *
 * Falls back to plain transcript text when diarization is unavailable.
 */
export function formatTranscriptForNotes(
  transcript: string,
  diarized: DiarizedSegment[] | null | undefined
): string {
  if (!diarized || diarized.length === 0) {
    return transcript
  }

  return diarized
    .map((seg) => `[${seg.speaker}]: ${seg.text.trim()}`)
    .filter((line) => line.length > 0)
    .join('\n')
}

/**
 * Counts distinct speakers in a diarized transcript.
 */
export function countSpeakers(diarized: DiarizedSegment[] | null | undefined): number {
  if (!diarized || diarized.length === 0) return 0
  return new Set(diarized.map((seg) => seg.speaker)).size
}

/**
 * Builds a meeting context header to prepend to the transcript in the user message.
 * Helps the model calibrate summary length and understand the meeting setting.
 */
export function buildMeetingContextHeader({
  templateName,
  audioDuration,
  speakerCount,
}: {
  templateName: string
  audioDuration: number | null | undefined
  speakerCount: number
}): string {
  const lines: string[] = ['Meeting context:']
  lines.push(`- Note format: ${templateName}`)
  if (audioDuration && audioDuration > 0) {
    const minutes = Math.round(audioDuration / 60)
    lines.push(`- Duration: ${minutes} minute${minutes === 1 ? '' : 's'}`)
  }
  if (speakerCount > 0) {
    lines.push(`- Speakers detected: ${speakerCount}`)
  }
  return lines.join('\n')
}
