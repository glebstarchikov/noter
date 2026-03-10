import { gateway, streamText, UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'
import { isStringArray, isActionItemArray } from '@/lib/type-guards'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { z } from 'zod'
import { resolveChatModel, resolveChatModelTier } from '@/lib/ai-models'
import { buildChatModelMessages, getLastUserText } from '@/lib/chat-message-utils'
import { tiptapToPlainText } from '@/lib/tiptap-converter'
import { searchWeb } from '@/lib/tavily'

const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
    })
    : null

export const maxDuration = 60

const chatRequestSchema = z.object({
  meetingId: z.string().trim().min(1),
  messages: z.array(z.unknown()).default([]),
  modelTier: z.enum(['fast', 'balanced', 'premium']).optional(),
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

    if (ratelimit) {
      const { success } = await ratelimit.limit(`chat_${user.id}`)
      if (!success) {
        return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
      }
    }

    const rawBody = await req.json().catch(() => null)
    const parsedBody = chatRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }

    const { meetingId, messages, searchEnabled } = parsedBody.data
    const modelTier = resolveChatModelTier(parsedBody.data.modelTier)

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
      const transcript = meeting.transcript.length > 300_000
        ? `${meeting.transcript.slice(0, 300_000)}\n\n[Transcript truncated due to length]`
        : meeting.transcript
      context += `## Transcript\n${transcript}\n\n`
    }

    const webSearchContext = searchEnabled
      ? await searchWeb(getLastUserText(messages as UIMessage[]))
      : ''

    const systemPrompt = `You are noter AI, a thoughtful meeting assistant.

Your job is to:
- Answer questions about this note using the note, transcript, and structured meeting metadata
- Use any attached files included in the user messages
- When web search context is provided, use it carefully and call out when information comes from the web instead of the note
- Stay concise, specific, and honest

Rules:
- Prefer the note and transcript over external information.
- If something is not in the provided note materials, say so clearly.
- When using web search context, mention that it came from web search.
- Format responses with markdown when it helps readability.

Here is the meeting context:

${context}${webSearchContext ? `\n## Web Search Context\n${webSearchContext}\n` : ''}`

    const result = streamText({
      model: gateway(resolveChatModel(modelTier)),
      system: systemPrompt,
      messages: await buildChatModelMessages(messages as UIMessage[]),
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
