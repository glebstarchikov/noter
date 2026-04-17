import * as Sentry from '@sentry/nextjs'
import { streamText, UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { isStringArray, isActionItemArray } from '@/lib/type-guards'
import { createRateLimiter, checkRateLimit } from '@/lib/api/rate-limit'
import { z } from 'zod'
import { CHAT_MODEL } from '@/lib/ai-models'
import { buildChatModelMessages, getLastUserText } from '@/lib/chat/chat-message-utils'
import { tiptapToPlainText } from '@/lib/tiptap/tiptap-converter'
import { searchWeb } from '@/lib/tavily'
import { MAX_CHAT_TRANSCRIPT_CHARS } from '@/lib/truncation-limits'

const ratelimit = createRateLimiter(10, '10 s')

export const maxDuration = 60

const chatRequestSchema = z.object({
  meetingId: z.string().trim().min(1),
  messages: z.array(z.unknown()).max(100).default([]),
  searchEnabled: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }

    const allowed = await checkRateLimit(ratelimit, `chat_${user.id}`, 'chat')
    if (!allowed) {
      return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
    }

    const validated = await validateBody(req, chatRequestSchema)
    if (validated instanceof Response) return validated
    const { data: body } = validated

    const { meetingId, messages, searchEnabled } = body

    const { data: meeting } = await supabase
      .from('meetings')
      .select(
        'title, transcript, summary, detailed_notes, action_items, key_decisions, topics, follow_ups, document_content'
      )
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    const meetingTitle =
      typeof meeting.title === 'string' && meeting.title.trim().length > 0
        ? meeting.title
        : 'Untitled Meeting'

    let context = `# Note: ${meetingTitle}\n\n`

    const documentText = tiptapToPlainText(meeting.document_content)
    if (documentText.trim()) {
      context += `## Current Note\n${documentText}\n\n`
    }

    if (typeof meeting.summary === 'string' && meeting.summary.length > 0) {
      context += `## Summary\n${meeting.summary}\n\n`
    }

    if (typeof meeting.detailed_notes === 'string' && meeting.detailed_notes.length > 0) {
      context += `## Detailed Notes\n${meeting.detailed_notes}\n\n`
    }

    const actionItems = isActionItemArray(meeting.action_items) ? meeting.action_items : []
    if (actionItems.length > 0) {
      context += '## Action Items\n'
      for (const item of actionItems) {
        context += `- [${item.done ? 'x' : ' '}] ${item.task}${item.owner ? ` (Owner: ${item.owner})` : ''}\n`
      }
      context += '\n'
    }

    const keyDecisions = isStringArray(meeting.key_decisions) ? meeting.key_decisions : []
    if (keyDecisions.length > 0) {
      context += '## Key Decisions\n'
      for (const decision of keyDecisions) {
        context += `- ${decision}\n`
      }
      context += '\n'
    }

    const topics = isStringArray(meeting.topics) ? meeting.topics : []
    if (topics.length > 0) {
      context += '## Topics Discussed\n'
      for (const topic of topics) {
        context += `- ${topic}\n`
      }
      context += '\n'
    }

    const followUps = isStringArray(meeting.follow_ups) ? meeting.follow_ups : []
    if (followUps.length > 0) {
      context += '## Follow-ups\n'
      for (const followUp of followUps) {
        context += `- ${followUp}\n`
      }
      context += '\n'
    }

    if (typeof meeting.transcript === 'string' && meeting.transcript.length > 0) {
      const transcript = meeting.transcript.length > MAX_CHAT_TRANSCRIPT_CHARS
        ? `${meeting.transcript.slice(0, MAX_CHAT_TRANSCRIPT_CHARS)}\n\n[Transcript truncated due to length]`
        : meeting.transcript
      context += `## Transcript\n${transcript}\n\n`
    }

    const webSearchContext = searchEnabled
      ? await searchWeb(getLastUserText(messages as UIMessage[]))
      : ''

    const systemPrompt = `You are noter AI, a meeting assistant answering questions about a single note.

# Context

${context}${webSearchContext ? `\n## Web Search Context\n${webSearchContext}\n` : ''}
# Instructions

- Answer using the note, transcript, and structured metadata above. Cite specific details (names, dates, decisions) rather than giving vague summaries.
- Use attached files in the user messages when relevant.
- If something is not in the provided materials, say so clearly — do not invent details.
- When using web search context, say it came from web search.
- Format responses with markdown when it aids readability. Keep answers focused and proportional to the question.`

    const result = streamText({
      model: openai(CHAT_MODEL),
      system: systemPrompt,
      messages: await buildChatModelMessages(messages as UIMessage[]),
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages as UIMessage[],
    })
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message =
      error instanceof Error ? error.message : 'Chat failed'
    return errorResponse(message, 'CHAT_FAILED', 500)
  }
}
