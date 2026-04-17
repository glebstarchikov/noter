import * as Sentry from '@sentry/nextjs'
import { gateway, streamText, type UIMessage } from 'ai'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { DEFAULT_CHAT_MODEL, resolveChatModel } from '@/lib/ai-models'
import { buildChatModelMessages } from '@/lib/chat/chat-message-utils'
import { SUPPORT_CHAT_SYSTEM_PROMPT } from '@/lib/notes/prompts'
import { createRateLimiter, checkRateLimit } from '@/lib/api/rate-limit'

/** IP-based rate limit: 10 requests per minute (no auth on this route). */
const ratelimit = createRateLimiter(10, '1 m')

/** Maximum total character length across all message contents. */
const MAX_MESSAGES_TOTAL_LENGTH = 10_000

export const maxDuration = 60

const supportChatRequestSchema = z.object({
  messages: z.array(z.unknown()).default([]),
})

export async function POST(req: Request) {
  try {
    // IP-based rate limiting (this endpoint has no auth)
    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'
    const allowed = await checkRateLimit(ratelimit, `support_chat_${ip}`, 'chat/support')
    if (!allowed) {
      return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
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
