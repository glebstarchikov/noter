import { gateway, streamText, type UIMessage } from 'ai'
import { z } from 'zod'
import { errorResponse } from '@/lib/api-helpers'
import { resolveChatModel } from '@/lib/ai-models'
import { buildChatModelMessages } from '@/lib/chat-message-utils'
import { SUPPORT_CHAT_SYSTEM_PROMPT } from '@/lib/prompts'

export const maxDuration = 60

const supportChatRequestSchema = z.object({
  messages: z.array(z.unknown()).default([]),
})

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null)
    const parsedBody = supportChatRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }

    const { messages } = parsedBody.data

    const result = streamText({
      model: gateway(resolveChatModel('balanced')),
      system: SUPPORT_CHAT_SYSTEM_PROMPT,
      messages: await buildChatModelMessages(messages as UIMessage[]),
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages as UIMessage[],
    })
  } catch (error: unknown) {
    console.error('Support chat API error:', error)
    const message = error instanceof Error ? error.message : 'Chat failed'
    return errorResponse(message, 'CHAT_FAILED', 500)
  }
}
