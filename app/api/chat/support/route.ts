import * as Sentry from '@sentry/nextjs'
import { streamText, type UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { CHAT_MODEL } from '@/lib/ai-models'
import { buildChatModelMessages } from '@/lib/chat/chat-message-utils'
import { SUPPORT_CHAT_SYSTEM_PROMPT } from '@/lib/notes/prompts'
import { createRateLimiter, checkRateLimit } from '@/lib/api/rate-limit'

/**
 * IP-based rate limit. This endpoint has no auth (it powers the public
 * landing-page chat), so it's the most likely target for abuse / token
 * burning. Keep this aggressive — 5 messages per minute is plenty for a
 * legitimate "kick the tires" conversation. We also cap daily volume per IP.
 */
const ratelimit = createRateLimiter(5, '1 m')
const dailyLimit = createRateLimiter(40, '24 h')

/** Maximum total character length across all message contents. */
const MAX_MESSAGES_TOTAL_LENGTH = 4_000

export const maxDuration = 60

const supportChatRequestSchema = z.object({
  messages: z.array(z.unknown()).default([]),
})

export async function POST(req: Request) {
  try {
    // IP-based rate limiting (this endpoint has no auth)
    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'

    const minuteOk = await checkRateLimit(ratelimit, `support_chat_${ip}`, 'chat/support')
    if (!minuteOk) {
      return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
    }

    const dailyOk = await checkRateLimit(dailyLimit, `support_chat_daily_${ip}`, 'chat/support')
    if (!dailyOk) {
      return errorResponse('Daily limit reached. Try again tomorrow.', 'RATE_LIMITED', 429)
    }

    const validated = await validateBody(req, supportChatRequestSchema)
    if (validated instanceof Response) return validated
    const { data: body } = validated

    const { messages } = body

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
      model: openai(CHAT_MODEL),
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
