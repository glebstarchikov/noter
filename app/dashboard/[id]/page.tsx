import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MeetingDetail } from '@/components/meeting-detail'
import { MeetingChat } from '@/components/meeting-chat'
import type { Meeting } from '@/lib/types'

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  if (!meeting) notFound()

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <MeetingDetail meeting={meeting as Meeting} />
      <MeetingChat meetingId={id} />
    </div>
  )
}
