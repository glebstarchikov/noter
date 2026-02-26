import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MeetingDetail } from '@/components/meeting-detail'
import { MeetingChat } from '@/components/meeting-chat'
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

  // If the meeting is still being processed, show the processing view
  if (meeting.status === 'transcribing' || meeting.status === 'generating' || meeting.status === 'recording' || meeting.status === 'uploading') {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">
            Processing meeting
          </h1>
          <p className="text-sm text-muted-foreground">
            Your audio is being analyzed by AI. This page will not auto-refresh — please check back in a moment.
          </p>
        </div>
        <ProcessingView
          meetingId={id}
          step={meeting.status as 'transcribing' | 'generating'}
        />
      </div>
    )
  }

  // If the meeting errored, show the error state with retry/delete options
  if (meeting.status === 'error') {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <ProcessingView
          meetingId={id}
          step="error"
          error={meeting.error_message || 'An unexpected error occurred during processing.'}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <MeetingDetail meeting={meeting as Meeting} />
      <MeetingChat meetingId={id} />
    </div>
  )
}
