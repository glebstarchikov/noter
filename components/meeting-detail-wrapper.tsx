'use client'

import { MeetingWorkspace } from '@/components/meeting-workspace'
import { PageShell } from '@/components/page-shell'
import type { Meeting } from '@/lib/types'

export function MeetingDetailWrapper({ meeting }: { meeting: Meeting }) {
  return (
    <PageShell size="detail">
      <MeetingWorkspace meeting={meeting} />
    </PageShell>
  )
}
