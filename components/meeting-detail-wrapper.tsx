'use client'

import { MeetingDetail } from '@/components/meeting-detail'
import { MeetingWorkspace } from '@/components/meeting-workspace'
import { PageShell } from '@/components/page-shell'
import { isRecordingOriginMeeting } from '@/lib/meetings/meeting-workspace'
import type { Meeting } from '@/lib/types'

export function MeetingDetailWrapper({ meeting }: { meeting: Meeting }) {
  return (
    <PageShell size="detail">
      {isRecordingOriginMeeting(meeting) ? (
        <MeetingWorkspace meeting={meeting} />
      ) : (
        <MeetingDetail meeting={meeting} />
      )}
    </PageShell>
  )
}
