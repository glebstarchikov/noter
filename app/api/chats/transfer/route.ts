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

export const maxDuration = 30

const transferSchema = z.object({
  meetingId: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().trim().min(1),
    })
  ).min(1),
})

function errorResponse(error: string, code: string, status: number) {
  return new Response(JSON.stringify({ error, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  if (ratelimit) {
    const { success } = await ratelimit.limit(`chat_transfer_${user.id}`)
    if (!success) {
      return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
    }
  }

  const rawBody = await req.json().catch(() => null)
  const parsedBody = transferSchema.safeParse(rawBody)

  if (!parsedBody.success) {
    return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
  }

  const { meetingId, messages } = parsedBody.data

  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, title')
    .eq('id', meetingId)
    .eq('user_id', user.id)
    .single()

  if (!meeting) {
    return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
  }

  const { data: chat } = await supabase
    .from('chats')
    .insert({
      user_id: user.id,
      title: `Chat from: ${meeting.title ?? 'Untitled Meeting'}`,
      source_meeting_id: meetingId,
    })
    .select('*')
    .single()

  if (!chat) {
    return errorResponse('Failed to create chat', 'CHAT_CREATE_FAILED', 500)
  }

  await supabase
    .from('chat_messages')
    .insert(messages.map((message) => ({
      chat_id: chat.id,
      user_id: user.id,
      role: message.role,
      content: message.content,
    })))

  return Response.json({ chat })
}
