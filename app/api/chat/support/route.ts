import * as Sentry from '@sentry/nextjs'
import { gateway, streamText, type UIMessage } from 'ai'
import { z } from 'zod'
import { errorResponse } from '@/lib/api-helpers'
import { DEFAULT_CHAT_MODEL, resolveChatModel } from '@/lib/ai-models'
import { buildChatModelMessages } from '@/lib/chat-message-utils'
import { SUPPORT_CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/** IP-based rate limit: 10 requests per minute (no auth on this route). */
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
    })
    : null

/** Maximum total character length across all message contents. */
const MAX_MESSAGES_TOTAL_LENGTH = 10_000

export const maxDuration = 60

const supportChatRequestSchema = z.object({
  messages: z.array(z.unknown()).default([]),
})

export async function POST(req: Request) {
  try {
    // IP-based rate limiting (this endpoint has no auth)
    if (ratelimit) {
      const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'
      const { success } = await ratelimit.limit(`support_chat_${ip}`)
      if (!success) {
        return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
      }
    }

    const rawBody = await req.json().catch(() => null)
    const parsedBody = supportChatRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }

    const { messages } = parsedBody.data

    // Guard against oversized payloads
    const totalLength = messages.reduce<number>((sum, msg) => {
      if (typeof msg === 'object' && msg !== null && 'content' in msg) {
        const content = (msg as { content: unknown }).content
        return sum + (typeof content === 'string' ? content.length : 0)
      }
      return sum
    }, 0)

    if (totalLength > MAX_MESSAGES_TOTAL_LENGTH) {
      return errorResponse(
        `Message content exceeds maximum length of ${MAX_MESSAGES_TOTAL_LENGTH} characters`,
        'PAYLOAD_TOO_LARGE',
        400,
      )
    }

    const result = streamText({
      model: gateway(resolveChatModel(DEFAULT_CHAT_MODEL)),
      system: SUPPORT_CHAT_SYSTEM_PROMPT,
      messages: await buildChatModelMessages(messages as UIMessage[]),
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages as UIMessage[],
    })
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Chat failed'
    return errorResponse(message, 'CHAT_FAILED', 500)
  }
}
