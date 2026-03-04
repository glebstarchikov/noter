import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { z } from 'zod'
import type { ActionItem } from '@/lib/types'

// ~4 chars per token is a rough estimate; gpt-4o-mini supports 128k context
const MAX_TRANSCRIPT_CHARS = 400_000

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

export const maxDuration = 60

const generateNotesRequestSchema = z.object({
  meetingId: z.string().trim().min(1),
  transcript: z.string().optional(),
})

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

const generatedNotesSchema = z.object({
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

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  let meetingId: string | null = null
  let userId: string | null = null

  try {
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }
    userId = user.id

    if (ratelimit) {
      const { success } = await ratelimit.limit(`generate_notes_${user.id}`)
      if (!success) {
        return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
      }
    }

    const rawBody = await request.json().catch(() => null)
    const parsedBody = generateNotesRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }
    meetingId = parsedBody.data.meetingId
    const requestTranscript = parsedBody.data.transcript

    // Verify user owns the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, transcript')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    const transcriptFromDb = typeof meeting.transcript === 'string' ? meeting.transcript : null
    const transcriptToProcess = transcriptFromDb || requestTranscript

    if (!transcriptToProcess || transcriptToProcess.trim().length === 0) {
      return errorResponse('Missing transcript', 'MISSING_TRANSCRIPT', 400)
    }

    // Truncate very long transcripts to stay within model context limits
    const truncatedTranscript = transcriptToProcess.length > MAX_TRANSCRIPT_CHARS
      ? transcriptToProcess.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[Transcript truncated due to length]'
      : transcriptToProcess

    // Update status
    await supabase
      .from('meetings')
      .update({ status: 'generating' })
      .eq('id', meetingId)
      .eq('user_id', user.id)

    // Generate notes with GPT
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Here is the meeting transcript:\n\n${truncatedTranscript}` },
      ],
      temperature: 0.3,
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

    const normalizedNotes = {
      title: parsedNotes.data.title?.trim() || 'Untitled Meeting',
      summary: parsedNotes.data.summary?.trim() || '',
      detailed_notes: parsedNotes.data.detailed_notes?.trim() || '',
      action_items: normalizeActionItems(parsedNotes.data.action_items),
      key_decisions: normalizeStringArray(parsedNotes.data.key_decisions),
      topics: normalizeStringArray(parsedNotes.data.topics),
      follow_ups: normalizeStringArray(parsedNotes.data.follow_ups),
    }

    // Save notes to database
    await supabase
      .from('meetings')
      .update({
        title: normalizedNotes.title,
        summary: normalizedNotes.summary,
        detailed_notes: normalizedNotes.detailed_notes,
        action_items: normalizedNotes.action_items,
        key_decisions: normalizedNotes.key_decisions,
        topics: normalizedNotes.topics,
        follow_ups: normalizedNotes.follow_ups,
        status: 'done',
        updated_at: new Date().toISOString(),
      })
      .eq('id', meetingId)
      .eq('user_id', user.id)

    return NextResponse.json({ notes: normalizedNotes, meetingId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Notes generation failed'

    // Set meeting status to error so it doesn't stay stuck
    if (meetingId && userId) {
      try {
        await supabase
          .from('meetings')
          .update({
            status: 'error',
            error_message: message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meetingId)
          .eq('user_id', userId)
      } catch (dbError) {
        console.error('Failed to update meeting error status:', dbError)
      }
    }

    return errorResponse(message, 'NOTES_GENERATION_FAILED', 500)
  }
}
