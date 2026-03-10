import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MeetingDetailWrapper } from '@/components/meeting-detail-wrapper'
import { ProcessingView } from '@/components/processing-view'
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

  // Recording status: the meeting page IS the recording surface
  if (meeting.status === 'recording') {
    return <MeetingDetailWrapper meeting={meeting as Meeting} />
  }

  const isInlineWorkspaceMeeting =
    meeting.status === 'done' ||
    meeting.status === 'recording' ||
    ((meeting.status === 'generating' || meeting.status === 'error') &&
      Boolean(meeting.diarized_transcript))

  if (!isInlineWorkspaceMeeting) {
    return (
      <div className="p-6 md:p-10">
        <ProcessingView
          meetingId={id}
          step={meeting.status}
          error={meeting.status === 'error'
            ? meeting.error_message || 'An unexpected error occurred during processing.'
            : undefined}
        />
      </div>
    )
  }

  return (
    <MeetingDetailWrapper meeting={meeting as Meeting} />
  )
}
