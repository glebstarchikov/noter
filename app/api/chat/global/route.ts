import { createOpenAI } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { createClient } from '@/lib/supabase/server'
import {
  createGlobalChatSystemPrompt,
  GlobalChatContextMeeting,
  serializeGlobalChatContext,
} from '@/lib/server/chat-context'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { z } from 'zod'

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
})

function errorResponse(error: string, code: string, status: number) {
  return new Response(JSON.stringify({ error, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

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
    const { messages } = parsedBody.data

    const { data: meetings } = await supabase
      .from('meetings')
      .select(
        'id, title, summary, action_items, key_decisions, topics, follow_ups, created_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!meetings || meetings.length === 0) {
      return errorResponse('No meetings found', 'NO_MEETINGS', 404)
    }

    const context = serializeGlobalChatContext(meetings as GlobalChatContextMeeting[])
    const systemPrompt = createGlobalChatSystemPrompt(context)

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
    console.error('Global chat API error:', error)
    const message =
      error instanceof Error ? error.message : 'Chat failed'
    return errorResponse(message, 'CHAT_FAILED', 500)
  }
}
