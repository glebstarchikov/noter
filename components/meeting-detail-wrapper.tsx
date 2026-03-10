'use client'

import { MeetingDetail } from '@/components/meeting-detail'
import { MeetingRecordingView } from '@/components/meeting-recording-view'
import type { Meeting } from '@/lib/types'

export function MeetingDetailWrapper({ meeting }: { meeting: Meeting }) {
  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      {meeting.status === 'recording' ? (
        <MeetingRecordingView meeting={meeting} />
      ) : (
        <MeetingDetail meeting={meeting} />
      )}
    </div>
  )
}
