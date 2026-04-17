import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MeetingDetailWrapper } from '@/components/meeting-detail-wrapper'
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
    .eq('user_id', user.id)
    .single()

  if (!meeting) notFound()

  return <MeetingDetailWrapper meeting={meeting as Meeting} />
}
