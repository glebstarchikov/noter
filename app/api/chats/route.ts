import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const maxDuration = 30

const deleteSchema = z.object({
  chatId: z.string().uuid(),
})

function errorResponse(error: string, code: string, status: number) {
  return new Response(JSON.stringify({ error, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const { data } = await supabase
    .from('chats')
    .select('id, title, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  return Response.json({ chats: data ?? [] })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const rawBody = await req.json().catch(() => null)
  const parsedBody = deleteSchema.safeParse(rawBody)

  if (!parsedBody.success) {
    return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
  }

  await supabase
    .from('chats')
    .delete()
    .eq('id', parsedBody.data.chatId)
    .eq('user_id', user.id)

  return Response.json({ success: true })
}
