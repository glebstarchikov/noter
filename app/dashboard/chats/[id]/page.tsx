import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatPageClient } from '@/components/chat-page-client'

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: chat } = await supabase
    .from('chats')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!chat) notFound()

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('chat_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return <ChatPageClient chat={chat} initialMessages={messages ?? []} />
}
