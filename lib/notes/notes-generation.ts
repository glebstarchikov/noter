import { getOpenAI } from '@/lib/openai'
import { normalizeStringArray, normalizeActionItems } from '@/lib/notes/note-normalization'
import { buildNotesGenerationPrompt } from '@/lib/notes/prompts'
import { generatedNotesSchema } from '@/lib/schemas'
import { DEFAULT_NOTE_TEMPLATE } from '@/lib/note-template'
import { formatTranscriptForNotes, countSpeakers, buildMeetingContextHeader } from '@/lib/transcript-formatter'
import { METADATA_MODEL } from '@/lib/ai-models'
import { MAX_TRANSCRIPT_CHARS } from '@/lib/truncation-limits'
import type { DiarizedSegment } from '@/lib/types'

export interface GenerateNotesInput {
  transcript: string
  diarizedTranscript?: DiarizedSegment[] | null
  audioDuration?: number | null
}

export interface GeneratedNotes {
  title: string
  summary: string
  detailed_notes: string
  action_items: ReturnType<typeof normalizeActionItems>
  key_decisions: string[]
  topics: string[]
  follow_ups: string[]
}

function shouldRetryWithoutStructuredResponseFormat(error: unknown) {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return (
    message.includes('invalid input') ||
    message.includes('response_format') ||
    message.includes('json_object')
  )
}

/**
 * Generates structured meeting notes from a transcript using AI.
 * Shared between the direct `/api/generate-notes` route and the background worker.
 */
export async function generateNotesFromTranscript(
  input: GenerateNotesInput,
): Promise<GeneratedNotes> {
  const { transcript, diarizedTranscript, audioDuration } = input

  const truncatedTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[Transcript truncated due to length]'
    : transcript

  const template = DEFAULT_NOTE_TEMPLATE

  const formattedTranscript = formatTranscriptForNotes(truncatedTranscript, diarizedTranscript)

  const speakerCount = countSpeakers(diarizedTranscript)
  const contextHeader = buildMeetingContextHeader({
    templateName: template.name,
    audioDuration: audioDuration ?? null,
    speakerCount,
  })
  const messages = [
    { role: 'system' as const, content: buildNotesGenerationPrompt(template) },
    { role: 'user' as const, content: `${contextHeader}\n\nTranscript:\n${formattedTranscript}` },
  ]
  const requestCompletion = (useStructuredResponseFormat: boolean) =>
    getOpenAI().chat.completions.create({
      model: METADATA_MODEL,
      messages,
      temperature: 0.3,
      ...(useStructuredResponseFormat ? { response_format: { type: 'json_object' as const } } : {}),
    })

  const completion = await (async () => {
    try {
      return await requestCompletion(true)
    } catch (error: unknown) {
      if (!shouldRetryWithoutStructuredResponseFormat(error)) {
        throw error
      }

      return requestCompletion(false)
    }
  })()

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

  return {
    title: parsedNotes.data.title?.trim() || 'Untitled Meeting',
    summary: parsedNotes.data.summary?.trim() || '',
    detailed_notes: parsedNotes.data.detailed_notes?.trim() || '',
    action_items: normalizeActionItems(parsedNotes.data.action_items),
    key_decisions: normalizeStringArray(parsedNotes.data.key_decisions),
    topics: normalizeStringArray(parsedNotes.data.topics),
    follow_ups: normalizeStringArray(parsedNotes.data.follow_ups),
  }
}
