import * as Sentry from '@sentry/nextjs'
import { streamText, UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { createRateLimiter, checkRateLimit } from '@/lib/api/rate-limit'
import { z } from 'zod'
import { CHAT_MODEL } from '@/lib/ai-models'
import { buildChatModelMessages, getLastUserText } from '@/lib/chat/chat-message-utils'
import { searchWeb } from '@/lib/tavily'
import { buildGlobalChatContext, type GlobalChatMeetingRow } from '@/lib/chat/global-chat-context'

const ratelimit = createRateLimiter(10, '10 s')

export const maxDuration = 60

const globalChatRequestSchema = z.object({
  messages: z.array(z.unknown()).default([]),
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

    const allowed = await checkRateLimit(ratelimit, `global_chat_${user.id}`, 'chat/global')
    if (!allowed) {
      return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
    }

    const validated = await validateBody(req, globalChatRequestSchema)
    if (validated instanceof Response) return validated
    const { data: body } = validated

    const { messages, searchEnabled } = body

    const { data: meetings } = await supabase
      .from('meetings')
      .select(
        'id, title, summary, action_items, key_decisions, topics, follow_ups, document_content, transcript, created_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!meetings || meetings.length === 0) {
      return errorResponse('No meetings found', 'NO_MEETINGS', 404)
    }

    const context = buildGlobalChatContext(meetings as GlobalChatMeetingRow[])

    const webSearchContext = searchEnabled
      ? await searchWeb(getLastUserText(messages as UIMessage[]))
      : ''

    const systemPrompt = `You are noter AI, a cross-note assistant answering questions that span multiple meeting notes.

# Context

${context}${webSearchContext ? `\n## Web Search Context\n${webSearchContext}\n` : ''}
# Instructions

- Answer using the note context above. When drawing from a specific note, name it.
- Find patterns, recurring themes, and cross-note action items when asked.
- Use attached files in the current user messages when relevant.
- Only answer based on the provided note context or explicit web search results — do not invent details.
- When using web search context, say it came from web search.
- Keep answers focused, specific, and practical.`

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
