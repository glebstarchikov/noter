import OpenAI from 'openai'
import { z } from 'zod'
import type { ActionItem } from '@/lib/types'

// ~4 chars per token is a rough estimate; gpt-4o-mini supports 128k context
export const MAX_NOTES_TRANSCRIPT_CHARS = 400_000
export const NOTES_MODEL = 'gpt-4o-mini'
export const NOTES_TEMPERATURE = 0.3
export const TRANSCRIPT_TRUNCATION_SUFFIX = '\n\n[Transcript truncated due to length]'

export const generatedNotesSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  detailed_notes: z.string().optional(),
  action_items: z
    .array(
      z.object({
        task: z.string(),
        owner: z.string().nullable().optional(),
        done: z.boolean().optional(),
      })
    )
    .optional(),
  key_decisions: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  follow_ups: z.array(z.string()).optional(),
})

export type StructuredNotes = {
  title: string
  summary: string
  detailed_notes: string
  action_items: ActionItem[]
  key_decisions: string[]
  topics: string[]
  follow_ups: string[]
}

const SYSTEM_PROMPT = `You are an expert meeting note-taker. Given a meeting transcript, produce structured notes in the following JSON format. Be concise but thorough.

{
  "title": "A short descriptive title for the meeting",
  "summary": "A 1-2 sentence executive summary of the meeting",
  "detailed_notes": "Comprehensive meeting notes in markdown format. Use ## headers for each major topic discussed. Under each header, include detailed bullet points covering: context and background, key discussion points, arguments or perspectives raised, conclusions reached, and any nuances worth capturing. These notes serve as the canonical record of the meeting and should be thorough enough that someone who missed the meeting can fully understand what happened.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "done": false }
  ],
  "key_decisions": ["Decision 1", "Decision 2"],
  "topics": ["Topic 1", "Topic 2"],
  "follow_ups": ["Follow-up item 1", "Follow-up item 2"]
}

Rules:
- Extract ALL action items mentioned, even implicit ones
- Identify who is responsible for each action item when mentioned
- List key decisions that were made during the meeting
- List the main topics/themes discussed
- List any follow-ups or next steps mentioned
- The detailed_notes field should be comprehensive markdown with section headers per topic, not a repetition of the summary
- Keep language clear, professional, and concise
- Return ONLY valid JSON, nothing else`

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

function normalizeStringArray(values: string[] | undefined): string[] {
  if (!values) return []
  return values.map((value) => value.trim()).filter(Boolean)
}

function normalizeActionItems(values: z.infer<typeof generatedNotesSchema>['action_items']): ActionItem[] {
  if (!values) return []

  const items: ActionItem[] = []
  for (const item of values) {
    const task = item.task.trim()
    if (!task) continue

    const owner = item.owner?.trim() ?? null
    items.push({
      task,
      owner: owner && owner.length > 0 ? owner : null,
      done: item.done ?? false,
    })
  }

  return items
}

function truncateTranscript(transcript: string): string {
  return transcript.length > MAX_NOTES_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_NOTES_TRANSCRIPT_CHARS) + TRANSCRIPT_TRUNCATION_SUFFIX
    : transcript
}

export async function generateStructuredNotes(transcript: string): Promise<StructuredNotes> {
  const completion = await getOpenAI().chat.completions.create({
    model: NOTES_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Here is the meeting transcript:\n\n${truncateTranscript(transcript)}` },
    ],
    temperature: NOTES_TEMPERATURE,
    response_format: { type: 'json_object' },
  })

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
