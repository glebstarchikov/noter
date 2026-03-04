import { createOpenAI } from '@ai-sdk/openai'
import { convertToModelMessages, streamText, UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'
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

const requestSchema = z.object({
  chatId: z.string().uuid().optional(),
  messages: z.array(z.unknown()).default([]),
})

function getMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ''
  return msg.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

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
    const parsedBody = requestSchema.safeParse(rawBody)

    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }

    const requestMessages = parsedBody.data.messages as UIMessage[]
    let chatId = parsedBody.data.chatId

    if (chatId) {
      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .eq('id', chatId)
        .eq('user_id', user.id)
        .single()

      if (!existingChat) {
        return errorResponse('Chat not found', 'CHAT_NOT_FOUND', 404)
      }
    } else {
      const firstUserMessage = requestMessages.find((message) => message.role === 'user')
      const nextTitle = getMessageText(firstUserMessage ?? ({} as UIMessage)).slice(0, 60) || 'New Chat'
      const { data: newChat } = await supabase
        .from('chats')
        .insert({ user_id: user.id, title: nextTitle })
        .select('id')
        .single()

      chatId = newChat?.id
    }

    if (!chatId) {
      return errorResponse('Unable to create chat', 'CHAT_CREATE_FAILED', 500)
    }

    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, summary, topics, action_items, key_decisions, follow_ups, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(200)

    const meetingContext = (meetings ?? []).map((meeting) => {
      const summary = typeof meeting.summary === 'string' ? meeting.summary.slice(0, 500) : ''
      return [
        `# ${meeting.title ?? 'Untitled Meeting'}`,
        `Summary: ${summary || 'No summary available.'}`,
        `Topics: ${Array.isArray(meeting.topics) ? meeting.topics.join(', ') : 'None'}`,
        `Action Items: ${Array.isArray(meeting.action_items) ? meeting.action_items.length : 0}`,
        `Key Decisions: ${Array.isArray(meeting.key_decisions) ? meeting.key_decisions.join('; ') : 'None'}`,
        `Follow-ups: ${Array.isArray(meeting.follow_ups) ? meeting.follow_ups.join('; ') : 'None'}`,
      ].join('\n')
    }).join('\n\n---\n\n').slice(0, 300_000)

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: `You are noter AI. You have access to summaries and structured highlights across the user's meetings. You do not have full transcripts in this mode. If the user asks for exact wording or deep transcript detail, recommend opening a meeting-specific chat.\n\nMeeting context:\n${meetingContext}`,
      messages: await convertToModelMessages(requestMessages),
      abortSignal: req.signal,
      onFinish: async ({ text }) => {
        const latestUser = [...requestMessages].reverse().find((message) => message.role === 'user')
        const userText = latestUser ? getMessageText(latestUser) : ''

        const rows = [] as Array<{ chat_id: string; user_id: string; role: 'user' | 'assistant'; content: string }>
        if (userText) {
          rows.push({ chat_id: chatId, user_id: user.id, role: 'user', content: userText })
        }
        if (text) {
          rows.push({ chat_id: chatId, user_id: user.id, role: 'assistant', content: text })
        }

        if (rows.length > 0) {
          await supabase.from('chat_messages').insert(rows)
        }

        await supabase
          .from('chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', chatId)
          .eq('user_id', user.id)
      },
    })

    return result.toUIMessageStreamResponse({
      originalMessages: requestMessages,
      headers: {
        'X-Chat-Id': chatId,
      },
    })
  } catch (error: unknown) {
    console.error('Global chat error:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Global chat failed',
      'GLOBAL_CHAT_FAILED',
      500
    )
  }
}
