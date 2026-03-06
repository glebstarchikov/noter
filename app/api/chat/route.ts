import { createOpenAI } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { createClient } from '@/lib/supabase/server'
import {
  createOptionalRatelimit,
  enforceRateLimit,
  errorResponse,
  requireUser,
} from '@/lib/server/api/route-helpers'
import { z } from 'zod'

const ratelimit = createOptionalRatelimit(10, '10 s')

export const maxDuration = 60

const chatRequestSchema = z.object({
  meetingId: z.string().trim().min(1),
  messages: z.array(z.unknown()).default([]),
})

type ActionItemShape = {
  task: string
  owner: string | null
  done: boolean
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isActionItemArray(value: unknown): value is ActionItemShape[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.task === 'string' &&
        (item.owner === null || typeof item.owner === 'string') &&
        typeof item.done === 'boolean'
    )
  )
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const authResult = await requireUser(supabase)
    if (!authResult.ok) {
      return authResult.response
    }
    const { user } = authResult

    const rateLimitResponse = await enforceRateLimit(ratelimit, user.id, 'chat')
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const rawBody = await req.json().catch(() => null)
    const parsedBody = chatRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }
    const { meetingId, messages } = parsedBody.data

    // Fetch meeting data (with ownership check)
    const { data: meeting } = await supabase
      .from('meetings')
      .select(
        'title, transcript, summary, detailed_notes, action_items, key_decisions, topics, follow_ups, user_id'
      )
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    // Fetch attached sources
    const { data: sources } = await supabase
      .from('meeting_sources')
      .select('name, file_type, content')
      .eq('meeting_id', meetingId)
      .eq('user_id', user.id)

    // Build context from meeting materials
    const meetingTitle =
      typeof meeting.title === 'string' && meeting.title.trim().length > 0
        ? meeting.title
        : 'Untitled Meeting'
    let context = `# Meeting: ${meetingTitle}\n\n`

    if (typeof meeting.summary === 'string' && meeting.summary.length > 0) {
      context += `## Summary\n${meeting.summary}\n\n`
    }

    if (typeof meeting.detailed_notes === 'string' && meeting.detailed_notes.length > 0) {
      context += `## Detailed Notes\n${meeting.detailed_notes}\n\n`
    }

    const actionItems = isActionItemArray(meeting.action_items) ? meeting.action_items : []
    if (actionItems.length > 0) {
      context += `## Action Items\n`
      for (const item of actionItems) {
        context += `- [${item.done ? 'x' : ' '}] ${item.task}${item.owner ? ` (Owner: ${item.owner})` : ''}\n`
      }
      context += '\n'
    }

    const keyDecisions = isStringArray(meeting.key_decisions) ? meeting.key_decisions : []
    if (keyDecisions.length > 0) {
      context += `## Key Decisions\n`
      for (const decision of keyDecisions) {
        context += `- ${decision}\n`
      }
      context += '\n'
    }

    const topics = isStringArray(meeting.topics) ? meeting.topics : []
    if (topics.length > 0) {
      context += `## Topics Discussed\n`
      for (const topic of topics) {
        context += `- ${topic}\n`
      }
      context += '\n'
    }

    const followUps = isStringArray(meeting.follow_ups) ? meeting.follow_ups : []
    if (followUps.length > 0) {
      context += `## Follow-ups\n`
      for (const followUp of followUps) {
        context += `- ${followUp}\n`
      }
      context += '\n'
    }

    if (typeof meeting.transcript === 'string' && meeting.transcript.length > 0) {
      // Truncate transcript if it's very long to stay within context limits
      const transcript = meeting.transcript.length > 300_000
        ? meeting.transcript.slice(0, 300_000) + '\n\n[Transcript truncated due to length]'
        : meeting.transcript
      context += `## Full Transcript\n${transcript}\n\n`
    }

    if (sources && sources.length > 0) {
      context += `## External Sources\n`
      for (const source of sources) {
        if (typeof source.content !== 'string' || source.content.length === 0) {
          continue
        }

        // Truncate individual source content if very large
        const content = source.content.length > 50_000
          ? source.content.slice(0, 50_000) + '\n\n[Document truncated due to length]'
          : source.content
        const sourceName = typeof source.name === 'string' ? source.name : 'Untitled source'
        const sourceType = typeof source.file_type === 'string' ? source.file_type : 'txt'
        context += `### ${sourceName} (${sourceType})\n${content}\n\n`
      }
    }

    const systemPrompt = `You are noter AI, a helpful meeting assistant. You have access to the full context of a meeting including its transcript, structured notes, and any external documents the user has attached.

Your job is to:
- Answer questions about what happened in the meeting
- Elaborate on specific points discussed
- Verify whether topics or actions were mentioned
- Cross-reference information from external sources with meeting content
- Provide clear, concise, and accurate answers

Rules:
- Only answer based on the provided context. If something wasn't discussed or isn't in the materials, say so honestly.
- When referencing information, mention which source it came from (transcript, notes, or a specific document name).
- Be conversational but professional. Keep answers focused and to the point.
- Format responses with markdown for readability.

Here is the full meeting context:

${context}`

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages as UIMessage[]),
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages as UIMessage[],
    })
  } catch (error: unknown) {
    console.error('Chat API error:', error)
    const message =
      error instanceof Error ? error.message : 'Chat failed'
    return errorResponse(message, 'CHAT_FAILED', 500)
  }
}
