import * as Sentry from '@sentry/nextjs'
import { gateway, streamText, UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { z } from 'zod'
import { resolveChatModel, resolveChatModelId } from '@/lib/ai-models'
import { buildChatModelMessages, getLastUserText } from '@/lib/chat/chat-message-utils'
import { searchWeb } from '@/lib/tavily'
import { buildGlobalChatContext, type GlobalChatMeetingRow } from '@/lib/chat/global-chat-context'

const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
    })
    : null

export const maxDuration = 60

const globalChatRequestSchema = z.object({
  messages: z.array(z.unknown()).default([]),
  model: z.enum(['gpt-5-mini', 'gpt-5.4']).optional(),
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
      const { success } = await ratelimit.limit(`global_chat_${user.id}`)
      if (!success) {
        return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
      }
    }

    const rawBody = await req.json().catch(() => null)
    const parsedBody = globalChatRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }

    const model = resolveChatModelId(parsedBody.data.model)
    const { messages, searchEnabled } = parsedBody.data

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

    const systemPrompt = `You are noter AI, a global note assistant.

Your job is to:
- Answer questions that span multiple notes
- Find patterns and recurring themes
- Track action items across notes
- Use attached files included in the current user messages when relevant

Rules:
- Only answer based on the provided note context and any explicit web search context.
- Mention which note a fact came from whenever you summarize across multiple notes.
- When using web search context, say that it came from the web.
- Keep answers focused and practical.

Here is the note context:

${context}${webSearchContext ? `\n## Web Search Context\n${webSearchContext}\n` : ''}`

    const result = streamText({
      model: gateway(resolveChatModel(model)),
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
