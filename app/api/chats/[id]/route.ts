import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const maxDuration = 30

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120),
})

function errorResponse(error: string, code: string, status: number) {
  return new Response(JSON.stringify({ error, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const { data: chat } = await supabase
    .from('chats')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!chat) {
    return errorResponse('Chat not found', 'CHAT_NOT_FOUND', 404)
  }

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('chat_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return Response.json({ chat, messages: messages ?? [] })
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const rawBody = await req.json().catch(() => null)
  const parsedBody = patchSchema.safeParse(rawBody)

  if (!parsedBody.success) {
    return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
  }

  const { data: chat } = await supabase
    .from('chats')
    .update({ title: parsedBody.data.title, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (!chat) {
    return errorResponse('Chat not found', 'CHAT_NOT_FOUND', 404)
  }

  return Response.json({ chat })
}
