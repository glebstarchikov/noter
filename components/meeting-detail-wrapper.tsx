'use client'

import { MeetingDetail } from '@/components/meeting-detail'
import { MeetingWorkspace } from '@/components/meeting-workspace'
import { isRecordingOriginMeeting } from '@/lib/meeting-workspace'
import type { Meeting } from '@/lib/types'

export function MeetingDetailWrapper({ meeting }: { meeting: Meeting }) {
  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      {isRecordingOriginMeeting(meeting) ? (
        <MeetingWorkspace meeting={meeting} />
      ) : (
        <MeetingDetail meeting={meeting} />
      )}
    </div>
  )
}
