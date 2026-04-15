import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MeetingDetailWrapper } from '@/components/meeting-detail-wrapper'
import { PageShell } from '@/components/page-shell'
import { ProcessingView } from '@/components/processing-view'
import { shouldUseProcessingView } from '@/lib/meetings/meeting-workspace'
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

  if (shouldUseProcessingView(meeting as Meeting)) {
    return (
      <PageShell size="detail">
        <ProcessingView
          meetingId={id}
          step={meeting.status}
          error={meeting.status === 'error'
            ? meeting.error_message || 'An unexpected error occurred during processing.'
            : undefined}
        />
      </PageShell>
    )
  }

  return (
    <MeetingDetailWrapper meeting={meeting as Meeting} />
  )
}
